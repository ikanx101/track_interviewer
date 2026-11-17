// Pembentukan workbook XLSX (server saja; exceljs ditandai serverExternalPackages).
import ExcelJS from "exceljs";
import type { Table } from "@/lib/export";

export async function tablesToXlsx(tables: Table[]): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "IMaN";
  wb.created = new Date();
  for (const t of tables) {
    const ws = wb.addWorksheet(t.name.slice(0, 31), { views: [{ state: "frozen", ySplit: 1 }] });
    ws.addRow(t.headers);
    for (const r of t.rows) ws.addRow(r.map((v) => (v === null ? null : v)));
    const header = ws.getRow(1);
    header.font = { bold: true };
    header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
    header.alignment = { vertical: "middle", wrapText: false };
    t.headers.forEach((h, idx) => {
      let max = h.length;
      for (const r of t.rows) {
        const v = r[idx];
        if (v !== null && v !== undefined) max = Math.max(max, String(v).length);
      }
      ws.getColumn(idx + 1).width = Math.min(60, Math.max(8, max + 2));
    });
    if (t.headers.length) ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: t.headers.length } };
  }
  const buf = await wb.xlsx.writeBuffer();
  return new Uint8Array(buf as ArrayBuffer);
}
