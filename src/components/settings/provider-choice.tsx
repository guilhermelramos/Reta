import { cn } from "@/lib/cn";
import { AI_PROVIDERS, aiProviderLabel, type AiProvider } from "@/lib/ai/provider";

/**
 * Seletor segmentado xAI | OpenRouter (M3).
 *
 * A xAI é o padrão e o cartão da chave dela continua idêntico quando está
 * selecionada. Cada segmento é um botão de 48dp com `aria-pressed`, para o
 * TalkBack anunciar o provedor ativo sem depender só da cor.
 */
export function ProviderChoice({
  value,
  onChange,
  disabled = false,
  className,
}: {
  value: AiProvider;
  onChange: (provider: AiProvider) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label="Provedor de IA"
      className={cn(
        "grid grid-cols-2 gap-1 rounded-xl border border-border bg-surface-2 p-1",
        className,
      )}
    >
      {AI_PROVIDERS.map((provider) => {
        const active = provider === value;
        return (
          <button
            key={provider}
            type="button"
            aria-pressed={active}
            disabled={disabled}
            onClick={() => {
              if (!active) onChange(provider);
            }}
            className={cn(
              "min-h-12 rounded-lg px-3 text-sm font-semibold transition-colors",
              active
                ? "bg-primary text-primary-fg shadow-sm"
                : "text-muted hover:bg-surface hover:text-fg",
              disabled && "opacity-50",
            )}
          >
            {aiProviderLabel(provider)}
          </button>
        );
      })}
    </div>
  );
}
