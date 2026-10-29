"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import { tableToRawRows, type RawRow } from "@/lib/records";
import { applyUpload, previewUpload, type ChangeSummary, type Preview } from "./actions";

async function readTable(file: File): Promise<unknown[][][]> {
  if (/\.xlsx$/i.test(file.name)) {
    const { default: readXlsxFile } = await import("read-excel-file/browser");
    const sheets = await readXlsxFile(file);
    return sheets.map((s) => s.data as unknown[][]);
  }
  if (/\.csv$/i.test(file.name)) {
    const parsed = Papa.parse<string[]>(await file.text(), { skipEmptyLines: true });
    return [parsed.data];
  }
  throw new Error("Please upload a .xlsx or .csv file. Older .xls files must be saved as .xlsx first.");
}

/** Reads the first sheet that has the expected header row. */
async function readRows(file: File): Promise<RawRow[]> {
  let lastError = "The file is empty.";
  for (const table of await readTable(file)) {
    const result = tableToRawRows(table);
    if ("rows" in result) return result.rows;
    lastError = result.error;
  }
  throw new Error(lastError);
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function ChangeList({ title, items, tone }: { title: string; items: ChangeSummary[]; tone: string }) {
  if (items.length === 0) return null;
  return (
    <details className="rounded-lg border border-gray-200">
      <summary className={`cursor-pointer px-3 py-2 text-sm font-medium ${tone}`}>
        {title} ({items.length})
      </summary>
      <ul className="max-h-64 divide-y divide-gray-100 overflow-y-auto text-sm">
        {items.map((i) => (
          <li key={i.key} className="px-3 py-1.5">
            <span className="font-medium">{i.name}</span>
            <span className="text-gray-500">
              {" "}
              · {i.district}
              {i.centre && ` · ${i.centre}`}
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}

export default function UploadPanel({ hasRecords }: { hasRecords: boolean }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ name: string; rows: RawRow[] } | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [removeMissing, setRemoveMissing] = useState(true);
  const [busy, setBusy] = useState<"reading" | "saving" | null>(null);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  function reset() {
    setFile(null);
    setPreview(null);
    setError("");
    if (inputRef.current) inputRef.current.value = "";
  }

  async function onFile(selected: File | undefined) {
    setPreview(null);
    setError("");
    setDone("");
    if (!selected) return;
    setBusy("reading");
    try {
      const rows = await readRows(selected);
      const response = await previewUpload(rows);
      if ("error" in response) throw new Error(response.error);
      setFile({ name: selected.name, rows });
      setPreview(response.preview);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read the file.");
      setFile(null);
    } finally {
      setBusy(null);
    }
  }

  async function onApply() {
    if (!file) return;
    setBusy("saving");
    setError("");
    const response = await applyUpload(file.rows, file.name, removeMissing);
    setBusy(null);
    if ("error" in response) {
      setError(response.error);
      return;
    }
    const r = response.result;
    setDone(`Saved. ${r.added} new, ${r.updated} updated, ${r.removed} removed, ${r.unchanged} unchanged. The public page now shows the new list.`);
    reset();
    router.refresh();
  }

  const nothingToDo = preview && preview.added.length + preview.updated.length + (removeMissing ? preview.removed.length : 0) === 0;

  return (
    <section className="mt-8 rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
      <h2 className="text-lg font-semibold">Upload spreadsheet</h2>
      <p className="mt-1 text-sm text-gray-600">
        Upload the Excel (.xlsx) or CSV file with the same columns as before. Each officer is matched by phone number, so
        uploading the file again updates existing rows instead of adding duplicates. You will see what changes before
        anything is saved.
      </p>

      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.csv"
        disabled={busy !== null}
        onChange={(e) => onFile(e.target.files?.[0])}
        className="mt-4 block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-brand file:px-4 file:py-2 file:font-medium file:text-white hover:file:bg-brand-dark"
      />

      {busy === "reading" && <p className="mt-3 text-sm text-gray-600">Reading file…</p>}
      {error && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {done && <p className="mt-3 rounded-lg bg-brand-soft p-3 text-sm text-brand-dark">{done}</p>}

      {preview && file && (
        <div className="mt-4 space-y-3">
          <p className="text-sm">
            <span className="font-medium">{file.name}</span>: {preview.read} rows read, {preview.valid} officers.
            {preview.skipped > 0 && ` ${plural(preview.skipped, "incomplete row")} skipped.`}
            {preview.duplicatesInFile > 0 &&
              ` ${plural(preview.duplicatesInFile, "repeated row")} for the same officer merged (the last one is kept).`}
          </p>

          <div className="grid grid-cols-2 gap-2 text-center text-sm sm:grid-cols-4">
            <div className="rounded-lg bg-brand-soft p-2">
              <p className="text-xl font-semibold">{preview.added.length}</p>New
            </div>
            <div className="rounded-lg bg-blue-50 p-2">
              <p className="text-xl font-semibold">{preview.updated.length}</p>Updated
            </div>
            <div className="rounded-lg bg-gray-100 p-2">
              <p className="text-xl font-semibold">{preview.unchanged}</p>Unchanged
            </div>
            <div className="rounded-lg bg-amber-50 p-2">
              <p className="text-xl font-semibold">{preview.removed.length}</p>Not in file
            </div>
          </div>

          <ChangeList title="New" items={preview.added} tone="text-brand-dark" />
          <ChangeList title="Updated" items={preview.updated} tone="text-blue-800" />
          <ChangeList title="Not in this file" items={preview.removed} tone="text-amber-800" />

          {hasRecords && preview.removed.length > 0 && (
            <label className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <input
                type="checkbox"
                checked={removeMissing}
                onChange={(e) => setRemoveMissing(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                Remove the {preview.removed.length} record{preview.removed.length === 1 ? "" : "s"} that{" "}
                {preview.removed.length === 1 ? "is" : "are"} not in this file. Leave unticked if this file only contains
                new or changed rows.
              </span>
            </label>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              onClick={onApply}
              disabled={busy !== null || Boolean(nothingToDo)}
              className="rounded-lg bg-brand px-4 py-2 font-medium text-white hover:bg-brand-dark disabled:opacity-60"
            >
              {busy === "saving" ? "Saving…" : nothingToDo ? "No changes to save" : "Apply update"}
            </button>
            <button
              onClick={reset}
              disabled={busy !== null}
              className="rounded-lg border border-gray-300 px-4 py-2 font-medium hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
