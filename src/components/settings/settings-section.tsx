import type { ReactNode } from "react";

/**
 * Seção de Ajustes: overline âmbar (24dp acima, 8dp abaixo) e um cartão de
 * 16dp de raio com os itens separados por linhas sutis.
 *
 * Usado só pela tela de Ajustes; a página cuida do espaçamento entre seções.
 */
export function SettingsSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  const headingId = `ajustes-${id}`;
  return (
    <section aria-labelledby={headingId}>
      <h2
        id={headingId}
        className="mb-2 text-sm font-semibold uppercase tracking-wide text-primary"
      >
        {title}
      </h2>
      <div className="flex flex-col divide-y divide-border rounded-2xl border border-border bg-surface">
        {children}
      </div>
    </section>
  );
}
