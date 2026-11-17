import { fail } from "@/lib/api";
import { isDateString, todayWIB } from "@/lib/dates";
import {
  harianTable,
  interviewerTable,
  last30Days,
  parseFilters,
  pencocokanTable,
  projectTable,
  rekapTable,
  toCsv,
  transportTable,
  type Filters,
  type Table,
} from "@/lib/export";

export const dynamic = "force-dynamic";

const DATASETS = ["hari-ini", "harian", "rekap", "pencocokan", "transport", "interviewer", "project"] as const;
type Dataset = (typeof DATASETS)[number];

async function datasetTable(ds: Dataset, f: Filters): Promise<Table> {
  switch (ds) {
    case "hari-ini":
      return harianTable({ from: f.from, to: f.to, interviewerId: f.interviewerId }, "Hari Ini");
    case "harian":
      return harianTable(f);
    case "rekap":
      return rekapTable(f);
    case "pencocokan":
      return pencocokanTable(f);
    case "transport":
      return transportTable(f);
    case "interviewer":
      return interviewerTable(f);
    case "project":
      return projectTable();
  }
}

/**
 * GET /api/admin/export?format=csv|xlsx&dataset=...&from&to&interviewerId&status&date
 * CSV: hanya dataset yang diminta. XLSX: semua sheet untuk periode/filter yang sama.
 */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const format = sp.get("format") ?? "csv";
  const dataset = (sp.get("dataset") ?? "harian") as Dataset;
  if (format !== "csv" && format !== "xlsx") return fail("Format harus csv atau xlsx.");
  if (!DATASETS.includes(dataset)) return fail("Dataset tidak dikenal.");

  let f: Filters;
  if (dataset === "hari-ini" && !sp.get("from") && !sp.get("to")) {
    const date = sp.get("date");
    const d = isDateString(date) ? date : todayWIB();
    f = parseFilters(sp, { from: d, to: d });
    f.from = f.to = d;
  } else {
    f = parseFilters(sp, last30Days());
  }

  try {
    if (format === "csv") {
      const table = await datasetTable(dataset, f);
      const name = `iman_${dataset}_${f.from}_${f.to}.csv`;
      return new Response(toCsv(table), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${name}"`,
          "Cache-Control": "no-store",
        },
      });
    }

    const { tablesToXlsx } = await import("@/lib/export-xlsx");
    const tables = await Promise.all([
      harianTable(f),
      rekapTable(f),
      pencocokanTable(f),
      transportTable(f),
      interviewerTable(f),
      projectTable(),
    ]);
    const bytes = await tablesToXlsx(tables);
    const name = `iman_${f.from}_${f.to}.xlsx`;
    return new Response(bytes as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${name}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("export error", e);
    return fail("Gagal membuat file unduhan.", 500);
  }
}
