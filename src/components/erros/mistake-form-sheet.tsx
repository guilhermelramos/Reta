import { X } from "lucide-react";
import { useState } from "react";
import { Drawer } from "vaul";
import { ButtonSpinner } from "@/components/feedback/button-spinner";
import { InlineError } from "@/components/feedback/inline-error";
import { ErrorReasonPicker } from "@/components/mistake-reason";
import { Button } from "@/components/ui/button";
import { useBackOverlay } from "@/lib/android/use-back-overlay";
import type { ErrorCopy } from "@/lib/feedback/error-copy";
import { validateMistakePrompt } from "@/lib/study/error-notebook";
import type { ErrorReason } from "@/lib/study/types";

export type MistakeDraft = {
  subject: string;
  topic: string;
  prompt: string;
  marked: string;
  answerKey: string;
  reason: ErrorReason | "";
};

const EMPTY_MISTAKE_DRAFT: MistakeDraft = {
  subject: "",
  topic: "",
  prompt: "",
  marked: "",
  answerKey: "",
  reason: "",
};

/**
 * Bottom sheet M3 de novo erro / edição. O mesmo formulário serve para o erro
 * externo (simulado impresso, PDF ou dúvida) e para corrigir um item já salvo;
 * os campos têm 48dp e o motivo é escolha única em chips.
 */
export function MistakeFormSheet({
  open,
  mode,
  initial,
  onClose,
  onSave,
}: {
  open: boolean;
  mode: "create" | "edit";
  initial?: MistakeDraft;
  onClose: () => void;
  /** Devolve `null` ao salvar ou o texto do erro para manter a folha aberta. */
  onSave: (draft: MistakeDraft) => Promise<ErrorCopy | null>;
}) {
  useBackOverlay(open, onClose);

  const [draft, setDraft] = useState<MistakeDraft>(() => initial ?? EMPTY_MISTAKE_DRAFT);
  const [validation, setValidation] = useState("");
  const [saveError, setSaveError] = useState<ErrorCopy | null>(null);
  const [saving, setSaving] = useState(false);

  function setField<K extends keyof MistakeDraft>(key: K, value: MistakeDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function submit() {
    const invalid = validateMistakePrompt(draft.prompt);
    if (invalid) {
      setValidation(invalid);
      return;
    }
    setValidation("");
    setSaveError(null);
    setSaving(true);
    try {
      const error = await onSave(draft);
      if (error) setSaveError(error);
    } catch {
      setSaveError({
        kind: "unknown",
        title: "Não deu para salvar",
        message: "Não consegui guardar este erro no aparelho. Tente de novo.",
      });
    } finally {
      setSaving(false);
    }
  }

  const creating = mode === "create";

  return (
    <Drawer.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-[55] bg-black/60" />
        <Drawer.Content className="fixed inset-x-0 bottom-0 z-[60] mx-auto flex max-h-[90dvh] w-full max-w-2xl flex-col rounded-t-[28px] border border-border bg-surface">
          <Drawer.Handle className="mx-auto mt-3 h-1.5 w-12 shrink-0 rounded-full bg-border" />
          <div className="flex items-start justify-between gap-3 px-5 pt-2">
            <div className="min-w-0">
              <Drawer.Title className="text-2xl leading-snug">
                {creating ? "Registrar erro" : "Editar erro"}
              </Drawer.Title>
              <Drawer.Description className="mt-1 text-sm leading-relaxed text-muted">
                {creating
                  ? "Simulado impresso, PDF ou dúvida fora do app. Entra no mesmo caderno e na repetição espaçada."
                  : "Ajuste o enunciado e a classificação. A próxima revisão continua agendada."}
              </Drawer.Description>
            </div>
            <Drawer.Close asChild>
              <button
                type="button"
                aria-label="Fechar"
                className="grid size-12 shrink-0 place-items-center rounded-full text-fg transition-colors hover:bg-surface-2"
              >
                <X className="size-6" aria-hidden />
              </button>
            </Drawer.Close>
          </div>

          <form
            className="mt-4 flex min-h-0 flex-1 flex-col"
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-5 pb-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field
                  label="Matéria"
                  value={draft.subject}
                  placeholder="Ex.: Biologia"
                  onChange={(value) => setField("subject", value)}
                />
                <Field
                  label="Tópico"
                  value={draft.topic}
                  placeholder="Ex.: Genética"
                  onChange={(value) => setField("topic", value)}
                />
              </div>
              <Field
                label="Resumo da questão ou dúvida"
                value={draft.prompt}
                placeholder="O que a questão pedia, em uma ou duas frases"
                onChange={(value) => setField("prompt", value)}
                multiline
                required
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <Field
                  label="O que eu marquei"
                  value={draft.marked}
                  placeholder="Alternativa ou raciocínio"
                  onChange={(value) => setField("marked", value)}
                />
                <Field
                  label="Gabarito"
                  value={draft.answerKey}
                  placeholder="Resposta certa"
                  onChange={(value) => setField("answerKey", value)}
                />
              </div>
              <ErrorReasonPicker
                label="Motivo do erro (opcional)"
                value={draft.reason || undefined}
                allowClear
                onChange={(reason) => setField("reason", reason)}
                onClear={() => setField("reason", "")}
              />
            </div>
            <div className="shrink-0 border-t border-border px-5 py-3 pb-[calc(0.75rem_+_env(safe-area-inset-bottom))]">
              {validation ? (
                <p role="alert" className="mb-2 text-sm leading-relaxed text-clay-text">
                  {validation}
                </p>
              ) : null}
              {saveError ? <InlineError copy={saveError} className="mb-2" /> : null}
              <Button type="submit" variant="tonal" className="w-full" disabled={saving}>
                {saving ? <ButtonSpinner /> : null}
                {saving ? "Salvando…" : creating ? "Salvar no caderno" : "Salvar alterações"}
              </Button>
            </div>
          </form>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

type FieldProps = {
  label: string;
  value: string;
  placeholder: string;
  multiline?: boolean;
  required?: boolean;
  onChange: (value: string) => void;
};

function Field({ label, value, placeholder, multiline, required, onChange }: FieldProps) {
  const className =
    "min-h-12 w-full rounded-xl border border-border bg-bg px-3 text-sm text-fg placeholder:text-muted";
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-muted">
        {label}
        {required ? " *" : ""}
      </span>
      {multiline ? (
        <textarea
          value={value}
          placeholder={placeholder}
          aria-required={required || undefined}
          onChange={(event) => onChange(event.target.value)}
          className={`${className} min-h-24 py-2`}
        />
      ) : (
        <input
          value={value}
          placeholder={placeholder}
          aria-required={required || undefined}
          onChange={(event) => onChange(event.target.value)}
          className={className}
        />
      )}
    </label>
  );
}
