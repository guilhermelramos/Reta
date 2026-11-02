import { createFileRoute } from "@tanstack/react-router";
import {
  AlarmClock,
  BatteryCharging,
  Bell,
  BellRing,
  BookOpen,
  ChevronRight,
  Cog,
  Database,
  Download,
  FileSpreadsheet,
  KeyRound,
  Moon,
  SlidersHorizontal,
  Upload,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ZodError } from "zod";
import { Button } from "@/components/ui/button";
import { ButtonSpinner } from "@/components/feedback/button-spinner";
import { InlineError } from "@/components/feedback/inline-error";
import {
  SettingsBlock,
  SettingsButtonRow,
  SettingsLinkRow,
  SettingsRow,
} from "@/components/settings/settings-row";
import { SettingsSection } from "@/components/settings/settings-section";
import { SettingsSwitchRow } from "@/components/settings/settings-switch";
import { pingAiClient } from "@/lib/ai/xai-client";
import {
  describeError,
  genericCopy,
  notificationsDeniedCopy,
  type ErrorCopy,
} from "@/lib/feedback/error-copy";
import { openBatteryOptimizationSettings } from "@/lib/native/battery";
import { saveAndShare } from "@/lib/native/files";
import {
  getNativeNotificationStatus,
  isNativeNotificationService,
  notificationPermission,
  requestNativeNotifications,
  requestNotificationPermission,
  syncNativeNotifications,
  type ExactAlarmPermission,
} from "@/lib/native/notifications";
import { openAppSettings } from "@/lib/native/settings";
import type { KeyValues } from "@/lib/secure/keys";
import { exportAll, importAll, parseBackupText } from "@/lib/study/db";
import { useStudy } from "@/lib/study/store";
import type { ResearcherId, Settings } from "@/lib/study/types";
import { cn } from "@/lib/cn";
import {
  appVersionLabel,
  batteryStatus,
  exactAlarmStatus,
  keySaveLabel,
  keyStatus,
  remindersStatus,
  storageStatus,
  testConnectionLabel,
  testConnectionMessage,
  type ReminderPermission,
  type StatusCopy,
  type StatusTone,
  type TestState,
} from "@/lib/ui/settings-status";

export const Route = createFileRoute("/_shell/ajustes")({
  head: () => ({ meta: [{ title: "Ajustes · Reta" }] }),
  component: SettingsPage,
});

const PROVIDERS: { id: ResearcherId; label: string }[] = [
  { id: "grok", label: "Grok (xAI)" },
  { id: "perplexity", label: "Perplexity" },
  { id: "gemini", label: "Gemini" },
  { id: "claude", label: "Claude" },
];

/** Chaves opcionais que ficam recolhidas em "Avançado". */
const OTHER_PROVIDERS: { id: Exclude<ResearcherId, "grok">; label: string }[] = [
  { id: "perplexity", label: "Perplexity" },
  { id: "gemini", label: "Gemini" },
  { id: "claude", label: "Claude" },
];

const SETTINGS_SAVE_ERROR = "Não consegui guardar os ajustes neste aparelho.";
const KEYS_SAVE_ERROR = "Não consegui guardar as chaves com segurança neste aparelho.";

/** Retrato da permissão/lâmpadas nativas lido ao abrir e ao voltar ao app. */
type ReminderState = {
  native: boolean;
  permission: ReminderPermission;
  exactAlarms: ExactAlarmPermission;
  battery: boolean | null;
};

const LOADING_STATUS: StatusCopy = {
  label: "Verificando…",
  hint: "Lendo a permissão do aparelho.",
  tone: "muted",
};

const LOADING_SETTINGS_STATUS = { ...LOADING_STATUS, opensSettings: false };

