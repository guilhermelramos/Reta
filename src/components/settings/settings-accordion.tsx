import { ChevronRight, SlidersHorizontal, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Acordeão dos Ajustes (item de lista M3 de 56dp).
 *
 * Usa `<details>` nativo: teclado, leitores de tela e o estado aberto/fechado
 * funcionam sem JavaScript extra. O conteúdo some no recolhido para não roubar
 * altura da tela. Usado só pela tela de Ajustes.
 */
export function SettingsAccordion({
  title,
  support,
  icon: Icon = SlidersHorizontal,
  children,
  className,
}: {
  title: string;
  support?: string;
  icon?: LucideIcon;
  children: ReactNode;
  className?: string;
}) {
  return (
    <details className={cn("group", className)}>
      <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-surface-2 focus-visible:outline-offset-[-2px] [&::-webkit-details-marker]:hidden">
        <Icon className="size-6 shrink-0 text-muted" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block text-base text-fg">{title}</span>
          {support ? (
            <span className="mt-0.5 block text-sm leading-relaxed text-muted">{support}</span>
          ) : null}
        </span>
        <ChevronRight
          className="size-5 shrink-0 text-muted transition-transform group-open:rotate-90"
          aria-hidden
        />
      </summary>
      <div className="flex flex-col gap-4 border-t border-border px-4 py-4">{children}</div>
    </details>
  );
}
