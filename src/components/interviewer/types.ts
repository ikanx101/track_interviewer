// Kontrak data antara form interviewer (client) dan API publik (/api/public/*).

export type PublicInterviewer = { id: number; name: string };

export type PublicProject = {
  id: number;
  code: string;
  name: string;
  isPC: boolean;
  status: "BERJALAN" | "SELESAI";
};

export type TransportStatusValue = "DIAJUKAN" | "DISETUJUI" | "DIBAYAR";

export type PublicRekapItem = {
  projectId: number;
  projectCode: string;
  projectName: string;
  isPC: boolean;
  count: number;
  area: string;
};

export type PublicRekap = {
  id: number;
  interviewerId: number;
  interviewerName: string;
  date: string; // YYYY-MM-DD
  revision: number;
  startTime: string | null;
  endTime: string | null;
  otherAreas: string | null;
  notes: string | null;
  transportAmount: number | null;
  transportNote: string | null;
  transportStatus: TransportStatusValue | null;
  /** true jika transport sudah Disetujui/Dibayar sehingga tidak bisa diubah. */
  transportLocked: boolean;
  items: PublicRekapItem[];
  totalResponden: number;
  updatedAt: string; // ISO
};

/** Body POST /api/public/rekap. Angka boleh dikirim sebagai string/number; kosong = null. */
export type RekapPayload = {
  interviewerId: number;
  date: string;
  startTime?: string | null;
  endTime?: string | null;
  otherAreas?: string | null;
  notes?: string | null;
  transportAmount?: number | string | null;
  transportNote?: string | null;
  items: { projectId: number; count: number | string | null; area?: string | null }[];
};

export type RekapSaveResult = { created: boolean; report: PublicRekap };
