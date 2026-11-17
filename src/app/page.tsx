import RekapForm from "@/components/interviewer/RekapForm";
import { todayWIB } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default function InterviewerPage() {
  // "Hari ini" dihitung di server (WIB) agar tidak bergantung pada jam HP.
  return <RekapForm serverToday={todayWIB()} />;
}
