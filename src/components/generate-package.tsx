import { useState } from "react";
import { Layers, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { generateBlockPackage, toStudyPackage } from "@/lib/ai/package.functions";
import { useStudy } from "@/lib/study/store";
import type { BlockKind, Flashcard } from "@/lib/study/types";

/**
 * Botão "Gerar Aula, Flashcards e Questões com IA" para blocos que ainda não
 * têm pacote rico no IndexedDB. O pacote gerado é salvo na hora (`savePackage`
 * via `saveBuilt`) e passa a funcionar 100% offline neste aparelho.
 */
export function GeneratePackage({
  date,
  kind,
  topic,
  minutes,
}: {
  date: string;
  kind: BlockKind;
  topic: string;
  minutes: number;
}) {
  const study = useStudy();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function generate() {
    if (busy) return;
    setError("");
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setError("Sem internet agora. O pacote já gerado fica salvo no aparelho; para gerar um novo, conecte-se.");
      return;
    }
    setBusy(true);
    try {
      const res = await generateBlockPackage({
        data: { topic, minutes, userKey: study.settings.keys.xai },
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      const pkg = toStudyPackage(res.data, { date, kind, topic, minutes });
      await study.saveBuilt(pkg);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao gerar o pacote.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-primary/40 bg-surface p-4">
      <p className="text-xs tracking-wide text-primary">Aula sob demanda</p>
      <h2 className="mt-1 text-2xl">Este bloco ainda não tem material rico</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        A IA monta um resumo focado no que mais cai no vestibular/ENEM, 5 flashcards e 4 questões A–E com
        gabarito comentado. Fica salvo no aparelho e abre offline nas próximas vezes.
      </p>
      <Button className="mt-4" disabled={busy} onClick={() => void generate()}>
        <Sparkles className="size-4" />
        {busy ? "Gerando…" : "Gerar Aula, Flashcards e Questões com IA"}
      </Button>
      <p className="mt-2 text-xs text-muted" aria-live="polite">
        {busy ? "Pode levar até um minuto. Não feche esta tela." : "Consome a IA uma única vez por bloco."}
      </p>
      {error ? <p className="mt-3 text-sm text-clay-text" role="alert">{error}</p> : null}
    </section>
  );
}

/** Cartões de revisão ativa do pacote (frente/verso), com alvos grandes para o polegar. */
export function FlashcardDeck({ cards }: { cards: Flashcard[] }) {
  const [flipped, setFlipped] = useState<number | null>(null);
  if (!cards.length) return null;
  return (
    <details className="rounded-xl border border-border bg-surface p-4">
      <summary className="flex cursor-pointer items-center gap-2 text-xs tracking-wide text-primary">
        <Layers className="size-4" />
        Flashcards ({cards.length})
      </summary>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {cards.map((card, index) => (
          <li key={`${card.front}-${index}`}>
            <button
              type="button"
              className="min-h-24 w-full rounded-xl border border-border bg-surface-2 p-4 text-left"
              onClick={() => setFlipped(flipped === index ? null : index)}
              aria-pressed={flipped === index}
            >
              <span className="text-xs text-muted">{flipped === index ? "Verso" : "Frente"}</span>
              <span className="mt-1 block text-sm leading-relaxed">{flipped === index ? card.back : card.front}</span>
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}
