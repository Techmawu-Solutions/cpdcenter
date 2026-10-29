"use client";

import { useMemo, useState } from "react";
import { displayPhone, type OfficerRecord } from "@/lib/records";

export default function RecordsTable({ records }: { records: OfficerRecord[] }) {
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return records;
    return records.filter((r) => Object.values(r).some((v) => v.toLowerCase().includes(q)));
  }, [records, search]);

  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold">Records</h2>
      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search region, district, centre, name or phone"
        className="mt-3 block w-full max-w-md rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
      />
      <p className="mt-2 text-sm text-gray-600">
        Showing {filtered.length} of {records.length}
      </p>
      <div className="mt-2 overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="px-3 py-2 font-medium">Region</th>
              <th className="px-3 py-2 font-medium">District</th>
              <th className="px-3 py-2 font-medium">1st centre</th>
              <th className="px-3 py-2 font-medium">2nd centre</th>
              <th className="px-3 py-2 font-medium">Officer</th>
              <th className="px-3 py-2 font-medium">Phone</th>
              <th className="px-3 py-2 font-medium">Designation</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map((r) => (
              <tr key={r.key} className="align-top">
                <td className="whitespace-nowrap px-3 py-2">{r.region}</td>
                <td className="px-3 py-2">{r.district}</td>
                <td className="px-3 py-2">{r.centre1}</td>
                <td className="px-3 py-2">{r.centre2}</td>
                <td className="px-3 py-2">{`${r.firstName} ${r.lastName}`.trim()}</td>
                <td className="whitespace-nowrap px-3 py-2">{displayPhone(r.phone)}</td>
                <td className="px-3 py-2">{r.designation}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