function SettingsPage() {
  const { settings, keys, saveSettings, days, sessions, notifyLog } = useStudy();
  // O shell só monta as telas depois de ler o IndexedDB e o cofre de chaves,
  // então estes valores já chegam preenchidos. A partir daqui o formulário é a
  // cópia local: as edições são gravadas pelo serviço existente (`saveSettings`).
  const [draft, setDraft] = useState<Settings>(settings);
  const draftRef = useRef(draft);
  const [keyDraft, setKeyDraft] = useState<KeyValues>(keys);
  // Último conjunto de chaves que o formulário pediu para gravar. Os switches
  // gravam ajustes e chaves na mesma chamada; sem esta referência, alternar um
  // switch logo após "Salvar chave" regravaria as chaves antigas.
  const keysRef = useRef<KeyValues>(keys);
  const [note, setNote] = useState("");
  const [keyBusy, setKeyBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testState, setTestState] = useState<TestState>("idle");
  const [testError, setTestError] = useState<ErrorCopy | null>(null);
  const [saveError, setSaveError] = useState<ErrorCopy | null>(null);
  const [reminder, setReminder] = useState<ReminderState | null>(null);
  const [notificationError, setNotificationError] = useState<ErrorCopy | null>(null);
  const [batteryNote, setBatteryNote] = useState("");
  const [storage, setStorage] = useState<StorageState>({
    supported: false,
    persisted: null,
    usage: null,
    quota: null,
  });
  const [storageBusy, setStorageBusy] = useState(false);
  const [storageNote, setStorageNote] = useState("");
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupNote, setBackupNote] = useState("");
  const [backupError, setBackupError] = useState<ErrorCopy | null>(null);
  const restoreInput = useRef<HTMLInputElement>(null);
  // Gravações em fila: alternar dois switches rápido não deixa a primeira
  // escrita sobrescrever a segunda.
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const lastSave = useRef<{ settings: Settings; keys: KeyValues; message: string } | null>(null);

  useEffect(() => {
    let live = true;
    void readStorageState().then((next) => {
      if (live) setStorage(next);
    });
    return () => {
      live = false;
    };
  }, []);

  // Permissão já negada aparece sem precisar tocar no botão de novo. No APK o
  // estado vem do plugin nativo, por isso a leitura é assíncrona.
  useEffect(() => {
    let live = true;
    void readReminderState().then((next) => {
      if (!live) return;
      setReminder(next);
      if (next.permission === "denied") setNotificationError(notificationsDeniedCopy());
    });
    return () => {
      live = false;
    };
  }, []);

  // Ao voltar das configurações do Android (ou da tela de bateria) o estado
  // real pode ter mudado; relê sem pedir nada.
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      void readReminderState().then((next) => {
        setReminder(next);
        if (next.permission !== "denied") setNotificationError(null);
      });
    };
    document.addEventListener("visibilitychange", refresh);
    return () => document.removeEventListener("visibilitychange", refresh);
  }, []);

  function enqueueSave(
    nextSettings: Settings,
    nextKeys: KeyValues,
    message: string,
  ): Promise<boolean> {
    lastSave.current = { settings: nextSettings, keys: nextKeys, message };
    const run = saveQueue.current.then(async () => {
      try {
        await saveSettings(nextSettings, nextKeys);
        setSaveError(null);
        return true;
      } catch {
        setSaveError(genericCopy(message));
        return false;
      }
    });
    saveQueue.current = run.then(() => undefined);
    return run;
  }

  /** Aplica e grava na hora: switches e horário não dependem de um "Salvar". */
  function patch(partial: Partial<Settings>) {
    const next = { ...draftRef.current, ...partial };
    draftRef.current = next;
    setDraft(next);
    void enqueueSave(next, keysRef.current, SETTINGS_SAVE_ERROR);
  }

  function retrySave() {
    const pending = lastSave.current;
    if (!pending) return;
    void enqueueSave(pending.settings, pending.keys, pending.message);
  }

  async function saveKeys() {
    setKeyBusy(true);
    setNote("");
    const nextKeys = { ...keyDraft };
    keysRef.current = nextKeys;
    const ok = await enqueueSave({ ...draftRef.current }, nextKeys, KEYS_SAVE_ERROR);
    if (ok) {
      setNote(
        nextKeys.xai.trim() ? "Guardado só neste aparelho." : "Chave removida deste aparelho.",
      );
    }
    setKeyBusy(false);
  }

  async function removeXaiKey() {
    setKeyBusy(true);
    setNote("");
    const nextKeys = { ...keyDraft, xai: "" };
    keysRef.current = nextKeys;
    const ok = await enqueueSave({ ...draftRef.current }, nextKeys, KEYS_SAVE_ERROR);
    if (ok) {
      setKeyDraft(nextKeys);
      setNote("Chave removida deste aparelho.");
      setTestState("idle");
      setTestError(null);
    }
    setKeyBusy(false);
  }

  function online(): boolean {
    return typeof navigator === "undefined" || navigator.onLine !== false;
  }

  /** Na própria Ajustes, "Atualizar chave" foca o campo em vez de navegar. */
  function localCopy(copy: ErrorCopy): ErrorCopy {
    if (copy.action?.id !== "update-key") return copy;
    return { ...copy, action: { ...copy.action, href: undefined } };
  }

  async function test() {
    if (testing) return;
    setTesting(true);
    setTestState("loading");
    setTestError(null);
    setNote("");
    try {
      const current = draftRef.current.researcher;
      const key =
        current === "grok"
          ? keyDraft.xai
          : current === "perplexity"
            ? keyDraft.perplexity
            : current === "gemini"
              ? keyDraft.gemini
              : keyDraft.claude;
      const res = await pingAiClient({ provider: current, userKey: key });
      if (res.ok) {
        setTestState("success");
        setNote(testConnectionMessage("success") ?? "");
      } else {
        setTestState("error");
        setTestError(localCopy(describeError(res.failure ?? res.error, { online: online() })));
      }
    } catch (err) {
      // A chamada pode falhar antes de virar resposta (sem rede, rota ausente
      // no APK antigo, timeout): o botão sempre sai de "Testando…".
      setTestState("error");
      setTestError(localCopy(describeError(err, { online: online() })));
    } finally {
      setTesting(false);
    }
  }

  function testAction(action: ErrorCopy["action"]) {
    if (!action) return;
    if (action.id === "retry") {
      void test();
      return;
    }
    if (action.id === "update-key") {
      const input = document.getElementById("xai-key");
      input?.scrollIntoView({ behavior: "smooth", block: "center" });
      input?.focus();
    }
  }

  async function refreshReminder(): Promise<ReminderState> {
    const next = await readReminderState();
    setReminder(next);
    if (next.permission !== "denied") setNotificationError(null);
    return next;
  }

  async function allowNotes(options?: { askExact?: boolean }) {
    setNotificationError(null);
    setBatteryNote("");
    setNote("");
    if (isNativeNotificationService()) {
      const status = await requestNativeNotifications({ askExact: options?.askExact ?? true });
      await refreshReminder();
      if (status.permission === "granted") {
        setNote(
          status.exactAlarms === "denied"
            ? "Notificações ligadas. Alarmes exatos estão desligados no Android: os avisos podem atrasar alguns minutos."
            : "Notificações ligadas.",
        );
      } else if (status.error) {
        setNote(`Não consegui ligar as notificações: ${status.error}`);
      } else {
        setNotificationError(notificationsDeniedCopy());
      }
      await syncNativeNotifications({ settings: draftRef.current, days, sessions, log: notifyLog });
      return;
    }
    const current = notificationPermission();
    if (current === "granted") {
      setNote("Notificações ligadas.");
      await refreshReminder();
      return;
    }
    if (typeof Notification === "undefined") {
      setNote("Este navegador não mostra notificação.");
      await refreshReminder();
      return;
    }
    const permission = await requestNotificationPermission();
    if (permission === "granted") {
      setNote("Notificações ligadas.");
      await refreshReminder();
      return;
    }
    setNotificationError(notificationsDeniedCopy());
    await refreshReminder();
  }

  async function notificationAction() {
    const opened = await openAppSettings();
    setNote(
      opened
        ? "Configurações do app abertas."
        : "No navegador, libere as notificações nas configurações do site.",
    );
  }

  async function batteryAction() {
    setBatteryNote("");
    const opened = await openBatteryOptimizationSettings();
    setBatteryNote(
      opened
        ? "Tela de otimização de bateria aberta. Ao voltar, o status é atualizado."
        : "No navegador não existe otimização de bateria: mantenha o Reta aberto ou instalado para os avisos chegarem.",
    );
  }

  async function requestPersist() {
    if (typeof navigator === "undefined" || typeof navigator.storage?.persist !== "function") {
      setStorageNote("Este navegador não oferece armazenamento persistente.");
      return;
    }
    setStorageBusy(true);
    setStorageNote("");
    try {
      await navigator.storage.persist();
      // Mostra o estado que o navegador/WebView realmente reporta depois do pedido.
      const next = await readStorageState();
      setStorage(next);
      if (next.persisted === true) {
        setStorageNote("Armazenamento persistente concedido.");
      } else if (next.persisted === false) {
        setStorageNote("O navegador não concedeu. O backup manual continua valendo.");
      } else {
        setStorageNote("O navegador não informou o resultado. O backup manual continua valendo.");
      }
    } catch {
      setStorageNote("Não consegui pedir armazenamento persistente.");
    } finally {
      setStorageBusy(false);
    }
  }

  async function exportBackup() {
    setBackupBusy(true);
    setBackupNote("");
    setBackupError(null);
    try {
      const backup = await exportAll();
      const json = JSON.stringify(backup, null, 2);
      const name = `reta-backup-${new Date().toISOString().slice(0, 10)}.json`;
      const resumo = `${backup.days.length} dias, ${backup.sessions.length} sessões`;
      const result = await saveAndShare(name, "application/json", json);

      if (result.mode === "canceled") {
        setBackupNote("Compartilhamento cancelado.");
      } else if (result.mode === "shared") {
        setBackupNote(`Backup compartilhado (${resumo}).`);
      } else {
        setBackupNote(`Backup salvo (${resumo}).`);
      }
    } catch {
      setBackupError(genericCopy("Não consegui gerar o backup. Tente de novo."));
    } finally {
      setBackupBusy(false);
    }
  }

  function restoreFailure(message: string): ErrorCopy {
    return {
      ...genericCopy(message),
      action: { id: "choose-file", label: "Escolher outro arquivo" },
    };
  }

  async function restoreBackup(file: File) {
    setBackupBusy(true);
    setBackupNote("");
    setBackupError(null);
    try {
      if (file.size === 0) throw new Error("O arquivo está vazio.");
      if (file.size > 100_000_000) throw new Error("Arquivo grande demais (máximo 100 MB).");
      const text = await file.text();
      const backup = parseBackupText(text);
      await importAll(backup);
      setBackupNote(`Backup restaurado (${backup.days.length} dias). Recarregando…`);
      window.setTimeout(() => window.location.reload(), 900);
    } catch (err) {
      if (err instanceof ZodError) {
        const first = err.issues[0];
        const field = first?.path.join(".") || "";
        setBackupError(
          restoreFailure(
            field
              ? `Backup inválido no campo "${field}". Use o arquivo .json exportado pelo próprio Reta.`
              : "Backup inválido: o arquivo não tem o formato do Reta.",
          ),
        );
      } else if (err instanceof SyntaxError) {
        setBackupError(restoreFailure("O arquivo não é um JSON válido."));
      } else {
        setBackupError(
          restoreFailure(err instanceof Error ? err.message : "Não consegui restaurar esse backup."),
        );
      }
      setBackupBusy(false);
    }
  }

  function backupAction(action: ErrorCopy["action"]) {
    if (!action) return;
    if (action.id === "retry") void exportBackup();
    if (action.id === "choose-file") restoreInput.current?.click();
  }

  const key = keyStatus(keys.xai);
  const configured = key.configured;
  const reminders = reminder ? remindersStatus(reminder.permission, reminder.native) : LOADING_STATUS;
  const exact = reminder
    ? exactAlarmStatus(reminder.exactAlarms, reminder.native)
    : LOADING_SETTINGS_STATUS;
  const battery = reminder
    ? batteryStatus(reminder.battery, reminder.native)
    : LOADING_SETTINGS_STATUS;
  const storageCopy = storageStatus(storage);
  const storageUsage = storage.supported
    ? `Uso local: ${formatBytes(storage.usage)} de ${formatBytes(storage.quota)}.`
    : undefined;

  return (
    <div className="mx-auto flex w-full max-w-[600px] flex-col gap-6">
      <header>
        <p className="text-sm text-muted">Só neste aparelho</p>
        <h1 className="mt-1 text-3xl leading-tight">Ajustes</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Horário, alertas e chaves. Nada disso vai para um servidor nosso.
        </p>
      </header>

      {saveError ? (
        <InlineError
          copy={saveError}
          onAction={(action) => {
            if (action.id === "retry") retrySave();
          }}
        />
      ) : null}

      <input
        ref={restoreInput}
        className="sr-only"
        type="file"
        aria-label="Escolher arquivo de backup para restaurar"
        accept=".json,application/json,text/plain,application/octet-stream"
        onChange={(e) => {
          const file = e.currentTarget.files?.[0];
          e.currentTarget.value = "";
          if (file) void restoreBackup(file);
        }}
      />

      <SettingsSection id="professor" title="Professor IA">
        <SettingsRow
          icon={KeyRound}
          label="Chave xAI"
          support={key.hint}
          trailing={<StatusText status={key} />}
        />

        <SettingsBlock className="flex flex-col gap-3">
          <label htmlFor="xai-key" className="text-sm font-medium text-fg">
            {configured ? "Colar ou trocar a chave" : "Colar a chave"}
          </label>
          <input
            id="xai-key"
            className="h-12 w-full rounded-xl border border-border bg-surface-2 px-3 text-base text-fg placeholder:text-muted"
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder="xai-…"
            value={keyDraft.xai}
            onChange={(e) => setKeyDraft({ ...keyDraft, xai: e.target.value })}
          />
          <p className="text-xs leading-relaxed text-muted">
            No Android a chave fica no Keystore do aparelho. O uso é cobrado na sua conta xAI.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button disabled={keyBusy} onClick={() => void saveKeys()}>
              {keyBusy ? "Guardando…" : keySaveLabel(configured)}
            </Button>
            {configured ? (
              <Button variant="clay" disabled={keyBusy} onClick={() => void removeXaiKey()}>
                Remover chave
              </Button>
            ) : null}
            <Button variant="surface" disabled={testing} onClick={() => void test()}>
              {testing ? (
                <>
                  <ButtonSpinner />
                  {testConnectionLabel("loading")}
                </>
              ) : (
                testConnectionLabel(testState)
              )}
            </Button>
          </div>
          {testError ? <InlineError copy={testError} onAction={testAction} /> : null}
          {note ? (
            <p className="text-sm leading-relaxed text-muted" role="status">
              {note}
            </p>
          ) : null}
        </SettingsBlock>

        <SettingsBlock className="flex flex-col gap-2">
          <label htmlFor="researcher" className="text-sm font-medium text-fg">
            Quem monta o pacote
          </label>
          <select
            id="researcher"
            className="h-12 w-full rounded-xl border border-border bg-surface-2 px-3 text-base text-fg"
            value={draft.researcher}
            onChange={(e) => patch({ researcher: e.target.value as ResearcherId })}
          >
            {PROVIDERS.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.label}
              </option>
            ))}
          </select>
          <p className="text-xs leading-relaxed text-muted">
            O Grok é o tutor: pergunta e corrige só com o pacote já pronto, sem buscar na web na
            sessão. O pesquisador monta o pacote antes. Sem chave pessoal, o Grok usa a chave do
            app.
          </p>
        </SettingsBlock>

        <SettingsSwitchRow
          label="Pesquisar na web ao montar o pacote"
          support="Mais lento e gasta mais da sua cota."
          checked={draft.webSearch}
          onCheckedChange={(webSearch) => patch({ webSearch })}
        />

        <details className="group">
          <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-2 text-left [&::-webkit-details-marker]:hidden hover:bg-surface-2 focus-visible:outline-offset-[-2px] first:rounded-t-2xl last:rounded-b-2xl">
            <SlidersHorizontal className="size-6 shrink-0 text-muted" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block text-base text-fg">Avançado</span>
              <span className="mt-0.5 block text-sm text-muted">
                Chaves dos outros pesquisadores.
              </span>
            </span>
            <ChevronRight
              className="size-5 shrink-0 text-muted transition-transform group-open:rotate-90"
              aria-hidden
            />
          </summary>
          <div className="flex flex-col gap-4 border-t border-border px-4 py-4">
            {OTHER_PROVIDERS.map((provider) => (
              <div key={provider.id} className="flex flex-col gap-1.5">
                <label htmlFor={`key-${provider.id}`} className="text-sm font-medium text-fg">
                  Chave {provider.label}
                </label>
                <input
                  id={`key-${provider.id}`}
                  className="h-12 w-full rounded-xl border border-border bg-surface-2 px-3 text-base text-fg placeholder:text-muted"
                  type="password"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="Opcional"
                  value={keyDraft[provider.id]}
                  onChange={(e) =>
                    setKeyDraft({ ...keyDraft, [provider.id]: e.target.value } as KeyValues)
                  }
                />
              </div>
            ))}
            <Button variant="surface" disabled={keyBusy} onClick={() => void saveKeys()}>
              {keyBusy ? "Guardando…" : "Salvar chaves"}
            </Button>
          </div>
        </details>
      </SettingsSection>

      <SettingsSection id="notificacoes" title="Notificações">
        <SettingsRow
          icon={Bell}
          label="Lembretes"
          support={reminders.hint}
          trailing={<StatusText status={reminders} />}
        />

        <SettingsButtonRow
          icon={BellRing}
          label="Ativar lembretes"
          support="Pede a permissão do sistema; você pode negar depois."
          onClick={() => void allowNotes()}
        />

        {notificationError ? (
          <SettingsBlock className="py-3">
            <InlineError copy={notificationError} onAction={() => void notificationAction()} />
          </SettingsBlock>
        ) : null}

        <SettingsRow
          icon={AlarmClock}
          label="Alarme exato"
          support={exact.hint}
          trailing={<StatusText status={exact} />}
        />
        {exact.opensSettings ? (
          <SettingsButtonRow
            icon={Cog}
            label="Abrir configurações"
            support="Permite que o aviso toque no minuto certo com a tela bloqueada."
            chevron
            onClick={() => void allowNotes({ askExact: true })}
          />
        ) : null}

        <SettingsButtonRow
          icon={BatteryCharging}
          label="Avisos atrasando? Toque aqui"
          support={battery.hint}
          // Na web o próprio apoio já explica que o ajuste é só no Android;
          // o status à direita espremeria a frase em duas ou três linhas.
          trailing={reminder?.native ? <StatusText status={battery} /> : undefined}
          chevron={battery.opensSettings}
          onClick={() => void batteryAction()}
        />
        {batteryNote ? (
          <SettingsBlock className="py-3">
            <p className="text-sm leading-relaxed text-muted" role="status">
              {batteryNote}
            </p>
          </SettingsBlock>
        ) : null}

        <SettingsBlock className="flex flex-col gap-3">
          <p className="text-sm font-medium text-fg">Horário de estudo</p>
          <div className="flex gap-3">
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <label htmlFor="study-hour" className="text-xs text-muted">
                Hora
              </label>
              <input
                id="study-hour"
                className="h-12 w-full rounded-xl border border-border bg-surface-2 px-3 text-base tabular-nums text-fg"
                type="number"
                inputMode="numeric"
                min={0}
                max={23}
                value={draft.studyHour}
                onChange={(e) => patch({ studyHour: clampHour(e.target.value) })}
              />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <label htmlFor="study-minute" className="text-xs text-muted">
                Minuto
              </label>
              <input
                id="study-minute"
                className="h-12 w-full rounded-xl border border-border bg-surface-2 px-3 text-base tabular-nums text-fg"
                type="number"
                inputMode="numeric"
                min={0}
                max={59}
                value={draft.studyMinute}
                onChange={(e) => patch({ studyMinute: clampMin(e.target.value) })}
              />
            </div>
          </div>
        </SettingsBlock>

        <SettingsSwitchRow
          label="Lembrete de início"
          support="Com o tema do dia."
          checked={draft.alerts.start}
          onCheckedChange={(start) => patch({ alerts: { ...draft.alerts, start } })}
        />
        <SettingsSwitchRow
          label="Alerta para resolver questões"
          support="Na hora das questões do bloco."
          checked={draft.alerts.questions}
          onCheckedChange={(questions) => patch({ alerts: { ...draft.alerts, questions } })}
        />
        <SettingsSwitchRow
          label="Alerta de revisão"
          support="Quando a revisão do dia começa."
          checked={draft.alerts.review}
          onCheckedChange={(review) => patch({ alerts: { ...draft.alerts, review } })}
        />
        <SettingsSwitchRow
          label="Aviso se o bloco ainda não começou"
          support="Depois de 45 min do horário de estudo."
          checked={draft.alerts.pending}
          onCheckedChange={(pending) => patch({ alerts: { ...draft.alerts, pending } })}
        />
        <SettingsSwitchRow
          label="Modo silencioso"
          support="Não agenda lembretes nem avisos."
          checked={draft.quiet}
          onCheckedChange={(quiet) => patch({ quiet })}
        />

        <SettingsBlock>
          <p className="text-sm leading-relaxed text-muted">
            {isNativeNotificationService()
              ? "No app Android os lembretes são agendados no próprio aparelho e chegam mesmo com o app fechado. Se o Android negar alarmes exatos, o aviso pode atrasar alguns minutos."
              : "No Android, no iPhone e no Windows o lembrete sai com o app aberto ou instalado enquanto o navegador segue ativo. Fechado de verdade, o alarme local não dispara: iOS só entrega push de servidor, e Chrome ou Edge não guardam o timer depois que o processo morre."}
          </p>
        </SettingsBlock>
      </SettingsSection>

      <SettingsSection id="aparencia" title="Aparência">
        <SettingsRow
          icon={Moon}
          label="Tema escuro"
          support="Sempre escuro. O modo claro está no backlog; o Reta não segue o tema do sistema."
        />
      </SettingsSection>

      <SettingsSection id="dados" title="Dados">
        <SettingsRow
          icon={Database}
          label="Armazenamento persistente"
          support={
            <>
              {storageCopy.hint}
              {storageUsage ? ` ${storageUsage}` : ""}
            </>
          }
          trailing={<StatusText status={storageCopy} />}
        />

        <SettingsBlock className="flex flex-wrap gap-2">
          <Button
            variant="surface"
            disabled={storageBusy || !storage.supported || storage.persisted === true}
            onClick={() => void requestPersist()}
          >
            {storage.persisted
              ? "Armazenamento persistente ativo"
              : storageBusy
                ? "Pedindo…"
                : "Tornar armazenamento persistente"}
          </Button>
          <Button
            variant="ghost"
            onClick={() =>
              void readStorageState().then((next) => {
                setStorage(next);
                setStorageNote("");
              })
            }
          >
            Atualizar status
          </Button>
        </SettingsBlock>
        {storageNote ? (
          <SettingsBlock className="py-3">
            <p className="text-sm leading-relaxed text-muted" role="status">
              {storageNote}
            </p>
          </SettingsBlock>
        ) : null}

        <SettingsButtonRow
          icon={Download}
          label={backupBusy ? "Preparando…" : "Exportar backup completo (.json)"}
          support="Plano, pacotes, sessões, erros e ajustes."
          disabled={backupBusy}
          onClick={() => void exportBackup()}
        />

        <SettingsButtonRow
          icon={Upload}
          label="Restaurar backup (.json)"
          support="Substitui todos os dados deste aparelho."
          disabled={backupBusy}
          onClick={() => restoreInput.current?.click()}
        />

        {backupError ? (
          <SettingsBlock className="py-3">
            <InlineError copy={backupError} onAction={backupAction} />
          </SettingsBlock>
        ) : null}
        {backupNote ? (
          <SettingsBlock className="py-3">
            <p className="text-sm leading-relaxed text-muted" role="status">
              {backupNote}
            </p>
          </SettingsBlock>
        ) : null}

        <SettingsBlock>
          <p className="text-xs leading-relaxed text-muted">
            O backup inclui plano, pacotes, sessões, erros, ajustes, avisos e dúvidas. Restaurar
            substitui todos os dados deste aparelho. As chaves de API ficam só neste aparelho e não
            entram no arquivo.
          </p>
        </SettingsBlock>

        <SettingsLinkRow
          to="/importar"
          icon={FileSpreadsheet}
          label="Trocar planilha"
          support="Importar outra planilha substitui o plano atual."
        />
      </SettingsSection>

      <SettingsSection id="sobre" title="Sobre">
        <SettingsLinkRow
          to="/boas-vindas"
          icon={BookOpen}
          label="Rever introdução"
          support="As quatro telas de boas-vindas."
        />
        <SettingsRow
          label="Versão"
          support="Reta para Android. Seus dados ficam neste aparelho."
          trailing={appVersionLabel(__APP_VERSION__)}
        />
      </SettingsSection>
    </div>
  );
}

