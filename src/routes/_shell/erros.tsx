import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useStudy } from "@/lib/study/store";
import { formatClock, formatShortDate } from "@/lib/study/time";
import { KIND_LABEL } from "@/lib/study/types";

export const Route = createFileRoute("/_shell/erros")({
  head: () => ({ meta: [{ title: "Erros · Reta" }] }),
  component: ErrorsPage,
});

function ErrorsPage() {
  const { mistakes, reviewMistake } = useStudy();
  const open = mistakes.filter((m) => !m.reviewed).sort((a, b) => b.createdAt - a.createdAt);
  const [review, setReview] = useState(false);
  const [index, setIndex] = useState(0);
  const [show, setShow] = useState(false);
  const [left, setLeft] = useState(5 * 60);
  const item = open[index];

  useEffect(() => {
    if (!review) return;
    const id = window.setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearInterval(id);
  }, [review]);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <header>
        <h1 className="text-4xl">Caderno de erros</h1>
        <p className="mt-2 text-sm text-muted">{open.length} para refazer. A revisão relâmpago dura 5 minutos e não cria agenda nova.</p>
      </header>
      {!review ? (
        <>
          <Button disabled={!open.length} onClick={() => { setReview(true); setIndex(0); setShow(false); setLeft(5 * 60); }}>
            Revisão relâmpago
          </Button>
          <ul className="flex flex-col gap-2">
            {mistakes.slice().sort((a, b) => b.createdAt - a.createdAt).map((m) => (
              <li key={m.id} className="rounded-xl border border-border bg-surface p-3">
                <p className="text-xs text-muted">{formatShortDate(m.date)} · {KIND_LABEL[m.kind]}{m.reviewed ? " · revisto" : ""}</p>
                <p className="mt-1 text-sm leading-relaxed">{m.prompt}</p>
              </li>
            ))}
          </ul>
          {!mistakes.length ? <p className="text-sm text-muted">Nenhum erro guardado ainda. Eles aparecem quando você erra na sessão.</p> : null}
        </>
      ) : (
        <section className="rounded-xl border border-border bg-surface p-4">
          <p className="tabular-nums text-sm text-primary" role="timer">{formatClock(left)}</p>
          {!item || left === 0 ? (
            <>
              <h2 className="mt-3 text-2xl">{left === 0 ? "Os 5 minutos acabaram." : "Fila vazia."}</h2>
              <Button className="mt-4" variant="surface" onClick={() => setReview(false)}>Voltar ao caderno</Button>
            </>
          ) : (
            <>
              <p className="mt-3 text-lg leading-relaxed">{item.prompt}</p>
              {!show ? (
                <Button className="mt-4" onClick={() => setShow(true)}>Mostrar o gabarito</Button>
              ) : (
                <div className="mt-4">
                  <p className="text-sm">Certa: {item.choices[item.correctIndex]}</p>
                  <p className="mt-2 text-sm text-muted">Sua tentativa: {item.choices[item.userIndex] ?? "—"}</p>
                  <p className="mt-2 text-sm leading-relaxed">{item.explanation}</p>
                  <Button className="mt-4" onClick={() => {
                    void reviewMistake(item.id);
                    setShow(false);
                    setIndex((n) => n + 1);
                  }}>Próxima</Button>
                </div>
              )}
            </>
          )}
        </section>
      )}
    </div>
  );
}
