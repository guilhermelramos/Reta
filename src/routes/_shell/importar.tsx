import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronDown, Download, FileSpreadsheet, FileUp, Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ButtonSpinner } from "@/components/feedback/button-spinner";
import { InlineError } from "@/components/feedback/inline-error";
import { Snackbar } from "@/components/feedback/snackbar";
import { cn } from "@/lib/cn";
import {
  describeError,
  sheetErrorCopy,
  sheetProblemFromWarning,
  type ErrorCopy,
  type FeedbackAction,
} from "@/lib/feedback/error-copy";
import { saveAndShare } from "@/lib/native/files";
import {
  currentPlanSummary,
  IMPORT_UNDO_MESSAGE,
  importedMessage,
  importPreviewItems,
  importSummary,
  previewDayCount,
  recognizedColumns,
  type PreviewItem,
  type PreviewRow,
} from "@/lib/study/import-preview";
import { snapshotPlan, type PlanUndo } from "@/lib/study/import-undo";
import {
  applyManualMap,
  applyMap,
  COLUMN_FIELDS,
  guessMap,
  manualHeaderRow,
  manualHeaders,
  missingRequiredColumns,
  pickSheet,
  TEMPLATE_HEADERS,
} from "@/lib/study/parse-sheet";
import { readWorkbookOffThread, SheetReadError } from "@/lib/study/parse-sheet-client";
import { useStudy } from "@/lib/study/store";
import type {
  ColumnKey,
  ColumnMap,
  PlanDay,
  SheetTable,
} from "@/lib/study/types";

const EMPTY_FILE_MESSAGE = "O arquivo está vazio. Escolha uma planilha .xlsx ou .csv com os dias do plano.";
const CORRUPTED_FILE_MESSAGE =
  "Não consegui ler este arquivo. Ele pode estar corrompido ou não ser uma planilha .xlsx/.csv válida. Baixe a planilha modelo e tente de novo.";

