import { useState } from "react";
import { Button } from "@/components/ui/button";
import { conceptMapSvg, sanitizeSvg } from "@/lib/study/svg";
import type { QuizItem, StudyPackage } from "@/lib/study/types";
import { cn } from "@/lib/cn";

export function PackageView({ pkg, compact }: { pkg: StudyPackage; compact?: boolean }) {
  const [cards, setCards] = useState(false);
  const [flipped, setFlipped] = useState<number | null>(null);
  const [marks, setMarks] = useState<Record<number, "again" | "known">>({});
  const known = Object.values(marks).filter((mark) => mark === "known").length;
  const again = Object.values(marks).filter((mark) => mark === "again").length;
  const map = conceptMapSvg(pkg.concepts);
  const diagram = sanitizeSvg(pkg.diagramSvg);

  return (
    <div className="flex flex-col gap-4">
      <article className="rounded-xl border border-border bg-surface p-4">
        <p className="text-xs tracking-wide text-primary">Essência</p>
        <ul className="mt-2 flex flex-col gap-2">
          {pkg.essence.map((line) => (
            <li key={line} className="text-base leading-relaxed text-fg">{line}</li>
          ))}
        </ul>
      </article>
      {!compact && pkg.development ? (
        <article className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs tracking-wide text-muted">Desenvolvimento</p>
          <p className="mt-2 whitespace-pre-wrap text-base leading-relaxed">{pkg.development}</p>
        </article>
      ) : null}
      <article className="rounded-xl border border-border bg-surface p-4">
        <p className="text-xs tracking-wide text-muted">Conceitos</p>
        <ul className="mt-3 flex flex-col gap-3">
          {(compact ? pkg.concepts.slice(0, 3) : pkg.concepts).map((c) => (
            <li key={c.term}>
              <p className="font-semibold">
                {c.term}
                {c.symbol ? <span className="ml-2 font-display text-primary">{c.symbol}</span> : null}
              </p>
              <p className="text-sm leading-relaxed text-muted">{c.meaning}</p>
            </li>
          ))}
        </ul>
      </article>
      {pkg.formulas.length ? (
        <article className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs tracking-wide text-muted">Fórmulas</p>
          <ul className="mt-3 flex flex-col gap-3">
            {pkg.formulas.map((f) => (
              <li key={f.expr}>
                <p className="font-display text-2xl text-primary">{f.expr}</p>
                <p className="text-sm text-muted">{f.meaning}</p>
              </li>
            ))}
          </ul>
        </article>
      ) : null}
      {diagram ? (
        <figure className="rounded-xl border border-border bg-surface p-3">
          <div className="overflow-hidden rounded-lg" dangerouslySetInnerHTML={{ __html: diagram }} />
          <figcaption className="mt-2 text-xs text-muted">Diagrama</figcaption>
        </figure>
      ) : null}
      {map ? (
        <figure className="rounded-xl border border-border bg-surface p-3">
          <div dangerouslySetInnerHTML={{ __html: map }} />
          <figcaption className="mt-2 text-xs text-muted">Mapa dos conceitos</figcaption>
        </figure>
      ) : null}
      {pkg.images.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {pkg.images.map((img) => (
            <figure key={img.src} className="overflow-hidden rounded-xl border border-border bg-surface">
              <img src={img.src} alt={img.alt} className="aspect-video w-full object-cover" />
              <figcaption className="px-3 py-2 text-xs leading-relaxed text-muted">
                {img.credit} · {img.license}
                {img.sourceUrl ? (
                  <>
                    {" "}
                    <a className="underline" href={img.sourceUrl} target="_blank" rel="noreferrer">fonte</a>
                  </>
                ) : null}
              </figcaption>
            </figure>
          ))}
        </div>
      ) : null}
      {pkg.pitfalls.length ? (
        <article className="rounded-xl border border-clay/40 bg-surface p-4">
          <p className="text-xs tracking-wide text-clay-text">Pegadinhas</p>
          <ul className="mt-2 flex list-disc flex-col gap-1 pl-4 text-sm leading-relaxed">
            {pkg.pitfalls.map((p) => <li key={p}>{p}</li>)}
          </ul>
        </article>
      ) : null}
      {pkg.flashcards.length ? (
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="surface" onClick={() => setCards((v) => !v)}>
              {cards ? "Esconder cartões" : `Cartões (${pkg.flashcards.length})`}
            </Button>
            {cards && (known || again) ? (
              <p className="text-xs text-muted" aria-live="polite">
                Lembrei: {known} · Não lembrei: {again}
              </p>
            ) : null}
          </div>
          {cards ? (
            <ul className="mt-3 grid gap-3 sm:grid-cols-2">
              {pkg.flashcards.map((card, i) => {
                const mark = marks[i];
                return (
                  <li key={card.front} className="flex flex-col">
                    <button
                      type="button"
                      className={cn(
                        "min-h-24 w-full rounded-xl border bg-surface-2 p-4 text-left",
                        mark === "known" && "border-primary/60",
                        mark === "again" && "border-clay/60",
                        !mark && "border-border",
                      )}
                      onClick={() => setFlipped(flipped === i ? null : i)}
                    >
                      <span className="text-xs text-muted">
                        {flipped === i ? "Verso" : "Frente"}
                        {mark ? ` · ${mark === "known" ? "lembrei" : "revisar"}` : ""}
                      </span>
                      <span className="mt-1 block">{flipped === i ? card.back : card.front}</span>
                    </button>
                    {flipped === i ? (
                      <div className="mt-2 grid grid-cols-2 gap-2" role="group" aria-label="Como foi este cartão?">
                        <button
                          type="button"
                          className="min-h-14 rounded-xl border border-clay/50 bg-clay/10 px-3 text-base font-semibold text-clay-text"
                          onClick={() => {
                            setMarks((prev) => ({ ...prev, [i]: "again" }));
                            setFlipped(i + 1 < pkg.flashcards.length ? i + 1 : null);
                          }}
                        >
                          Não lembrei
                        </button>
                        <button
                          type="button"
                          className="min-h-14 rounded-xl bg-primary px-3 text-base font-semibold text-primary-fg"
                          onClick={() => {
                            setMarks((prev) => ({ ...prev, [i]: "known" }));
                            setFlipped(i + 1 < pkg.flashcards.length ? i + 1 : null);
                          }}
                        >
                          Lembrei
                        </button>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      ) : null}
      {pkg.sources.length ? (
        <ul className="text-xs leading-relaxed text-muted">
          {pkg.sources.map((s) => (
            <li key={s.title}>
              {s.url ? <a className="underline" href={s.url} target="_blank" rel="noreferrer">{s.title}</a> : s.title}
              {s.note ? ` — ${s.note}` : ""}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function QuestionCard({
  item,
  selected,
  confirmed,
  showHint,
  altText,
  onSelect,
  onHint,
  onOther,
  otherBusy,
}: {
  item: QuizItem;
  selected: number | null;
  confirmed: boolean;
  showHint: boolean;
  altText: string;
  onSelect: (index: number) => void;
  onHint: () => void;
  onOther: () => void;
  otherBusy: boolean;
}) {
  const diagram = sanitizeSvg(item.diagramSvg);
  return (
    <div className="flex flex-col gap-4">
      <p className="text-lg leading-relaxed">{item.prompt}</p>
      {diagram ? <div className="rounded-xl border border-border bg-surface p-3" dangerouslySetInnerHTML={{ __html: diagram }} /> : null}
      <div className="flex flex-col gap-2" role="listbox" aria-label="Alternativas">
        {item.choices.map((choice, index) => {
          const isSel = selected === index;
          const isRight = confirmed && index === item.correctIndex;
          const isWrong = confirmed && isSel && index !== item.correctIndex;
          return (
            <button
              key={choice}
              type="button"
              role="option"
              aria-selected={isSel}
              disabled={confirmed}
              onClick={() => onSelect(index)}
              className={cn(
                "min-h-12 rounded-xl border px-3 py-2 text-left",
                isRight && "border-primary bg-primary/15",
                isWrong && "border-clay text-clay-text",
                !isRight && !isWrong && isSel && "border-primary",
                !isRight && !isWrong && !isSel && "border-border bg-surface-2",
              )}
            >
              <span className="mr-2 text-muted">{index + 1}.</span>
              {choice}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted">Teclas 1 a {item.choices.length} escolhem. Enter confirma.</p>
      {!confirmed ? (
        <div>
          <Button variant="ghost" onClick={onHint}>{showHint ? "Esconder dica" : "Quero uma dica"}</Button>
          {showHint ? <p className="mt-2 rounded-xl bg-surface-2 p-3 text-sm leading-relaxed">{item.hint || "Tenta pelo conceito central do pacote."}</p> : null}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-sm font-semibold">{selected === item.correctIndex ? "Acertou." : "Ainda não."}</p>
          <p className="mt-2 text-sm leading-relaxed">{altText || item.explanation}</p>
          <Button className="mt-3" variant="surface" onClick={onOther} disabled={otherBusy}>
            {otherBusy ? "Reformulando…" : "Explique de outro jeito"}
          </Button>
        </div>
      )}
    </div>
  );
}
