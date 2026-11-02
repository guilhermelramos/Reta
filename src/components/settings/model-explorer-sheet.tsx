import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Check, Search, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import type { OpenRouterModel } from "@/lib/ai/openrouter/client";
import {
  EXPLORER_SORT_LABELS,
  contextLabel,
  exploreModels,
  priceLabel,
  validateManualModelId,
  type ExplorerSort,
} from "@/lib/ai/openrouter/explorer";
import { useBackOverlay } from "@/lib/android/use-back-overlay";

/**
 * Folha "Explorar modelos" do OpenRouter.
 *
 * Busca por nome/id, chips "Grátis"/"Lê imagens", ordenação por preço e uma
 * saída para digitar o ID manualmente. A escolha sobe por `onChoose` e o
 * chamador grava as preferências; a folha não toca em rede nem em cofre.
 */
export function ModelExplorerSheet({
  open,
  models,
  selected,
  loading = false,
  error = "",
  onClose,
  onChoose,
}: {
  open: boolean;
  models: readonly OpenRouterModel[];
  selected: string;
  loading?: boolean;
  error?: string;
  onClose: () => void;
  onChoose: (model: string) => void;
}) {
  useBackOverlay(open, onClose);
  const [query, setQuery] = useState("");
  const [freeOnly, setFreeOnly] = useState(false);
  const [visionOnly, setVisionOnly] = useState(false);
  const [sort, setSort] = useState<ExplorerSort>("relevance");
  const [manualOpen, setManualOpen] = useState(false);
  const [manual, setManual] = useState("");
  const manualCheck = validateManualModelId(manual);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setFreeOnly(false);
    setVisionOnly(false);
    setSort("relevance");
    setManualOpen(false);
    setManual("");
  }, [open]);

  const filtered = useMemo(
    () => exploreModels(models, { query, freeOnly, visionOnly, sort }),
    [models, query, freeOnly, visionOnly, sort],
  );

  function choose(model: string) {
    onChoose(model);
    onClose();
  }

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/70" />
        <DialogPrimitive.Content
          className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[88dvh] w-full max-w-[600px] flex-col rounded-t-[28px] border border-border bg-surface outline-none"
          aria-describedby={undefined}
        >
          <div className="flex items-start gap-3 border-b border-border px-4 pb-3 pt-4">
            <div className="min-w-0 flex-1">
              <DialogPrimitive.Title className="text-2xl leading-tight">
                Explorar modelos
              </DialogPrimitive.Title>
              <p className="mt-1 text-sm leading-relaxed text-muted">
                Catálogo do OpenRouter com preço por 1M de tokens.
              </p>
            </div>
            <DialogPrimitive.Close
              aria-label="Fechar explorador de modelos"
              className="session-icon-button -mr-2 -mt-2 text-muted hover:text-fg"
            >
              <X className="size-5" aria-hidden />
            </DialogPrimitive.Close>
          </div>

          <div className="flex flex-col gap-3 border-b border-border px-4 py-3">
            <label htmlFor="openrouter-model-search" className="sr-only">
              Buscar modelo
            </label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
                aria-hidden
              />
              <input
                id="openrouter-model-search"
                type="search"
                className="h-12 w-full rounded-xl border border-border bg-surface-2 pl-9 pr-3 text-base text-fg placeholder:text-muted"
                placeholder="Buscar por nome ou id"
                autoComplete="off"
                spellCheck={false}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Chip active={freeOnly} onClick={() => setFreeOnly((value) => !value)}>
                Grátis
              </Chip>
              <Chip active={visionOnly} onClick={() => setVisionOnly((value) => !value)}>
                Lê imagens
              </Chip>
              <label className="ml-auto flex items-center gap-1.5 text-xs text-muted">
                <SlidersHorizontal className="size-4" aria-hidden />
                <span className="sr-only">Ordenar por</span>
                <select
                  className="h-10 rounded-lg border border-border bg-surface-2 px-2 text-sm text-fg"
                  value={sort}
                  onChange={(event) => setSort(event.target.value as ExplorerSort)}
                >
                  {(Object.keys(EXPLORER_SORT_LABELS) as ExplorerSort[]).map((value) => (
                    <option key={value} value={value}>
                      {EXPLORER_SORT_LABELS[value]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2">
            {loading ? (
              <p className="px-3 py-6 text-sm text-muted" role="status">
                Baixando o catálogo do OpenRouter…
              </p>
            ) : error ? (
              <p className="px-3 py-6 text-sm leading-relaxed text-clay-text" role="alert">
                {error}
              </p>
            ) : filtered.length ? (
              <ul className="flex flex-col">
                {filtered.map((item) => {
                  const active = item.id === selected;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => choose(item.id)}
                        className={cn(
                          "flex w-full min-h-14 items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-surface-2",
                          active && "bg-primary-tonal",
                        )}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-1.5">
                            <span className="text-base font-semibold leading-snug text-fg">
                              {item.name}
                            </span>
                            {item.free ? <Badge>Grátis</Badge> : null}
                            {item.supportsImages ? <Badge>Lê imagens</Badge> : null}
                          </span>
                          <span className="mt-0.5 block break-all text-xs leading-relaxed text-muted">
                            {item.id}
                          </span>
                          <span className="mt-1 block text-xs text-muted">
                            {priceLabel(item)}
                            {contextLabel(item) ? ` · ${contextLabel(item)}` : ""}
                          </span>
                        </span>
                        {active ? (
                          <Check className="mt-1 size-5 shrink-0 text-primary" aria-label="Selecionado" />
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="px-3 py-6 text-sm leading-relaxed text-muted">
                Nenhum modelo com esses filtros. Limpe a busca ou desligue um chip.
              </p>
            )}
          </div>

          <div className="border-t border-border px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
            {manualOpen ? (
              <div className="flex flex-col gap-2">
                <label htmlFor="manual-model" className="text-sm font-medium text-fg">
                  ID do modelo
                </label>
                <input
                  id="manual-model"
                  className="h-12 w-full rounded-xl border border-border bg-surface-2 px-3 text-base text-fg placeholder:text-muted"
                  placeholder="autor/modelo"
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={manual}
                  onChange={(event) => setManual(event.target.value)}
                />
                <p className="text-xs leading-relaxed text-muted">
                  Use o id exato do catálogo, por exemplo{" "}
                  <span className="text-fg">meta-llama/llama-3.3-70b-instruct:free</span>.
                </p>
                <Button
                  disabled={!manualCheck.ok}
                  className="disabled:bg-fg/[0.12] disabled:text-fg/[0.38] disabled:opacity-100"
                  onClick={() => {
                    if (manualCheck.ok) choose(manualCheck.value);
                  }}
                >
                  Usar este ID
                </Button>
              </div>
            ) : (
              <Button variant="ghost" className="w-full" onClick={() => setManualOpen(true)}>
                Digitar ID manualmente
              </Button>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "min-h-10 rounded-full border px-3 text-sm font-semibold transition-colors",
        active
          ? "border-primary/70 bg-primary-tonal text-primary"
          : "border-border bg-surface-2 text-muted hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}

function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-border bg-surface px-1.5 py-0.5 text-xs font-semibold text-muted">
      {children}
    </span>
  );
}