export const Route = createFileRoute("/_shell/importar")({
  head: () => ({ meta: [{ title: "Importar planilha · Reta" }] }),
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
  { key: "minR", label: "Revisão (Minutos)", required: true },
];

const OPTIONAL_FIELDS: ColumnField[] = COLUMN_FIELDS.filter(
  (field) => !MANUAL_FIELDS.some((manual) => manual.key === field.key),
).map((field) => ({ ...field, required: false }));

/**
 * Linha de exemplo do formato aceito, na ordem de `TEMPLATE_HEADERS`. Só
 * ilustra a planilha; o parser continua sendo a fonte de verdade.
 */
const TEMPLATE_SAMPLE_ROW = [
  "01/11/2026",
  "Matemática",
  "60",
  "Física",
  "40",
  "Questões",
  "20",
] as const;

/** Erro de arquivo com o texto padrão da planilha e o motivo em letra menor. */
function sheetFileCopy(reason: string): ErrorCopy {
  return sheetErrorCopy({ reason });
}

function ImportPage() {
  const {
    importDays,
    undoImport,
    days: planDays,
    seeded,
    sheetName: activeSheetName,
    startPrep,
  } = useStudy();
  const [sheets, setSheets] = useState<SheetTable[]>([]);
  const [sheetName, setSheetName] = useState("");
  const [map, setMap] = useState<ColumnMap | null>(null);
  const [manual, setManual] = useState(false);
  const [fileError, setFileError] = useState<ErrorCopy | null>(null);
  const [saved, setSaved] = useState<PlanDay[] | null>(null);
  const [notice, setNotice] = useState("");
  const [noticeKey, setNoticeKey] = useState(0);
  /** Retrato do plano anterior enquanto o snackbar oferece Desfazer. */
  const [undo, setUndo] = useState<PlanUndo | null>(null);
  const [reading, setReading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [scrollToPreview, setScrollToPreview] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLElement>(null);

  const sheet = sheets.find((item) => item.name === sheetName) ?? null;
  const labels = sheet ? (manual ? manualHeaders(sheet) : sheet.headers) : [];
  const preview = useMemo(() => {
    if (!sheet || !map) return null;
    if (manual) return applyManualMap(sheet, map);
    if (sheet.headerRow < 0) return null;
    return applyMap(sheet.matrix, sheet.headerRow, map);
  }, [sheet, map, manual]);
  const missingColumns = map ? missingRequiredColumns(map) : [];
  const needsMapping = manual || missingColumns.length > 0;
  /** Arquivo lido: a seleção sai de cena e a prévia assume a primeira dobra. */
  const previewing = Boolean(sheet && map);
  const recognized = recognizedColumns(map);

  // O acordeão de colunas abre sozinho quando o mapeamento manual é
  // necessário (cabeçalho não reconhecido ou coluna obrigatória faltando).
  useEffect(() => {
    if (needsMapping) setColumnsOpen(true);
  }, [needsMapping]);

  // Depois de ler um arquivo, leva a prévia ao topo da janela sem um salto
  // seco. O pedido é consumido uma vez para não rolar a cada select alterado.
  useEffect(() => {
    if (!scrollToPreview || !sheet || !map) return;
    setScrollToPreview(false);
    previewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [scrollToPreview, sheet, map]);

  const mappingError = useMemo(() => {
    if (!sheet || !map) return null;
    const missing = missingRequiredColumns(map);
    if (!missing.length) return null;
    const missingLabels = missing.map(
      (key) => COLUMN_FIELDS.find((field) => field.key === key)?.label ?? key,
    );
    const headerRow = manual ? manualHeaderRow(sheet) : sheet.headerRow;
    return sheetErrorCopy({
      missingColumns: missingLabels,
      ...(headerRow >= 0 ? { row: headerRow + 1 } : {}),
    });
  }, [sheet, map, manual]);

  const emptySheetError = useMemo(() => {
    if (fileError || mappingError || !sheet || !map || !preview) return null;
    if (preview.days.length > 0) return null;
    const warning = preview.warnings[0];
    return sheetErrorCopy(warning ? sheetProblemFromWarning(warning) : {});
  }, [fileError, mappingError, sheet, map, preview]);

  const previewError = mappingError ?? emptySheetError;
  const summary = importSummary(preview?.days ?? []);
  const previewItems = importPreviewItems(preview?.days ?? [], preview?.warnings ?? []);
  const shownDays = previewDayCount(previewItems);
  const extraDays = summary ? summary.dayCount - shownDays : 0;
  const current = currentPlanSummary({ days: planDays, seeded, sheetName: activeSheetName });
  const canImport = Boolean(preview?.days.length) && missingColumns.length === 0;

  function showNotice(message: string) {
    setNotice(message);
    setNoticeKey((key) => key + 1);
  }

  function resetSelection() {
    setSheets([]);
    setSheetName("");
    setMap(null);
    setManual(false);
    setColumnsOpen(false);
    setFileError(null);
  }

  async function onFile(file: File) {
    setFileError(null);
    setSaved(null);
    setNotice("");
    setUndo(null);
    resetSelection();
    if (file.size === 0) {
      setFileError(sheetFileCopy(EMPTY_FILE_MESSAGE));
      return;
    }
    if (file.size > 5_000_000) {
      setFileError(sheetFileCopy("O limite é 5 MB. Escolha um arquivo menor."));
      return;
    }
    setReading(true);
    try {
      const tables = await readWorkbookOffThread(await file.arrayBuffer());
      const usable = tables.filter((table) => table.matrix.length > 0);
      if (!usable.length) {
        resetSelection();
        setFileError(sheetFileCopy(EMPTY_FILE_MESSAGE));
        return;
      }
      const best = pickSheet(usable);
      const target = best ?? usable[0]!;
      const autoMap = best ? guessMap(best.headers) : null;
      const needsManual = !autoMap || missingRequiredColumns(autoMap).length > 0;
      setSheets(usable);
      setSheetName(target.name);
      setManual(needsManual);
      setMap(needsManual ? guessMap(manualHeaders(target)) : autoMap);
      setScrollToPreview(true);
    } catch (error) {
      resetSelection();
      setFileError(
        sheetFileCopy(
          error instanceof SheetReadError && error.code === "empty"
            ? EMPTY_FILE_MESSAGE
            : CORRUPTED_FILE_MESSAGE,
        ),
      );
    } finally {
      setReading(false);
    }
  }

  async function confirm() {
    if (!preview?.days.length || missingColumns.length) return;
    const importedSheet = sheet?.name ?? "";
    const importedDays = preview.days;
    // Retrato de antes da substituição: o snackbar Desfazer devolve este plano
    // e o meta.activeSheet/seeded, sem tocar em sessões, pacotes ou erros.
    const previous = snapshotPlan({
      days: planDays,
      sheetName: activeSheetName,
      seeded,
    });
    setBusy(true);
    setFileError(null);
    try {
      await importDays(importedDays, importedSheet);
      setUndo(previous);
      setSaved(importedDays);
      showNotice(importedMessage(importedDays.length));
      resetSelection();
    } catch {
      setFileError(describeError("A planilha foi lida, mas não salvei no aparelho."));
    } finally {
      setBusy(false);
    }
  }

  async function undoLastImport() {
    if (!undo) return;
    const snapshot = undo;
    setUndo(null);
    try {
      await undoImport(snapshot);
      setSaved(null);
      showNotice(IMPORT_UNDO_MESSAGE);
    } catch {
      setFileError(describeError("Não consegui restaurar o plano anterior."));
    }
  }

  async function downloadTemplate() {
    setFileError(null);
    try {
      // Carrega o gerador do .xlsx só ao clicar: o `xlsx` não entra no bundle
      // inicial da tela (a leitura da planilha do usuário roda no Worker).
      const { buildTemplateWorkbook } = await import("@/lib/study/parse-sheet-workbook");
      const bytes = buildTemplateWorkbook();
      const mime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      const blob = new Blob([bytes], { type: mime });
      await saveAndShare("reta-planilha-modelo.xlsx", mime, blob);
    } catch {
      setFileError({
        ...describeError("Não consegui gerar a planilha modelo. Tente de novo."),
        action: { id: "download-template", label: "Baixar modelo" },
      });
    }
  }

  function handleErrorAction(action: FeedbackAction) {
    if (action.id === "choose-file") fileInput.current?.click();
    else if (action.id === "download-template") void downloadTemplate();
    else if (action.id === "retry") void confirm();
  }

  function changeSheet(name: string) {
    const next = sheets.find((item) => item.name === name);
    setSheetName(name);
    if (!next) return;
    const nextManual = manual || next.headerRow < 0;
    setManual(nextManual);
    setMap(guessMap(nextManual ? manualHeaders(next) : next.headers));
  }

  return (
    <div className="mx-auto flex w-full max-w-[600px] flex-col gap-5">
      <header>
        <p className="text-sm text-muted">Plano de estudo</p>
        <h1 className="mt-1 text-3xl leading-tight">Importar planilha</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Colunas usadas: Data, Bloco A, Bloco B, Revisão e os minutos de cada um.
        </p>
      </header>

      {/*
        O seletor fica sempre montado: na prévia ele é acionado pelo botão
        "Trocar arquivo", e as ações de erro ("Escolher outro arquivo") também
        dependem dele, mesmo com a área de escolha recolhida.
      */}
      <input
        ref={fileInput}
        id="import-file"
        className="sr-only"
        type="file"
        disabled={reading}
        accept=".xlsx,.xls,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        onChange={(e) => {
          const file = e.currentTarget.files?.[0];
          e.currentTarget.value = "";
          if (file) void onFile(file);
        }}
      />

      {!previewing ? (
        <>
          <section
            aria-labelledby="plano-atual"
            className="rounded-2xl border border-border bg-surface p-4"
          >
            <div className="flex items-start gap-3">
              <FileSpreadsheet
                className={cn(
                  "mt-0.5 size-6 shrink-0",
                  current.imported ? "text-primary" : "text-muted",
                )}
                aria-hidden
              />
              <div className="min-w-0">
                <h2
                  id="plano-atual"
                  className="text-xs font-semibold uppercase tracking-wide text-muted"
                >
                  Plano atual
                </h2>
                <p className="mt-1 break-words text-lg leading-snug text-fg">{current.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted">{current.detail}</p>
              </div>
            </div>
          </section>

          <section className="flex flex-col gap-3" aria-label="Escolher planilha">
            <label
              htmlFor="import-file"
              aria-disabled={reading}
              aria-busy={reading}
              className={cn(
                "flex min-h-[120px] cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-[1.5px] border-dashed border-border bg-surface px-4 py-5 text-center transition-colors hover:border-primary/60",
                reading && "pointer-events-none opacity-80",
              )}
            >
              {reading ? (
                <Loader2 className="size-8 animate-spin text-primary" aria-hidden />
              ) : (
                <FileSpreadsheet className="size-8 text-primary" aria-hidden />
              )}
              <span className="text-base font-semibold" aria-live="polite">
                {reading ? "Lendo planilha…" : "Escolher arquivo .xlsx"}
              </span>
              <span className="text-xs leading-relaxed text-muted">
                Também aceita .xls e .csv. Datas em dd/mm/aaaa e tempos como 40 min, 1h30 ou
                01:30.
              </span>
            </label>

            <TemplateFormatTable />

            <Button
              variant="surface"
              className="w-full"
              disabled={reading || busy}
              onClick={() => void downloadTemplate()}
            >
              <Download className="size-5" aria-hidden />
              Baixar modelo
            </Button>
          </section>
        </>
      ) : null}

      {fileError ? (
        <InlineError
          copy={fileError}
          onAction={handleErrorAction}
          secondaryAction={fileError.secondaryAction}
        />
      ) : null}

      {previewing && sheet && map ? (
        <section
          ref={previewRef}
          aria-labelledby="previa-planilha"
          className="flex scroll-mt-2 flex-col gap-2.5 rounded-2xl border border-border bg-surface p-4"
        >
          <div className="flex items-center justify-between gap-3">
            <p
              title={sheet.name}
              className="min-w-0 truncate text-xs font-semibold uppercase tracking-wide text-primary"
            >
              Pré-visualização
              <span className="font-normal normal-case tracking-normal text-muted">
                {" · "}
                {sheet.name}
              </span>
            </p>
            <Button
              variant="surface"
              className="shrink-0 px-3"
              disabled={reading}
              onClick={() => fileInput.current?.click()}
            >
              <FileUp className="size-5" aria-hidden />
              Trocar arquivo
            </Button>
          </div>
          <h2 id="previa-planilha" className="text-2xl leading-snug">
            Confira antes de importar
          </h2>

          {previewError ? (
            <InlineError
              copy={previewError}
              onAction={handleErrorAction}
              secondaryAction={previewError.secondaryAction}
            />
          ) : null}

          {summary ? (
            <p className="rounded-xl bg-surface-2 px-3 py-2 text-sm font-semibold leading-snug text-fg">
              {summary.label}
            </p>
          ) : null}

          {previewItems.length ? (
            <ul className="flex flex-col gap-2">
              {previewItems.map((item) => (
                <PreviewItemRow key={item.key} item={item} />
              ))}
            </ul>
          ) : null}
          {extraDays > 0 ? (
            <p className="text-xs text-muted">
              e mais {extraDays} {extraDays === 1 ? "dia" : "dias"}
            </p>
          ) : null}

          <details
            className="group border-t border-border"
            open={columnsOpen}
            onToggle={(event) => setColumnsOpen(event.currentTarget.open)}
          >
            <summary
              aria-expanded={columnsOpen}
              className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 py-0.5 [&::-webkit-details-marker]:hidden"
            >
              <span className="min-w-0">
                <span className="block text-sm font-medium leading-tight text-fg">
                  Ajustar colunas
                </span>
                <span
                  className={cn(
                    "mt-0.5 block text-xs leading-tight",
                    manual ? "text-clay-text" : "text-muted",
                  )}
                >
                  {manual
                    ? "Cabeçalhos não reconhecidos · escolha as colunas"
                    : recognized.label}
                </span>
              </span>
              <ChevronDown
                className={cn(
                  "size-6 shrink-0 text-muted transition-transform duration-200",
                  columnsOpen && "rotate-180",
                )}
                aria-hidden
              />
            </summary>
            <div className="pb-3 pt-2">
              <ColumnControls
                sheet={sheet}
                sheets={sheets}
                sheetName={sheetName}
                manual={manual}
                map={map}
                labels={labels}
                onChangeSheet={changeSheet}
                onChangeMap={(key, value) => setMap({ ...map, [key]: value })}
              />
            </div>
          </details>

          <div className="flex flex-col gap-2 border-t border-border pt-3">
            {planDays.length ? (
              <p className="text-xs leading-relaxed text-muted">
                Ao importar, esta planilha substitui o plano atual. O histórico de sessões e erros
                continua aqui.
              </p>
            ) : null}
            <div className="flex flex-col gap-2 sm:flex-row-reverse">
              <Button
                className="sm:flex-1"
                disabled={busy || reading || !canImport}
                onClick={() => void confirm()}
              >
                {busy ? (
                  <>
                    <ButtonSpinner />
                    Salvando…
                  </>
                ) : (
                  "Importar"
                )}
              </Button>
              <Button
                variant="ghost"
                className="sm:flex-1"
                disabled={busy || reading}
                onClick={resetSelection}
              >
                Cancelar
              </Button>
            </div>
          </div>
        </section>
      ) : null}

      {saved ? (
        <section className="flex flex-col gap-3 rounded-2xl border border-primary/40 bg-surface p-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">
              Plano atualizado
            </p>
            <h2 className="mt-1 text-2xl leading-snug">Planilha importada</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              {saved.length} dias no plano. Importar de novo substitui o plano, mas o histórico de
              estudo continua.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button asChild>
              <Link to="/">Ir para Hoje</Link>
            </Button>
            <Button
              variant="surface"
              onClick={() => startPrep(saved[0]?.date ?? "")}
            >
              Preparar os próximos 7 dias
            </Button>
          </div>
        </section>
      ) : null}

      {notice ? (
        <Snackbar
          key={noticeKey}
          message={notice}
          actionLabel={undo ? "Desfazer" : undefined}
          onAction={undo ? () => void undoLastImport() : undefined}
          onDismiss={() => setNotice("")}
          durationMs={undo ? 8000 : 6000}
          className="bottom-[calc(6rem_+_env(safe-area-inset-bottom))] min-[600px]:bottom-[calc(1.5rem_+_env(safe-area-inset-bottom))]"
        />
      ) : null}
    </div>
  );
}

function PreviewItemRow({ item }: { item: PreviewItem }) {
  return item.kind === "problem" ? (
    <PreviewProblem row={item.row} message={item.message} />
  ) : (
    <PreviewDay row={item.row} />
  );
}

/** Linha que o parser não conseguiu usar, mostrada antes dos dias válidos. */
function PreviewProblem({ row, message }: { row: number; message: string }) {
  const problem = sheetProblemFromWarning({ row, message });
  return (
    <li className="rounded-xl border border-clay/40 bg-clay/10 px-3 py-1.5">
      <p className="text-xs leading-snug text-clay-text">
        <span className="font-semibold">
          Linha {problem.row}
          {problem.column ? `, coluna ${problem.column}` : ""}
        </span>
        {": "}
        {problem.reason ?? message}
      </p>
    </li>
  );
}

function PreviewDay({ row }: { row: PreviewRow }) {
  return (
    <li className="rounded-xl border border-border bg-surface-2 px-3 py-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold tabular-nums text-fg">{row.label}</span>
        <span className="shrink-0 text-xs text-muted">
          {row.blockCountLabel} · {row.totalLabel}
        </span>
      </div>
      <ul className="mt-0.5 flex flex-col">
        {row.blocks.map((block) => (
          <li key={block.kind} className="truncate text-xs leading-snug text-muted">
            <span className="text-fg">{block.label}</span> · {block.minutes} · {block.content}
          </li>
        ))}
      </ul>
    </li>
  );
}

/**
 * Mini-tabela do estado inicial: os cabeçalhos reais do parser e uma linha de
 * exemplo, em mono 12px. O texto quebra em duas linhas no celular (as sete
 * colunas não cabem em 360px), sem esconder nenhuma coluna.
 */
function TemplateFormatTable() {
  return (
    <div
      role="group"
      aria-label="Exemplo do formato esperado da planilha"
      className="rounded-xl border border-border bg-surface-2 px-3 py-2 font-mono text-xs leading-relaxed"
    >
      <p className="text-muted">{TEMPLATE_HEADERS.join(" | ")}</p>
      <p className="mt-0.5 break-words text-fg">{TEMPLATE_SAMPLE_ROW.join(" | ")}</p>
    </div>
  );
}

function ColumnControls({
  sheet,
  sheets,
  sheetName,
  manual,
  map,
  labels,
  onChangeSheet,
  onChangeMap,
}: {
  sheet: SheetTable;
  sheets: SheetTable[];
  sheetName: string;
  manual: boolean;
  map: ColumnMap;
  labels: string[];
  onChangeSheet: (name: string) => void;
  onChangeMap: (key: ColumnKey, value: number | null) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      {sheets.length > 1 ? (
        <label className="flex flex-col gap-1 text-sm">
          Aba
          <select
            className="min-h-12 rounded-xl border border-border bg-surface-2 px-3 text-base"
            value={sheetName}
            onChange={(e) => onChangeSheet(e.target.value)}
          >
            {sheets.map((item) => (
              <option key={item.name} value={item.name}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {manual ? (
        <p className="rounded-xl border border-clay/40 bg-clay/10 px-3 py-2.5 text-sm leading-relaxed text-clay-text">
          Não reconheci os cabeçalhos desta planilha. Escolha abaixo qual coluna é cada coisa — a
          prévia atualiza na hora.
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        {(manual ? MANUAL_FIELDS : COLUMN_FIELDS).map((field) => (
          <FieldSelect
            key={field.key}
            field={field}
            map={map}
            labels={labels}
            onChange={(value) => onChangeMap(field.key, value)}
          />
        ))}
      </div>

      {manual && OPTIONAL_FIELDS.length ? (
        <details className="rounded-xl border border-border bg-surface px-3 py-2">
          <summary className="flex min-h-12 cursor-pointer items-center text-sm font-semibold">
            Campos opcionais
          </summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {OPTIONAL_FIELDS.map((field) => (
              <FieldSelect
                key={field.key}
                field={field}
                map={map}
                labels={labels}
                onChange={(value) => onChangeMap(field.key, value)}
              />
            ))}
          </div>
        </details>
      ) : null}
      <p className="text-xs leading-relaxed text-muted">
        Colunas extras são ignoradas. A planilha “{sheet.name}” vira o plano só depois de Importar.
      </p>
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
        className="min-h-12 rounded-xl border border-border bg-surface-2 px-3 text-base"
        value={map[field.key] ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
      >
        <option value="">{field.required ? "Escolha a coluna" : "Não importar"}</option>
        {labels.map((label, index) => (
          <option key={`${label}-${index}`} value={index}>
            {label || `Coluna ${index + 1}`}
          </option>
        ))}
      </select>
    </label>
  );
}
