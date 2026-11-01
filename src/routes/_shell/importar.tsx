import { createFileRoute } from "@tanstack/react-router";
import { Download } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  applyManualMap,
  applyMap,
  buildTemplateWorkbook,
  COLUMN_FIELDS,
  guessMap,
  manualHeaders,
  pickSheet,
  readWorkbook,
} from "@/lib/study/parse-sheet";
import { useStudy } from "@/lib/study/store";
import { formatMin, formatShortDate } from "@/lib/study/time";
import type { ColumnKey, ColumnMap, PlanDay, RowWarning, SheetTable } from "@/lib/study/types";

export const Route = createFileRoute("/_shell/importar")({
  head: () => ({ meta: [{ title: "Planilha · Reta" }] }),
  component: ImportPage,
});

type ColumnField = { key: ColumnKey; label: string; required: boolean };

/** Campos pedidos no mapeamento manual, na ordem em que aparecem na planilha. */
const MANUAL_FIELDS: ColumnField[] = [
  { key: "date", label: "Data", required: true },
  { key: "contentA", label: "Bloco A (Conteúdo)", required: true },
  { key: "minA", label: "Bloco A (Minutos)", required: true },
  { key: "contentB", label: "Bloco B (Conteúdo)", required: true },
  { key: "minB", label: "Bloco B (Minutos)", required: true },
  { key: "contentR", label: "Revisão", required: true },
];

const OPTIONAL_FIELDS: ColumnField[] = COLUMN_FIELDS.filter(
  (field) => !MANUAL_FIELDS.some((manual) => manual.key === field.key),
).map((field) => ({ ...field, required: false }));

