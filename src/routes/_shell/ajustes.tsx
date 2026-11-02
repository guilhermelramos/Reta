import { createFileRoute } from "@tanstack/react-router";
import {
  AlarmClock,
  BatteryCharging,
  Bell,
  BookOpen,
  Cog,
  Database,
  Download,
  FileSpreadsheet,
  KeyRound,
  Upload,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ZodError } from "zod";
import { Button } from "@/components/ui/button";
import { ButtonSpinner } from "@/components/feedback/button-spinner";
import { InlineError } from "@/components/feedback/inline-error";
import { ConfirmDialog } from "@/components/settings/confirm-dialog";
import { SettingsAccordion } from "@/components/settings/settings-accordion";
import {
  SettingsBlock,
  SettingsButtonRow,
  SettingsLinkRow,
  SettingsRow,
} from "@/components/settings/settings-row";
import { SettingsSection } from "@/components/settings/settings-section";
import { SettingsSwitchRow } from "@/components/settings/settings-switch";
import { pingAiClient } from "@/lib/ai/xai-client";
import { describeError, genericCopy, type ErrorCopy } from "@/lib/feedback/error-copy";
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
import { ensurePersistentStorage } from "@/lib/study/storage";
import { useStudy } from "@/lib/study/store";
import type { ResearcherId, Settings } from "@/lib/study/types";
import { cn } from "@/lib/cn";
import {
  alertLock,
  alertLockHint,
  appVersionLabel,
  batteryStatus,
  canSaveKey,
  exactAlarmStatus,
  formatStudyTimeTyping,
  keySaveLabel,
  keySaveNeedsConfirm,
  keyStatus,
  notificationsCard,
  parseStudyTime,
  storageStatus,
  studyTimeValue,
  testConnectionLabel,
  testConnectionMessage,
  type NotificationsCard as NotificationsCardCopy,
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

const LOADING_NOTIFICATIONS: NotificationsCardCopy = {
  ...LOADING_STATUS,
  action: null,
  actionLabel: null,
};

/** Qual ação destrutiva está esperando confirmação no diálogo M3. */
type KeyConfirm = "remove" | "replace";

function SettingsPage() {
  const { settings, keys, saveSettings, days, sessions, notifyLog } = useStudy();
  // O shell só monta as telas depois de ler o IndexedDB e o cofre de chaves,
  // então estes valores já chegam preenchidos. A partir daqui o formulário é a
  // cópia local: as edições são gravadas pelo serviço existente (`saveSettings`).
  const [draft, setDraft] = useState<Settings>(settings);
  const draftRef = useRef(draft);
  // Texto do campo de horário: mostra sempre "14:00" (24 h), independente do
  // locale do aparelho. O modelo continua em `studyHour`/`studyMinute`.
  const [timeDraft, setTimeDraft] = useState(() =>
    studyTimeValue(settings.studyHour, settings.studyMinute),
  );
  const [keyDraft, setKeyDraft] = useState<KeyValues>(keys);
  // Último conjunto de chaves que o formulário pediu para gravar. Os switches
  // gravam ajustes e chaves na mesma chamada; sem esta referência, alternar um
  // switch logo após "Salvar chave" regravaria as chaves antigas.
  const keysRef = useRef<KeyValues>(keys);
  const [note, setNote] = useState("");
  const [keyBusy, setKeyBusy] = useState(false);
  const [keyConfirm, setKeyConfirm] = useState<KeyConfirm | null>(null);
  const [testing, setTesting] = useState(false);
  const [testState, setTestState] = useState<TestState>("idle");
  const [testError, setTestError] = useState<ErrorCopy | null>(null);
  const [saveError, setSaveError] = useState<ErrorCopy | null>(null);
  const [reminder, setReminder] = useState<ReminderState | null>(null);
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
  // Arquivo escolhido que só é aplicado depois do "Substituir dados".
  const [pendingRestore, setPendingRestore] = useState<File | null>(null);
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
      if (live) setReminder(next);
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
      void readReminderState().then(setReminder);
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

  /** Digitação do horário: formata "1400" → "14:00" e grava quando completo. */
  function editStudyTime(raw: string) {
    const text = formatStudyTimeTyping(raw);
    setTimeDraft(text);
    const parsed = parseStudyTime(text);
    if (parsed) patch({ studyHour: parsed.hour, studyMinute: parsed.minute });
  }

  /** Ao sair do campo, volta ao valor salvo quando o texto está incompleto. */
  function commitStudyTime() {
    const parsed = parseStudyTime(timeDraft);
    if (parsed) {
      setTimeDraft(studyTimeValue(parsed.hour, parsed.minute));
      return;
    }
    setTimeDraft(studyTimeValue(draftRef.current.studyHour, draftRef.current.studyMinute));
  }

  function retrySave() {
    const pending = lastSave.current;
    if (!pending) return;
    void enqueueSave(pending.settings, pending.keys, pending.message);
  }

  /**
   * `scope: "all"` grava também a chave xAI; o "Salvar chaves" do acordeão
   * grava só as chaves opcionais e nunca apaga a xAI por acidente.
   */
  async function saveKeys(scope: "all" | "others" = "all") {
    setKeyBusy(true);
    setNote("");
    const nextKeys: KeyValues =
      scope === "all"
        ? { ...keyDraft }
        : {
            ...keysRef.current,
            perplexity: keyDraft.perplexity,
            gemini: keyDraft.gemini,
            claude: keyDraft.claude,
          };
    keysRef.current = nextKeys;
    const ok = await enqueueSave({ ...draftRef.current }, nextKeys, KEYS_SAVE_ERROR);
    if (ok) {
      setNote(
        scope === "others"
          ? "Chaves guardadas só neste aparelho."
          : nextKeys.xai.trim()
            ? "Guardado só neste aparelho."
            : "Chave removida deste aparelho.",
      );
    }
    setKeyBusy(false);
  }

  /** O botão principal só chama o diálogo quando a chave salva vai mudar. */
  function requestSaveKeys() {
    if (!canSaveKey(keyDraft.xai)) return;
    if (keySaveNeedsConfirm(keys.xai, keyDraft.xai)) {
      setKeyConfirm("replace");
      return;
    }
    void saveKeys("all");
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

  async function confirmKeyAction() {
    const action = keyConfirm;
    setKeyConfirm(null);
    if (action === "remove") await removeXaiKey();
    if (action === "replace") await saveKeys("all");
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
    return next;
  }

  async function allowNotes(options?: { askExact?: boolean }) {
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
    if (permission === "granted") setNote("Notificações ligadas.");
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
      // Restaurar também é uma gravação grande: pede o armazenamento
      // persistente antes de recarregar a página.
      void ensurePersistentStorage();
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
          restoreFailure(
            err instanceof Error ? err.message : "Não consegui restaurar esse backup.",
          ),
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
  const native = reminder?.native ?? isNativeNotificationService();
  const notifications = reminder
    ? notificationsCard(reminder.permission, reminder.native)
    : LOADING_NOTIFICATIONS;
  const lock = reminder ? alertLock(reminder.permission, draft.quiet) : "permission";
  const lockHint = alertLockHint(lock);
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
          Horário, avisos, chaves e backup. Nada disso vai para um servidor nosso.
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

      {note ? (
        <p className="text-sm leading-relaxed text-muted" role="status">
          {note}
        </p>
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
          // Confirma depois de escolher o arquivo e só então aplica: o seletor
          // do Android não fica esperando um diálogo do app.
          if (file) setPendingRestore(file);
        }}
      />

      <SettingsSection id="estudo" title="Estudo e notificações">
        <SettingsBlock className="flex flex-col gap-2">
          <label htmlFor="study-time" className="text-base font-medium text-fg">
            Horário de estudo
          </label>
          <input
            id="study-time"
            className={cn(
              "h-12 w-full max-w-[14rem] rounded-xl border border-border bg-surface-2 px-3 text-base tabular-nums text-fg",
              lock ? "opacity-[0.38]" : null,
            )}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            spellCheck={false}
            placeholder="14:00"
            maxLength={5}
            aria-disabled={lock ? true : undefined}
            disabled={lock != null}
            value={timeDraft}
            onBlur={commitStudyTime}
            onChange={(e) => editStudyTime(e.currentTarget.value)}
          />
          <p className="text-sm leading-relaxed text-muted">
            Formato 24 h, por exemplo 14:00. É o horário que os lembretes do dia usam.
          </p>
          {lockHint ? <p className="text-sm leading-relaxed text-muted">{lockHint}</p> : null}
        </SettingsBlock>

        <SettingsBlock className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-base font-semibold text-fg">
              <Bell className="size-5 shrink-0 text-muted" aria-hidden />
              Permissão de notificações
            </p>
            <span
              className={cn(
                "shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
                badgeClass(notifications.tone),
              )}
            >
              {notifications.label}
            </span>
          </div>
          <p className="text-sm leading-relaxed text-muted">{notifications.hint}</p>
          {notifications.actionLabel ? (
            <Button
              variant="tonal"
              className="self-start"
              onClick={() => {
                if (notifications.action === "request") void allowNotes();
                if (notifications.action === "settings") void notificationAction();
              }}
            >
              {notifications.actionLabel}
            </Button>
          ) : null}
        </SettingsBlock>

        <SettingsSwitchRow
          label="Lembrete de início"
          support="Com o tema do dia."
          checked={draft.alerts.start}
          disabled={lock != null}
          onCheckedChange={(start) => patch({ alerts: { ...draft.alerts, start } })}
        />
        <SettingsSwitchRow
          label="Alerta para resolver questões"
          support="Na hora das questões do bloco."
          checked={draft.alerts.questions}
          disabled={lock != null}
          onCheckedChange={(questions) => patch({ alerts: { ...draft.alerts, questions } })}
        />
        <SettingsSwitchRow
          label="Alerta de revisão"
          support="Quando a revisão do dia começa."
          checked={draft.alerts.review}
          disabled={lock != null}
          onCheckedChange={(review) => patch({ alerts: { ...draft.alerts, review } })}
        />
        <SettingsSwitchRow
          label="Aviso se o bloco ainda não começou"
          support="Depois de 45 min do horário de estudo."
          checked={draft.alerts.pending}
          disabled={lock != null}
          onCheckedChange={(pending) => patch({ alerts: { ...draft.alerts, pending } })}
        />
        <SettingsSwitchRow
          label="Modo silencioso"
          support="Não agenda lembretes nem avisos."
          checked={draft.quiet}
          onCheckedChange={(quiet) => patch({ quiet })}
        />

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

        {!native ? (
          <SettingsBlock>
            <p className="text-sm leading-relaxed text-muted">
              No Android, no iPhone e no Windows o lembrete sai com o app aberto ou instalado
              enquanto o navegador segue ativo. Fechado de verdade, o alarme local não dispara: iOS
              só entrega push de servidor, e Chrome ou Edge não guardam o timer depois que o
              processo morre.
            </p>
          </SettingsBlock>
        ) : null}
      </SettingsSection>

      <SettingsSection id="dados" title="Plano e dados">
        <SettingsLinkRow
          to="/importar"
          icon={FileSpreadsheet}
          label="Trocar planilha"
          support="Importar outra planilha substitui o plano atual."
        />

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

        <SettingsAccordion
          icon={Database}
          title="Avançado"
          support="Uso local e armazenamento persistente."
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-base text-fg">Armazenamento persistente</p>
              <p className="mt-0.5 text-sm leading-relaxed text-muted">
                {storageCopy.hint}
                {storageUsage ? ` ${storageUsage}` : ""}
              </p>
            </div>
            <span className="shrink-0 text-sm text-muted">
              <StatusText status={storageCopy} />
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
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
          </div>
          {storageNote ? (
            <p className="text-sm leading-relaxed text-muted" role="status">
              {storageNote}
            </p>
          ) : null}
        </SettingsAccordion>
      </SettingsSection>

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
            <Button
              disabled={keyBusy || !canSaveKey(keyDraft.xai)}
              className="disabled:bg-fg/[0.12] disabled:text-fg/[0.38] disabled:opacity-100"
              onClick={requestSaveKeys}
            >
              {keyBusy ? "Guardando…" : keySaveLabel(configured)}
            </Button>
            {configured ? (
              <Button variant="clay" disabled={keyBusy} onClick={() => setKeyConfirm("remove")}>
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
        </SettingsBlock>

        <SettingsAccordion
          title="Avançado"
          support="Quem monta o pacote e as chaves dos outros pesquisadores."
        >
          <div className="flex flex-col gap-2">
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
          </div>

          <SettingsSwitchRow
            className="px-0"
            label="Pesquisar na web ao montar o pacote"
            support="Mais lento e gasta mais da sua cota."
            checked={draft.webSearch}
            onCheckedChange={(webSearch) => patch({ webSearch })}
          />

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
          <Button
            variant="surface"
            className="self-start"
            disabled={keyBusy}
            onClick={() => void saveKeys("others")}
          >
            {keyBusy ? "Guardando…" : "Salvar chaves"}
          </Button>
        </SettingsAccordion>
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

      <ConfirmDialog
        open={keyConfirm === "remove"}
        title="Remover a chave xAI?"
        description="Os recursos de IA deixam de funcionar até você colar outra chave. O resto dos seus dados continua neste aparelho."
        confirmLabel="Remover chave"
        busy={keyBusy}
        onCancel={() => setKeyConfirm(null)}
        onConfirm={() => void confirmKeyAction()}
      />

      <ConfirmDialog
        open={keyConfirm === "replace"}
        title="Substituir a chave salva?"
        description="A chave atual será trocada pela que está no campo. O uso continua sendo cobrado na sua conta xAI."
        confirmLabel="Substituir chave"
        busy={keyBusy}
        onCancel={() => setKeyConfirm(null)}
        onConfirm={() => void confirmKeyAction()}
      />

      <ConfirmDialog
        open={pendingRestore != null}
        title="Substituir todos os dados?"
        description="O plano atual, as sessões e os erros deste aparelho serão substituídos pelo backup."
        confirmLabel="Substituir dados"
        busy={backupBusy}
        onCancel={() => setPendingRestore(null)}
        onConfirm={() => {
          const file = pendingRestore;
          setPendingRestore(null);
          if (file) void restoreBackup(file);
        }}
      />
    </div>
  );
}

/** Status em texto à direita da linha, na cor do tom (ok/aviso/neutro). */
function StatusText({ status }: { status: StatusCopy }) {
  return <span className={cn("font-semibold", toneClass(status.tone))}>{status.label}</span>;
}

function toneClass(tone: StatusTone): string {
  if (tone === "ok") return "text-primary";
  if (tone === "warn") return "text-clay-text";
  return "text-muted";
}

/** Badge do cartão de permissão: fundo tonal conforme o estado real. */
function badgeClass(tone: StatusTone): string {
  if (tone === "ok") return "border-primary/60 bg-primary-tonal text-primary";
  if (tone === "warn") return "border-clay/60 bg-clay/15 text-clay-text";
  return "border-border bg-surface-2 text-muted";
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
