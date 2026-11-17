import InterviewerManager from "@/components/admin/InterviewerManager";
import ProjectManager from "@/components/admin/ProjectManager";

export const dynamic = "force-dynamic";

export default function KelolaPage() {
  return (
    <>
      <div>
        <h1 className="page-title">Kelola Data</h1>
        <p className="text-sm text-slate-500">Daftar interviewer dan project. Data tidak dapat dihapus agar riwayat tetap tersimpan — gunakan nonaktifkan / Selesai.</p>
      </div>
      <InterviewerManager />
      <ProjectManager />
    </>
  );
}
