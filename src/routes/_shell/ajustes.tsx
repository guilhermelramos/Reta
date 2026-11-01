import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useId, useRef, useState } from "react";
import { ZodError } from "zod";
import { Button } from "@/components/ui/button";
import { pingAi } from "@/lib/ai/study.functions";
import { exportAll, importAll, parseBackup } from "@/lib/study/db";
import { useStudy } from "@/lib/study/store";
import type { ResearcherId, Settings } from "@/lib/study/types";

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

function SettingsPage() {
  const { settings, saveSettings } = useStudy();
  const [draft, setDraft] = useState<Settings>(settings);
  const [note, setNote] = useState("");
  const [testing, setTesting] = useState(false);
  const [storage, setStorage] = useState<StorageState>({
    supported: false,
    persisted: null,
    usage: null,
    quota: null,
  });
  const [storageBusy, setStorageBusy] = useState(false);
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupNote, setBackupNote] = useState("");
  const restoreInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let live = true;
    void readStorageState().then((next) => {
      if (live) setStorage(next);
    });
    return () => {
      live = false;
    };
  }, []);

  function patch(partial: Partial<Settings>) {
    setDraft({ ...draft, ...partial });
  }

  async function save() {
    await saveSettings(draft);
    setNote("Guardado só neste aparelho.");
  }

  async function test() {
    setTesting(true);
    setNote("");
    const key = draft.researcher === "grok" ? draft.keys.xai : draft.researcher === "perplexity" ? draft.keys.perplexity : draft.researcher === "gemini" ? draft.keys.gemini : draft.keys.claude;
    const res = await pingAi({ data: { provider: draft.researcher, userKey: key } });
    setNote(res.ok ? "Conexão ok." : res.error);
    setTesting(false);
  }

  async function allowNotes() {
    if (typeof Notification === "undefined") {
      setNote("Este navegador não mostra notificação.");
      return;
    }
    const perm = await Notification.requestPermission();
    setNote(perm === "granted" ? "Notificações ligadas." : "Permissão negada. O lembrete continua dentro do app.");
  }

  async function requestPersist() {
    if (typeof navigator === "undefined" || typeof navigator.storage?.persist !== "function") {
      setBackupNote("Este navegador não oferece armazenamento persistente.");
      return;
    }
    setStorageBusy(true);
    setBackupNote("");
    try {
      const granted = await navigator.storage.persist();
      setStorage(await readStorageState());
      setBackupNote(granted ? "Armazenamento persistente concedido." : "O navegador não concedeu. O backup manual continua valendo.");
    } catch {
      setBackupNote("Não consegui pedir armazenamento persistente.");
    } finally {
      setStorageBusy(false);
    }
  }

  async function exportBackup() {
    setBackupBusy(true);
    setBackupNote("");
    try {
      const backup = await exportAll();
      const json = JSON.stringify(backup, null, 2);
      const name = `reta-backup-${new Date().toISOString().slice(0, 10)}.json`;
      const file = new File([json], name, { type: "application/json" });

      if (typeof navigator !== "undefined" && typeof navigator.share === "function" && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: "Backup do Reta",
            text: "Backup completo dos dados do Reta.",
          });
          setBackupNote("Backup compartilhado.");
          return;
        } catch (err) {
          if (err instanceof DOMException && err.name === "AbortError") {
            setBackupNote("Compartilhamento cancelado.");
            return;
          }
          // Sem share disponível na prática: cai para o download abaixo.
        }
      }

      const url = URL.createObjectURL(file);
      const link = document.createElement("a");
      link.href = url;
      link.download = name;
      link.rel = "noopener";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 2000);
      setBackupNote(`Backup gerado (${backup.days.length} dias, ${backup.sessions.length} sessões).`);
    } catch {
      setBackupNote("Não consegui gerar o backup. Tente de novo.");
    } finally {
      setBackupBusy(false);
    }
  }

  async function restoreBackup(file: File) {
    setBackupBusy(true);
    setBackupNote("");
    try {
      if (file.size > 100_000_000) throw new Error("Arquivo grande demais (máximo 100 MB).");
      const raw: unknown = JSON.parse(await file.text());
      const backup = parseBackup(raw);
      await importAll(backup);
      setBackupNote(`Backup restaurado (${backup.days.length} dias). Recarregando…`);
      window.setTimeout(() => window.location.reload(), 900);
    } catch (err) {
      if (err instanceof ZodError) {
        const first = err.issues[0];
        const field = first?.path.join(".") || "";
        setBackupNote(
          field
            ? `Backup inválido no campo "${field}". Use o arquivo .json exportado pelo próprio Reta.`
            : "Backup inválido: o arquivo não tem o formato do Reta.",
        );
      } else if (err instanceof SyntaxError) {
        setBackupNote("O arquivo não é um JSON válido.");
      } else {
        setBackupNote(err instanceof Error ? err.message : "Não consegui restaurar esse backup.");
      }
      setBackupBusy(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <header>
        <h1 className="text-4xl">Ajustes</h1>
        <p className="mt-2 text-sm text-muted">Horário, alertas e chaves. Nada disso vai para um servidor nosso.</p>
      </header>

      <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
        <h2 className="text-xl">Horário de estudo</h2>
        <div className="flex gap-3">
          <label className="flex flex-col gap-1 text-sm">
            Hora
            <input className="min-h-12 w-24 rounded-xl border border-border bg-surface-2 px-3 tabular-nums" type="number" min={0} max={23} value={draft.studyHour} onChange={(e) => patch({ studyHour: clampHour(e.target.value) })} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Minuto
            <input className="min-h-12 w-24 rounded-xl border border-border bg-surface-2 px-3 tabular-nums" type="number" min={0} max={59} value={draft.studyMinute} onChange={(e) => patch({ studyMinute: clampMin(e.target.value) })} />
          </label>
        </div>
        <Check label="Lembrete de início, com o tema do dia" on={draft.alerts.start} set={(start) => patch({ alerts: { ...draft.alerts, start } })} />
        <Check label="Alerta para resolver questões" on={draft.alerts.questions} set={(questions) => patch({ alerts: { ...draft.alerts, questions } })} />
        <Check label="Alerta de revisão" on={draft.alerts.review} set={(review) => patch({ alerts: { ...draft.alerts, review } })} />
        <Check label="Aviso se o bloco ainda não começou" on={draft.alerts.pending} set={(pending) => patch({ alerts: { ...draft.alerts, pending } })} />
        <Check label="Modo silencioso" on={draft.quiet} set={(quiet) => patch({ quiet })} />
        <Button variant="surface" onClick={() => void allowNotes()}>Permitir notificações</Button>
        <p className="text-xs leading-relaxed text-muted">
          No Android, no iPhone e no Windows o lembrete sai com o app aberto ou instalado enquanto o navegador segue ativo. Fechado de verdade, o alarme local não dispara: iOS só entrega push de servidor, e Chrome ou Edge não guardam o timer depois que o processo morre.
        </p>
      </section>

      <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
        <h2 className="text-xl">Armazenamento e backup</h2>
        <p className="text-sm leading-relaxed text-muted">
          Tudo fica no IndexedDB deste aparelho. O backup é a cópia que sobrevive a trocar de celular, limpar o navegador ou instalar de novo.
        </p>

        <div className="rounded-xl bg-surface-2 px-3 py-3 text-sm">
          <p>
            Armazenamento persistente:{" "}
            <span className={storage.persisted ? "font-semibold text-primary" : "font-semibold text-clay-text"}>
              {!storage.supported ? "não informado" : storage.persisted ? "ativo" : "ainda não concedido"}
            </span>
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            {storage.supported
              ? `Uso local: ${formatBytes(storage.usage)} de ${formatBytes(storage.quota)}.`
              : "Este navegador não expõe o estado do armazenamento. Instale o Reta na tela inicial para tratar os dados como app."}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="surface"
            disabled={storageBusy || !storage.supported || storage.persisted === true}
            onClick={() => void requestPersist()}
          >
            {storage.persisted ? "Armazenamento persistente ativo" : storageBusy ? "Pedindo…" : "Tornar armazenamento persistente"}
          </Button>
          <Button variant="ghost" onClick={() => void readStorageState().then(setStorage)}>
            Atualizar status
          </Button>
        </div>

        <div className="flex flex-col gap-2 border-t border-border pt-3">
          <Button disabled={backupBusy} onClick={() => void exportBackup()}>
            {backupBusy ? "Preparando…" : "Exportar Backup Completo (.json)"}
          </Button>
          <Button variant="surface" disabled={backupBusy} onClick={() => restoreInput.current?.click()}>
            Restaurar Backup (.json)
          </Button>
          <input
            ref={restoreInput}
            className="sr-only"
            type="file"
            accept=".json,application/json"
            onChange={(e) => {
              const file = e.currentTarget.files?.[0];
              e.currentTarget.value = "";
              if (file) void restoreBackup(file);
            }}
          />
          <p className="text-xs leading-relaxed text-muted">
            O backup inclui plano, pacotes, sessões, erros, ajustes, avisos e dúvidas. Restaurar substitui todos os dados deste aparelho.
          </p>
          {backupNote ? <p className="text-sm" role="status">{backupNote}</p> : null}
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
        <h2 className="text-xl">Duas IAs</h2>
        <p className="text-sm leading-relaxed text-muted">
          O Grok é o tutor: pergunta e corrige só com o pacote já pronto, sem buscar na web na sessão. O pesquisador monta o pacote antes. Sem chave pessoal, o Grok usa a chave do app.
        </p>
        <label className="flex flex-col gap-1 text-sm">
          Pesquisador
          <select className="min-h-12 rounded-xl border border-border bg-surface-2 px-3" value={draft.researcher} onChange={(e) => patch({ researcher: e.target.value as ResearcherId })}>
            {PROVIDERS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </label>
        <Check label="Pesquisar na web ao montar o pacote (mais lento, gasta mais)" on={draft.webSearch} set={(webSearch) => patch({ webSearch })} />
        <Key label="Chave xAI (opcional)" value={draft.keys.xai} set={(xai) => patch({ keys: { ...draft.keys, xai } })} />
        <Key label="Chave Perplexity" value={draft.keys.perplexity} set={(perplexity) => patch({ keys: { ...draft.keys, perplexity } })} />
        <Key label="Chave Gemini" value={draft.keys.gemini} set={(gemini) => patch({ keys: { ...draft.keys, gemini } })} />
        <Key label="Chave Claude" value={draft.keys.claude} set={(claude) => patch({ keys: { ...draft.keys, claude } })} />
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void save()}>Salvar</Button>
          <Button variant="surface" disabled={testing} onClick={() => void test()}>{testing ? "Testando…" : "Testar conexão"}</Button>
        </div>
        {note ? <p className="text-sm">{note}</p> : null}
      </section>

      <p className="text-sm">
        <Link to="/importar" className="inline-flex min-h-12 items-center underline">Importar outra planilha</Link>
      </p>
    </div>
  );
}

type StorageState = {
  supported: boolean;
  persisted: boolean | null;
  usage: number | null;
  quota: number | null;
};

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

function Check({ label, on, set }: { label: string; on: boolean; set: (v: boolean) => void }) {
  const id = useId();
  return (
    <label htmlFor={id} className="flex min-h-12 cursor-pointer items-center justify-between gap-3 text-sm">
      <span>{label}</span>
      {/* Visual de 20px; a linha inteira do label é o alvo de toque. */}
      <input id={id} type="checkbox" className="size-5 accent-primary" checked={on} onChange={(e) => set(e.target.checked)} />
    </label>
  );
}

function Key({ label, value, set }: { label: string; value: string; set: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      {label}
      <input className="min-h-12 rounded-xl border border-border bg-surface-2 px-3" type="password" autoComplete="off" value={value} onChange={(e) => set(e.target.value)} />
    </label>
  );
}
