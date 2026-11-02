import { Link } from "@tanstack/react-router";
import { ChevronRight, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Item de lista M3 dos Ajustes: 56dp de altura mínima, 16dp de padding,
 * ícone opcional de 24dp à esquerda e chevron à direita quando a linha
 * navega. O texto de apoio usa 14px em `muted`.
 */
const ROW =
  "flex w-full min-h-14 items-center gap-3 px-4 py-2 text-left";

const ROW_EDGES = "first:rounded-t-2xl last:rounded-b-2xl";

function RowContent({
  icon: Icon,
  label,
  support,
  trailing,
  chevron,
}: {
  icon?: LucideIcon;
  label: ReactNode;
  support?: ReactNode;
  trailing?: ReactNode;
  chevron?: boolean;
}) {
  return (
    <>
      {Icon ? <Icon className="size-6 shrink-0 text-muted" aria-hidden /> : null}
      <span className="min-w-0 flex-1">
        <span className="block text-base leading-snug text-fg">{label}</span>
        {support ? (
          <span className="mt-0.5 block text-sm leading-relaxed text-muted">{support}</span>
        ) : null}
      </span>
      {trailing ? <span className="shrink-0 text-sm text-muted">{trailing}</span> : null}
      {chevron ? <ChevronRight className="size-5 shrink-0 text-muted" aria-hidden /> : null}
    </>
  );
}

type RowCopy = {
  icon?: LucideIcon;
  label: ReactNode;
  support?: ReactNode;
  trailing?: ReactNode;
  className?: string;
};

/** Linha só informativa (sem ação). */
export function SettingsRow({ className, ...copy }: RowCopy) {
  return (
    <div className={cn(ROW, ROW_EDGES, className)}>
      <RowContent {...copy} />
    </div>
  );
}

/** Linha que executa uma ação (exportar, pedir permissão, abrir ajustes). */
export function SettingsButtonRow({
  onClick,
  disabled,
  chevron,
  className,
  ...copy
}: RowCopy & {
  onClick: () => void;
  disabled?: boolean;
  /** Use quando a ação abre outra tela (ex.: configurações do Android). */
  chevron?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        ROW,
        ROW_EDGES,
        "transition-colors hover:bg-surface-2 focus-visible:outline-offset-[-2px] disabled:opacity-50",
        className,
      )}
    >
      <RowContent {...copy} chevron={chevron} />
    </button>
  );
}

/** Linha que navega dentro do app. */
export function SettingsLinkRow({
  to,
  className,
  ...copy
}: RowCopy & { to: "/importar" | "/boas-vindas" }) {
  return (
    <Link
      to={to}
      className={cn(
        ROW,
        ROW_EDGES,
        "transition-colors hover:bg-surface-2 focus-visible:outline-offset-[-2px]",
        className,
      )}
    >
      <RowContent {...copy} chevron />
    </Link>
  );
}

/** Bloco de formulário/parágrafo dentro do cartão (mesmo padding lateral). */
export function SettingsBlock({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("px-4 py-4", className)}>{children}</div>;
}
