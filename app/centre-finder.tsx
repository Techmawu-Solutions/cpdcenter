"use client";

import { useEffect, useState } from "react";
import type { PublicRegion } from "@/lib/records";

const selectClass =
  "mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 capitalize shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30 disabled:bg-gray-100 disabled:text-gray-400";

const title = (s: string) => s.toLowerCase();

export default function CentreFinder({ regions }: { regions: PublicRegion[] }) {
  const [region, setRegion] = useState("");
  const [district, setDistrict] = useState("");

  // Restore a shared link such as /?region=ASHANTI&district=KUMASI%20METROPOLITAN
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const r = regions.find((x) => x.name === params.get("region"));
    if (!r) return;
    setRegion(r.name);
    if (r.districts.some((d) => d.name === params.get("district"))) setDistrict(params.get("district")!);
  }, [regions]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (region) params.set("region", region);
    if (district) params.set("district", district);
    const query = params.toString();
    window.history.replaceState(null, "", query ? `?${query}` : window.location.pathname);
  }, [region, district]);

  const selectedRegion = regions.find((r) => r.name === region);
  const selectedDistrict = selectedRegion?.districts.find((d) => d.name === district);

  return (
    <div className="mt-6">
      <div className="grid gap-4 rounded-xl border border-gray-200 bg-white p-4 sm:grid-cols-2 sm:p-5">
        <label className="block text-sm font-medium text-gray-700">
          Region
          <select
            className={selectClass}
            value={region}
            onChange={(e) => {
              setRegion(e.target.value);
              setDistrict("");
            }}
          >
            <option value="">Select region</option>
            {regions.map((r) => (
              <option key={r.name} value={r.name}>
                {title(r.name)}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium text-gray-700">
          District
          <select
            className={selectClass}
            value={district}
            disabled={!selectedRegion}
            onChange={(e) => setDistrict(e.target.value)}
          >
            <option value="">{selectedRegion ? "Select district" : "Select a region first"}</option>
            {selectedRegion?.districts.map((d) => (
              <option key={d.name} value={d.name}>
                {title(d.name)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {selectedRegion && !selectedDistrict && (
        <p className="mt-4 text-sm text-gray-500">
          {selectedRegion.districts.length} district{selectedRegion.districts.length === 1 ? "" : "s"} listed in{" "}
          <span className="capitalize">{title(selectedRegion.name)}</span>.
        </p>
      )}

      {selectedDistrict && (
        <section className="mt-6 rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
          <p className="text-sm capitalize text-gray-500">{title(selectedRegion!.name)} Region</p>
          <h2 className="mt-1 text-xl font-semibold capitalize">{title(selectedDistrict.name)}</h2>
          {selectedDistrict.centres.length === 0 ? (
            <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
              No centre has been proposed for this district yet. Please check back later or contact your district
              education office.
            </p>
          ) : (
            <p className="mt-1 text-sm text-gray-600">
              {selectedDistrict.centres.length} proposed centre{selectedDistrict.centres.length === 1 ? "" : "s"}
            </p>
          )}
          <ol className="mt-4 space-y-2">
            {selectedDistrict.centres.map((c, i) => (
              <li key={c.name} className="flex items-start gap-3 rounded-lg bg-brand-soft p-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-semibold text-white">
                  {i + 1}
                </span>
                <div className="min-w-0 pt-0.5">
                  <p className="font-medium break-words">{c.name}</p>
                  {c.alternative && <p className="text-xs text-gray-600">Alternative centre</p>}
                </div>
              </li>
            ))}
          </ol>
          {selectedDistrict.centres.length > 0 && (
            <p className="mt-4 text-xs text-gray-500">
              These are proposed centres and may change. Check back for the final list.
            </p>
          )}
        </section>
      )}
    </div>
  );
}
