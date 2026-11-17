import AdminNav from "@/components/AdminNav";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <AdminNav />
      <main className="mx-auto max-w-7xl space-y-4 px-4 py-4 sm:py-6">{children}</main>
    </div>
  );
}
