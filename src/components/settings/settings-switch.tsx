import * as Switch from "@radix-ui/react-switch";
import { cn } from "@/lib/cn";

/**
 * Switch M3 dos Ajustes.
 *
 * A linha inteira é o controle (`role="switch"` + `aria-checked` vêm do Radix),
 * com 56dp de altura mínima, rótulo à esquerda, apoio de 14px e o trilho de
 * 52×32dp à direita. O polegar tem 24dp parado e 28dp ligado.
 */
export function SettingsSwitchRow({
  label,
  support,
  checked,
  onCheckedChange,
  disabled,
  className,
}: {
  label: string;
  support?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <Switch.Root
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      className={cn(
        "group flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left transition-colors",
        "hover:bg-surface-2 focus-visible:outline-offset-[-2px] disabled:opacity-50",
        "first:rounded-t-2xl last:rounded-b-2xl",
        className,
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-base leading-snug text-fg">{label}</span>
        {support ? (
          <span className="mt-0.5 block text-sm leading-relaxed text-muted">{support}</span>
        ) : null}
      </span>
      {/* Trilho 52×32dp; o `aria-hidden` evita anunciar o desenho duas vezes. */}
      <span
        aria-hidden
        className={cn(
          "flex h-8 w-[52px] shrink-0 items-center rounded-full border border-border bg-surface-2 px-1",
          "transition-colors group-data-[state=checked]:border-primary group-data-[state=checked]:bg-primary",
          "group-disabled:opacity-70",
        )}
      >
        <Switch.Thumb
          className={cn(
            "block size-6 rounded-full bg-muted transition-all",
            "group-data-[state=checked]:size-7 group-data-[state=checked]:translate-x-4 group-data-[state=checked]:bg-primary-fg",
          )}
        />
      </span>
    </Switch.Root>
  );
}
