import { useState } from "react";
import { useBackOverlay } from "@/lib/android/use-back-overlay";
import { Button } from "@/components/ui/button";
import { validateDiagram } from "@/lib/study/diagrams";
import { sanitizeSvg } from "@/lib/study/svg";
import type { ImageCredit, QuizItem, Subtopic } from "@/lib/study/types";

function Diagram({ svg, caption }: { svg: string; caption: string }) {
  if (!svg || !validateDiagram(svg).ok) return null;
  const clean = sanitizeSvg(svg);
  if (!clean) return null;
  return (
    <figure className="rounded-xl border border-border bg-transparent p-3">
      <div className="study-diagram" dangerouslySetInnerHTML={{ __html: clean }} />
      <figcaption className="mt-2 text-xs leading-relaxed text-muted">{caption}</figcaption>
    </figure>
  );
}

function Figure({ image, onOpen }: { image: ImageCredit; onOpen: (src: string) => void }) {
  if (!image.caption || (image.watch?.length ?? 0) < 2) return null;
  return (
    <figure className="overflow-hidden rounded-xl border border-border bg-surface">
      <button type="button" className="block w-full" onClick={() => onOpen(image.src)}>
        <img src={image.src} alt={image.alt} className="max-h-80 w-full bg-surface object-contain" />
      </button>
      <figcaption className="space-y-2 px-3 py-3 text-sm leading-relaxed">
        <p>{image.caption}</p>
        <ul className="list-disc space-y-1 pl-4 text-muted">
          {(image.watch ?? []).map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
        <p className="text-xs text-muted">
          {image.credit} · {image.license}
          {image.sourceUrl ? (
            <>
              {" "}
              <a className="underline" href={image.sourceUrl} target="_blank" rel="noreferrer">
                fonte
              </a>
            </>
          ) : null}
        </p>
      </figcaption>
    </figure>
  );
}

export function LessonView({ sub, onTrain }: { sub: Subtopic; onTrain: (item: QuizItem) => void }) {
  const [zoom, setZoom] = useState<string | null>(null);
  const zoomImage = sub.images.find((image) => image.src === zoom);

  // Visualizador de imagem em tela cheia: voltar fecha a imagem ampliada.
  useBackOverlay(zoom != null, () => setZoom(null));

  return (
    <div className="flex flex-col gap-3">
      <nav className="flex gap-2 overflow-x-auto" aria-label="Seções da aula">
        {[
          ["essencia", "Essência"],
          ["conceitos", "Conceitos"],
          ["visuais", "Visuais"],
          ["pegadinhas", "Pegadinhas"],
        ].map(([id, label]) => (
          <a key={id} href={`#${id}`} className="shrink-0 rounded-full border border-border px-3 py-2 text-xs">
            {label}
          </a>
        ))}
      </nav>
      <details id="essencia" open className="rounded-xl border border-border bg-surface p-4">
        <summary className="cursor-pointer text-xs tracking-wide text-primary">Essência</summary>
        <div className="mt-3 flex flex-col gap-4">
          {sub.beats.map((beat) => (
            <section key={beat.heading}>
              <h3 className="text-xl">{beat.heading}</h3>
              {beat.paragraphs.map((paragraph) => (
                <p key={paragraph} className="mt-2 text-base leading-relaxed">
                  {paragraph}
                </p>
              ))}
              <p className="mt-2 text-sm leading-relaxed text-muted">Na prova: {beat.whyExam}</p>
              {beat.dispute ? <p className="mt-2 text-sm leading-relaxed text-clay-text">Ponto controverso: {beat.dispute}</p> : null}
            </section>
          ))}
        </div>
      </details>

      <details id="conceitos" open className="rounded-xl border border-border bg-surface p-4">
        <summary className="cursor-pointer text-xs tracking-wide text-muted">Conceitos</summary>
        <ul className="mt-3 flex flex-col gap-4">
          {sub.concepts.map((concept) => {
            const image = sub.images.find((item) => item.relatedTerm === concept.term);
            return (
              <li key={concept.term}>
                <p className="font-semibold">
                  {concept.term}
                  {concept.symbol ? <span className="ml-2 font-display text-primary">{concept.symbol}</span> : null}
                </p>
                <p className="text-sm leading-relaxed text-muted">{concept.meaning}</p>
                {image ? (
                  <div className="mt-2">
                    <Figure image={image} onOpen={setZoom} />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </details>

      <details id="visuais" open className="rounded-xl border border-border bg-surface p-4">
        <summary className="cursor-pointer text-xs tracking-wide text-muted">Visuais</summary>
        <div className="mt-3 flex flex-col gap-3">
          <Diagram svg={sub.diagramSvg} caption="Diagrama" />
          <Diagram svg={sub.mapSvg} caption={`Mapa · ${sub.subject}. Cada seta diz a relação.`} />
        </div>
      </details>

      <details id="pegadinhas" open className="rounded-xl border border-clay/40 bg-surface p-4">
        <summary className="cursor-pointer text-xs tracking-wide text-clay-text">Pegadinhas</summary>
        <ul className="mt-3 flex flex-col gap-3">
          {sub.pitfalls.map((pit) => (
            <li key={pit.id} className="rounded-xl border border-border p-3">
              <p className="text-sm leading-relaxed">{pit.mistake}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted">{pit.why}</p>
              <Button className="mt-3" variant="clay" onClick={() => onTrain(pit.trap)}>
                Treinar esta pegadinha
              </Button>
            </li>
          ))}
        </ul>
      </details>

      {zoom && zoomImage ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/90 p-4" role="dialog" aria-label={zoomImage.alt}>
          <button type="button" className="absolute inset-0" aria-label="Fechar imagem" onClick={() => setZoom(null)} />
          <img src={zoomImage.src} alt={zoomImage.alt} className="relative max-h-[85dvh] max-w-full object-contain" />
        </div>
      ) : null}
    </div>
  );
}
