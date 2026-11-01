import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { pingAi } from "@/lib/ai/study.functions";
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
            <input className="min-h-11 w-24 rounded-xl border border-border bg-surface-2 px-3 tabular-nums" type="number" min={0} max={23} value={draft.studyHour} onChange={(e) => patch({ studyHour: clampHour(e.target.value) })} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Minuto
            <input className="min-h-11 w-24 rounded-xl border border-border bg-surface-2 px-3 tabular-nums" type="number" min={0} max={59} value={draft.studyMinute} onChange={(e) => patch({ studyMinute: clampMin(e.target.value) })} />
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
        <h2 className="text-xl">Duas IAs</h2>
        <p className="text-sm leading-relaxed text-muted">
          O Grok é o tutor: pergunta e corrige só com o pacote já pronto, sem buscar na web na sessão. O pesquisador monta o pacote antes. Sem chave pessoal, o Grok usa a chave do app.
        </p>
        <label className="flex flex-col gap-1 text-sm">
          Pesquisador
          <select className="min-h-11 rounded-xl border border-border bg-surface-2 px-3" value={draft.researcher} onChange={(e) => patch({ researcher: e.target.value as ResearcherId })}>
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
        <Link to="/importar" className="underline">Importar outra planilha</Link>
      </p>
    </div>
  );
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
  return (
    <label className="flex min-h-11 items-center justify-between gap-3 text-sm">
      <span>{label}</span>
      <input type="checkbox" className="size-5 accent-primary" checked={on} onChange={(e) => set(e.target.checked)} />
    </label>
  );
}

function Key({ label, value, set }: { label: string; value: string; set: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      {label}
      <input className="min-h-11 rounded-xl border border-border bg-surface-2 px-3" type="password" autoComplete="off" value={value} onChange={(e) => set(e.target.value)} />
    </label>
  );
}