function ImportPage() {
  const { importDays, days, startPrep } = useStudy();
  const [sheets, setSheets] = useState<SheetTable[]>([]);
  const [sheetName, setSheetName] = useState("");
  const [map, setMap] = useState<ColumnMap | null>(null);
  const [manual, setManual] = useState(false);
  const [fileError, setFileError] = useState("");
  const [saved, setSaved] = useState<PlanDay[] | null>(null);
  const [busy, setBusy] = useState(false);

  const sheet = sheets.find((s) => s.name === sheetName) ?? null;
  const labels = sheet ? (manual ? manualHeaders(sheet) : sheet.headers) : [];
  const preview = useMemo(() => {
    if (!sheet || !map) return null;
    if (manual) return applyManualMap(sheet, map);
    if (sheet.headerRow < 0) return null;
    return applyMap(sheet.matrix, sheet.headerRow, map);
  }, [sheet, map, manual]);

  async function onFile(file: File) {
    setFileError("");
    setSaved(null);
    if (file.size > 5_000_000) {
      setFileError("Arquivo grande demais (máximo 5 MB).");
      return;
    }
    try {
      const tables = readWorkbook(await file.arrayBuffer());
      const usable = tables.filter((t) => t.matrix.length > 0);
      if (!usable.length) {
        setSheets([]);
        setSheetName("");
        setMap(null);
        setManual(false);
        setFileError("Não achei nenhuma aba com dados. Confira o arquivo.");
        return;
      }
      const best = pickSheet(usable);
      const target = best ?? usable[0]!;
      const autoMap = best ? guessMap(best.headers) : null;
      const needsManual = !autoMap || autoMap.date == null || autoMap.contentA == null;
      setSheets(usable);
      setSheetName(target.name);
      setManual(needsManual);
      setMap(needsManual ? guessMap(manualHeaders(target)) : autoMap);
    } catch {
      setFileError("Não consegui ler essa planilha. Use .xlsx ou .csv.");
    }
  }

  async function confirm() {
    if (!preview?.days.length) return;
    setBusy(true);
    try {
      await importDays(preview.days);
      setSaved(preview.days);
    } catch {
      setFileError("A planilha foi lida, mas não salvei no aparelho.");
    } finally {
      setBusy(false);
    }
  }

  function downloadTemplate() {
    try {
      const bytes = buildTemplateWorkbook();
      const blob = new Blob([bytes], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "reta-planilha-modelo.xlsx";
      link.rel = "noopener";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch {
      setFileError("Não consegui gerar a planilha modelo. Tente de novo.");
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <header>
        <h1 className="text-4xl">Planilha</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Entram só data, conteúdo A, B e revisão, com o tempo de cada um. Leitura entra se a coluna existir — dá para tirar no mapeamento. Reimportar troca o plano e mantém o histórico de estudo.
        </p>
        <p className="mt-2 text-xs text-muted">{days.length} dias no plano atual.</p>
      </header>

      <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface px-4 text-center">
        <span className="font-semibold">Escolher .xlsx ou .csv</span>
        <span className="mt-1 text-xs text-muted">Datas em dd/mm/aaaa, aaaa-mm-dd ou nativas do Excel. Tempos como 40min, 1h30, 90 ou 01:30.</span>
        <input
          className="sr-only"
          type="file"
          accept=".xlsx,.xls,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void onFile(file);
          }}
        />
      </label>
      {fileError ? <p className="text-sm text-clay-text">{fileError}</p> : null}

      <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4">
        <p className="text-sm font-semibold">Primeira vez? Comece pelo modelo.</p>
        <p className="text-xs leading-relaxed text-muted">
          A planilha modelo já vem com as colunas que o Reta reconhece: Data, Bloco A, Min A, Bloco B, Min B e Revisão.
        </p>
        <Button className="self-start" variant="surface" onClick={downloadTemplate}>
          <Download aria-hidden className="size-4" />
          Baixar Planilha Modelo (.xlsx)
        </Button>
      </div>

      {sheet && map ? (
        <section className="flex flex-col gap-4">
          {sheets.length > 1 ? (
            <label className="flex flex-col gap-1 text-sm">
              Aba
              <select className="min-h-11 rounded-xl border border-border bg-surface-2 px-3" value={sheetName} onChange={(e) => {
                const next = sheets.find((s) => s.name === e.target.value);
                setSheetName(e.target.value);
                if (!next) return;
                const nextManual = manual || next.headerRow < 0;
                setManual(nextManual);
                setMap(guessMap(nextManual ? manualHeaders(next) : next.headers));
              }}>
                {sheets.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
              </select>
            </label>
          ) : null}

          {manual ? (
            <div className="rounded-xl border border-clay/40 bg-clay/10 px-3 py-2.5 text-sm leading-relaxed text-clay-text">
              Não reconheci os cabeçalhos desta planilha. Escolha abaixo qual coluna é cada coisa — a prévia atualiza na hora.
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            {(manual ? MANUAL_FIELDS : COLUMN_FIELDS).map((field) => (
              <FieldSelect
                key={field.key}
                field={field}
                map={map}
                labels={labels}
                onChange={(value) => setMap({ ...map, [field.key]: value })}
              />
            ))}
          </div>

          {manual && OPTIONAL_FIELDS.length ? (
            <details className="rounded-xl border border-border bg-surface px-3 py-2">
              <summary className="cursor-pointer text-sm font-semibold">Campos opcionais</summary>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {OPTIONAL_FIELDS.map((field) => (
                  <FieldSelect
                    key={field.key}
                    field={field}
                    map={map}
                    labels={labels}
                    onChange={(value) => setMap({ ...map, [field.key]: value })}
                  />
                ))}
              </div>
            </details>
          ) : null}

          <Preview days={preview?.days ?? []} warnings={preview?.warnings ?? []} />
          <Button onClick={() => void confirm()} disabled={busy || !preview?.days.length}>
            {busy ? "Salvando…" : `Importar ${preview?.days.length ?? 0} dias`}
          </Button>
        </section>
      ) : null}

      {saved ? (
        <section className="rounded-xl border border-primary/40 bg-surface p-4">
          <p className="font-semibold">Plano atualizado. O histórico de sessões continua aqui.</p>
          <Button className="mt-3" variant="surface" onClick={() => startPrep(saved[0]?.date ?? "")}>
            Preparar os próximos 7 dias
          </Button>
        </section>
      ) : null}
    </div>
  );
}

function FieldSelect({
  field,
  map,
  labels,
  onChange,
}: {
  field: ColumnField;
  map: ColumnMap;
  labels: string[];
  onChange: (value: number | null) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      {field.label}
      <select
        className="min-h-11 rounded-xl border border-border bg-surface-2 px-3"
        value={map[field.key] ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
      >
        <option value="">{field.required ? "Escolha a coluna" : "Não importar"}</option>
        {labels.map((label, index) => (
          <option key={`${label}-${index}`} value={index}>{label || `Coluna ${index + 1}`}</option>
        ))}
      </select>
    </label>
  );
}

function Preview({ days, warnings }: { days: PlanDay[]; warnings: RowWarning[] }) {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-xl">Prévia</h2>
      <ul className="flex flex-col gap-2 text-sm">
        {days.slice(0, 6).map((day) => (
          <li key={day.date} className="rounded-xl bg-surface-2 px-3 py-2">
            <span className="text-muted">{formatShortDate(day.date)}</span>
            {day.blocks.map((b) => (
              <span key={b.kind} className="mt-1 block">{b.kind}: {b.content.slice(0, 72)} · {formatMin(b.plannedMin)}</span>
            ))}
          </li>
        ))}
      </ul>
      {days.length > 6 ? <p className="text-xs text-muted">e mais {days.length - 6} dias</p> : null}
      {warnings.length ? (
        <div>
          <p className="text-sm text-clay-text">{warnings.length} avisos — a importação segue.</p>
          <ul className="mt-1 text-xs text-muted">
            {warnings.slice(0, 8).map((w) => <li key={`${w.row}-${w.message}`}>Linha {w.row}: {w.message}</li>)}
          </ul>
        </div>
      ) : <p className="text-xs text-muted">Nenhuma linha inválida.</p>}
    </div>
  );
}
