import { ExternalLink, KeyRound, ListTree } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ButtonSpinner } from "@/components/feedback/button-spinner";
import { InlineError } from "@/components/feedback/inline-error";
import { ConfirmDialog } from "@/components/settings/confirm-dialog";
import { ModelExplorerSheet } from "@/components/settings/model-explorer-sheet";
import { cn } from "@/lib/cn";
import { describeError, type ErrorCopy } from "@/lib/feedback/error-copy";
import {
  listModels,
  type OpenRouterModel,
} from "@/lib/ai/openrouter/client";
import { presetForModel } from "@/lib/ai/openrouter/explorer";
import { loadCachedModels, saveModels } from "@/lib/ai/openrouter/model-cache";
import {
  STUDY_PRESETS,
  resolvePreset,
  studyPreset,
  type StudyPresetId,
} from "@/lib/ai/openrouter/presets";
import { defaultTransport } from "@/lib/ai/openrouter/transport";
import { aiKeyStatus } from "@/lib/ui/settings-status";
import { maskKey, validateOpenRouterKey } from "@/lib/secure/keys";

const CREATE_KEY_URL = "https://openrouter.ai/settings/keys";

/**
 * Configuração do OpenRouter reaproveitada por Ajustes e pela introdução.
 *
 * A chave (`sk-or-…`) é gravada pelo chamador no cofre seguro; este componente
 * só valida o formato, testa a conexão pelo `GET /api/v1/models`, carrega o
 * catálogo e salva a escolha de modelo. Nenhuma chave é colocada em log.
 */