/** Status em texto à direita da linha, na cor do tom (ok/aviso/neutro). */
function StatusText({ status }: { status: StatusCopy }) {
  return (
    <span className={cn("font-semibold", toneClass(status.tone))}>{status.label}</span>
  );
}

function toneClass(tone: StatusTone): string {
  if (tone === "ok") return "text-primary";
  if (tone === "warn") return "text-clay-text";
  return "text-muted";
}

type StorageState = {
  supported: boolean;
  persisted: boolean | null;
  usage: number | null;
  quota: number | null;
};

async function readReminderState(): Promise<ReminderState> {
  if (!isNativeNotificationService()) {
    return {
      native: false,
      permission: notificationPermission(),
      exactAlarms: "unsupported",
      battery: null,
    };
  }
  const status = await getNativeNotificationStatus();
  return {
    native: true,
    permission: status.permission === "prompt" ? "default" : status.permission,
    exactAlarms: status.exactAlarms,
    battery: status.batteryOptimizationsIgnored,
  };
}

async function readStorageState(): Promise<StorageState> {
  if (typeof navigator === "undefined" || !navigator.storage) {
    return { supported: false, persisted: null, usage: null, quota: null };
  }
  const persisted =
    typeof navigator.storage.persisted === "function"
      ? await navigator.storage.persisted().catch(() => false)
      : false;
  const estimate =
    typeof navigator.storage.estimate === "function"
      ? await navigator.storage.estimate().catch(() => null)
      : null;
  return {
    supported: true,
    persisted,
    usage: typeof estimate?.usage === "number" ? estimate.usage : null,
    quota: typeof estimate?.quota === "number" ? estimate.quota : null,
  };
}

function formatBytes(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let n = value;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i += 1;
  }
  return `${n.toFixed(i === 0 || n >= 10 ? 0 : 1)} ${units[i]}`;
}

function clampHour(value: string): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(23, Math.max(0, Math.round(n)));
}

function clampMin(value: string): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(59, Math.max(0, Math.round(n)));
}
