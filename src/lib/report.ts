import type { Prisma } from "@prisma/client";
import { fromDbDate } from "@/lib/dates";

export const reportInclude = {
  interviewer: true,
  items: { include: { project: true }, orderBy: { projectId: "asc" } },
} satisfies Prisma.ReportInclude;

export type ReportFull = Prisma.ReportGetPayload<{ include: typeof reportInclude }>;

/** Bentuk snapshot yang disimpan di ReportHistory.snapshot (JSON). */
export type ReportSnapshot = {
  revision: number;
  date: string;
  interviewerId: number;
  interviewerName: string;
  startTime: string | null;
  endTime: string | null;
  otherAreas: string | null;
  notes: string | null;
  transportAmount: number | null;
  transportNote: string | null;
  transportStatus: string | null;
  items: { projectId: number; projectCode: string; projectName: string; count: number; area: string }[];
  savedAt: string; // ISO waktu versi ini terakhir disimpan
};

export function toSnapshot(r: ReportFull): ReportSnapshot {
  return {
    revision: r.revision,
    date: fromDbDate(r.date),
    interviewerId: r.interviewerId,
    interviewerName: r.interviewer.name,
    startTime: r.startTime,
    endTime: r.endTime,
    otherAreas: r.otherAreas,
    notes: r.notes,
    transportAmount: r.transportAmount,
    transportNote: r.transportNote,
    transportStatus: r.transportStatus,
    items: r.items.map((i) => ({
      projectId: i.projectId,
      projectCode: i.project.code,
      projectName: i.project.name,
      count: i.count,
      area: i.area,
    })),
    savedAt: r.updatedAt.toISOString(),
  };
}

export const TRANSPORT_LABEL: Record<string, string> = {
  DIAJUKAN: "Diajukan",
  DISETUJUI: "Disetujui",
  DIBAYAR: "Dibayar",
};

export const PROJECT_STATUS_LABEL: Record<string, string> = {
  BERJALAN: "Masih berjalan",
  SELESAI: "Selesai",
};