export function OpenRouterSetup({
  savedKey,
  model,
  fallbacks,
  onSaveKey,
  onRemoveKey,
  onChooseModel,
  compact = false,
}: {
  savedKey: string;
  model: string;
  fallbacks: string[];
  onSaveKey: (value: string) => Promise<void>;
  onRemoveKey: () => Promise<void>;
  onChooseModel: (model: string, fallbacks: string[]) => Promise<void> | void;
  /** Na introdução, esconde o explorador para caber na tela. */
  compact?: boolean;
}) {
  const [draft, setDraft] = useState(savedKey);
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testState, setTestState] = useState<"idle" | "success" | "error">("idle");
  const [testError, setTestError] = useState<ErrorCopy | null>(null);
  const [note, setNote] = useState("");
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [catalog, setCatalog] = useState<OpenRouterModel[]>(() => loadCachedModels() ?? []);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState("");
  const [explorerOpen, setExplorerOpen] = useState(false);
  const [presetBusy, setPresetBusy] = useState<StudyPresetId | null>(null);

  useEffect(() => {
    setDraft(savedKey);
  }, [savedKey]);

  const check = validateOpenRouterKey(draft);
  const status = aiKeyStatus("openrouter", savedKey);
  const currentPreset = useMemo(() => presetForModel(model, catalog), [model, catalog]);
  const keyForRequest = draft.trim() || savedKey.trim();

  function online(): boolean {
    return typeof navigator === "undefined" || navigator.onLine !== false;
  }

  async function paste() {
    try {
      const text = await navigator.clipboard.readText();
      if (text.trim()) setDraft(text.trim());
    } catch {
      // Sem permissão de área de transferência: a pessoa cola manualmente.
    }
  }

  async function loadCatalog(force = false): Promise<OpenRouterModel[] | null> {
    if (!force && catalog.length) return catalog;
    setCatalogLoading(true);
    setCatalogError("");
    try {
      const models = await listModels(defaultTransport(), keyForRequest ? { key: keyForRequest } : {});
      setCatalog(models);
      saveModels(models);
      setTestState("success");
      return models;
    } catch (error) {
      setCatalogError(describeError(error, { online: online() }).message);
      return null;
    } finally {
      setCatalogLoading(false);
    }
  }

  async function saveKey() {
    if (!check.ok || busy) {
      if (!check.ok) setNote(check.message);
      return;
    }
    setBusy(true);
    setNote("");
    try {
      await onSaveKey(check.value);
      setNote("Chave guardada só neste aparelho.");
      setTestState("idle");
      setTestError(null);
    } catch {
      setNote("Não consegui guardar a chave com segurança neste aparelho.");
    } finally {
      setBusy(false);
    }
  }

  async function removeKey() {
    setBusy(true);
    setNote("");
    try {
      await onRemoveKey();
      setDraft("");
      setNote("Chave removida deste aparelho.");
      setTestState("idle");
      setTestError(null);
    } catch {
      setNote("Não consegui remover a chave deste aparelho.");
    } finally {
      setBusy(false);
      setConfirmRemove(false);
    }
  }

  async function test() {
    if (testing) return;
    setTesting(true);
    setTestState("idle");
    setTestError(null);
    setNote("");
    if (!keyForRequest) {
      setTesting(false);
      setTestState("error");
      setTestError(describeError("Cole a chave do OpenRouter.", { online: online() }));
      return;
    }
    try {
      // GET /api/v1/models com a chave do campo (ou a salva) confirma o login.
      const models = await listModels(defaultTransport(), { key: keyForRequest });
      setCatalog(models);
      saveModels(models);
      setTestState("success");
      setNote(
        `Catálogo acessível — ${models.length} modelos. O OpenRouter confere a chave na primeira chamada de chat.`,
      );
    } catch (error) {
      setTestState("error");
      setTestError(describeError(error, { online: online() }));
    } finally {
      setTesting(false);
    }
  }

  async function choosePreset(id: StudyPresetId) {
    if (presetBusy) return;
    setPresetBusy(id);
    setNote("");
    try {
      const models = await loadCatalog();
      if (!models) return;
      const choice = resolvePreset(id, models);
      if (!choice) {
        setNote(
          id === "vision"
            ? "Nenhum modelo com visão no catálogo agora. Use outro preset ou explore o catálogo."
            : "Nenhum modelo grátis no catálogo agora. Use outro preset ou explore o catálogo.",
        );
        return;
      }
      await onChooseModel(choice.model, choice.fallbacks);
      setNote(`Modelo salvo: ${choice.model}.`);
    } catch {
      setNote("Não consegui salvar o modelo neste aparelho. Tente de novo.");
    } finally {
      setPresetBusy(null);
    }
  }

  async function chooseModel(id: string) {
    try {
      await onChooseModel(id, []);
      setNote(`Modelo salvo: ${id}.`);
    } catch {
      setNote("Não consegui salvar o modelo neste aparelho. Tente de novo.");
    }
  }

  async function explore() {
    const models = await loadCatalog();
    if (models) setExplorerOpen(true);
  }

  return (
    <>
      <div className="flex flex-col gap-3 px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <p className="flex min-w-0 items-center gap-2 text-base font-semibold text-fg">
            <KeyRound className="size-5 shrink-0 text-muted" aria-hidden />
            Chave do OpenRouter
          </p>
          <span
            className={cn(
              "shrink-0 text-sm font-semibold",
              status.configured ? "text-primary" : "text-muted",
            )}
          >
            {status.configured ? status.label : "Não configurada"}
          </span>
        </div>

        {status.configured ? (
          <p className="text-sm leading-relaxed text-muted">
            Chave salva: <span className="tabular-nums text-fg">{maskKey(savedKey)}</span>.{" "}
            {status.hint}
          </p>
        ) : (
          <p className="text-sm leading-relaxed text-muted">{status.hint}</p>
        )}

        <label htmlFor="openrouter-key" className="text-sm font-medium text-fg">
          {status.configured ? "Colar ou trocar a chave" : "Colar a chave"}
        </label>
        <div className="flex gap-2">
          <input
            id="openrouter-key"
            className="h-12 min-w-0 flex-1 rounded-xl border border-border bg-surface-2 px-3 text-base text-fg placeholder:text-muted"
            type="password"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="sk-or-…"
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
              setTestState("idle");
              setTestError(null);
            }}
          />
          <Button variant="surface" className="shrink-0" onClick={() => void paste()}>
            Colar
          </Button>
        </div>
        <p className="text-xs leading-relaxed text-muted">
          A chave fica só neste aparelho, no cofre seguro. O uso é cobrado na sua conta OpenRouter.
        </p>

        <div className="flex flex-wrap gap-2">
          <Button
            disabled={busy || !check.ok}
            className="disabled:bg-fg/[0.12] disabled:text-fg/[0.38] disabled:opacity-100"
            onClick={() => void saveKey()}
          >
            {busy ? "Guardando…" : status.configured ? "Atualizar chave" : "Salvar"}
          </Button>
          {status.configured ? (
            <Button variant="clay" disabled={busy} onClick={() => setConfirmRemove(true)}>
              Remover chave
            </Button>
          ) : null}
          <Button
            variant="surface"
            disabled={testing || !keyForRequest}
            aria-disabled={testing || !keyForRequest ? true : undefined}
            className="disabled:border-transparent disabled:bg-fg/[0.12] disabled:text-fg/[0.38] disabled:opacity-100"
            onClick={() => void test()}
          >
            {testing ? (
              <>
                <ButtonSpinner />
                Testando…
              </>
            ) : testState === "success" ? (
              "Conexão ok"
            ) : (
              "Testar conexão"
            )}
          </Button>
        </div>

        <a
          href={CREATE_KEY_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-12 items-center gap-1.5 self-start text-sm font-semibold text-primary underline-offset-4 hover:underline"
        >
          Criar chave no OpenRouter
          <ExternalLink className="size-4" aria-hidden />
        </a>

        {testError ? <InlineError copy={testError} /> : null}
        {note ? (
          <p className="text-sm leading-relaxed text-muted" role="status">
            {note}
          </p>
        ) : null}
      </div>

      {!compact ? (
        <div className="flex flex-col gap-3 px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-base font-semibold text-fg">
              <ListTree className="size-5 shrink-0 text-muted" aria-hidden />
              Modelo
            </p>
            <Button variant="ghost" className="min-h-12 px-2 text-sm" onClick={() => void explore()}>
              Explorar modelos
            </Button>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            {STUDY_PRESETS.map((preset) => {
              const active = currentPreset === preset.id;
              const loading = presetBusy === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  aria-pressed={active}
                  disabled={presetBusy != null}
                  onClick={() => void choosePreset(preset.id)}
                  className={cn(
                    "flex min-h-24 flex-col gap-1 rounded-xl border p-3 text-left transition-colors",
                    active
                      ? "border-primary/70 bg-primary-tonal"
                      : "border-border bg-surface-2 hover:border-primary/40",
                    presetBusy != null && !loading && "opacity-60",
                  )}
                >
                  <span className="flex items-center gap-2 text-sm font-semibold text-fg">
                    {loading ? <ButtonSpinner /> : null}
                    {studyPreset(preset.id).label}
                  </span>
                  <span className="text-xs leading-relaxed text-muted">{preset.description}</span>
                </button>
              );
            })}
          </div>

          <p className="break-all text-xs leading-relaxed text-muted">
            {model ? (
              <>
                Modelo atual: <span className="text-fg">{model}</span>
                {fallbacks.length ? ` · reserva: ${fallbacks.join(", ")}` : ""}
              </>
            ) : (
              "Sem modelo escolhido: o OpenRouter usa openrouter/auto."
            )}
          </p>

          {catalogLoading ? (
            <p className="text-xs text-muted" role="status">
              Baixando o catálogo…
            </p>
          ) : null}
          {catalogError ? (
            <p className="text-xs leading-relaxed text-clay-text" role="alert">
              {catalogError}
            </p>
          ) : null}
        </div>
      ) : null}

      <ModelExplorerSheet
        open={explorerOpen}
        models={catalog}
        selected={model}
        loading={catalogLoading}
        error={catalogError}
        onClose={() => setExplorerOpen(false)}
        onChoose={(value) => void chooseModel(value)}
      />

      <ConfirmDialog
        open={confirmRemove}
        title="Remover a chave do OpenRouter?"
        description="Os recursos de IA no OpenRouter deixam de funcionar até você colar outra chave. O resto dos seus dados continua neste aparelho."
        confirmLabel="Remover chave"
        busy={busy}
        onCancel={() => setConfirmRemove(false)}
        onConfirm={() => void removeKey()}
      />
    </>
  );
}
