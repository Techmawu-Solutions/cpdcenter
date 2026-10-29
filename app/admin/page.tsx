import type { Metadata } from "next";
import { isAdmin } from "@/lib/auth";
import { buildPublicDirectory } from "@/lib/records";
import { getAllRecords, getUploads } from "@/lib/store";
import { logout } from "./actions";
import LoginForm from "./login-form";
import RecordsTable from "./records-table";
import UploadPanel from "./upload-panel";

export const metadata: Metadata = { title: "Admin · CPD Training Centres", robots: { index: false } };

const dateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

const buttonClass = "rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-gray-50";

export default async function AdminPage() {
  if (!(await isAdmin())) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-2xl font-bold tracking-tight">Admin sign in</h1>
        <LoginForm />
      </main>
    );
  }

  const [records, uploads] = await Promise.all([getAllRecords(), getUploads()]);
  const directory = buildPublicDirectory(records);
  const stats = [
    { label: "Officer records", value: records.length },
    { label: "Regions", value: directory.length },
    { label: "Districts", value: directory.reduce((n, r) => n + r.districts.length, 0) },
    { label: "Centres shown", value: directory.reduce((n, r) => n + r.districts.reduce((m, d) => m + d.centres.length, 0), 0) },
  ];

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-bold tracking-tight">Admin</h1>
      <div className="mt-3 flex flex-wrap gap-2">
        <a href="/admin/export" className={buttonClass}>
          Download current list (CSV)
        </a>
        <a href="/" target="_blank" className={buttonClass}>
          View public page
        </a>
        <form action={logout}>
          <button className={buttonClass}>Sign out</button>
        </form>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-2xl font-semibold">{s.value}</p>
            <p className="text-sm text-gray-600">{s.label}</p>
          </div>
        ))}
      </div>

      <UploadPanel hasRecords={records.length > 0} />

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Upload history</h2>
        {uploads.length === 0 ? (
          <p className="mt-2 text-sm text-gray-600">No uploads yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-xl border border-gray-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-3 py-2 font-medium">When</th>
                  <th className="px-3 py-2 font-medium">File</th>
                  <th className="px-3 py-2 text-right font-medium">Rows</th>
                  <th className="px-3 py-2 text-right font-medium">New</th>
                  <th className="px-3 py-2 text-right font-medium">Updated</th>
                  <th className="px-3 py-2 text-right font-medium">Removed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {uploads.map((u) => (
                  <tr key={u.id}>
                    <td className="whitespace-nowrap px-3 py-2">{dateTime(u.uploaded_at)}</td>
                    <td className="max-w-xs truncate px-3 py-2" title={u.file_name}>
                      {u.file_name}
                    </td>
                    <td className="px-3 py-2 text-right">{u.total}</td>
                    <td className="px-3 py-2 text-right">{u.added}</td>
                    <td className="px-3 py-2 text-right">{u.updated}</td>
                    <td className="px-3 py-2 text-right">{u.removed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <RecordsTable records={records} />
    </main>
  );
}
