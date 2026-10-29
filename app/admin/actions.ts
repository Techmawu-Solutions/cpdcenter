"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { checkPassword, endSession, isAdmin, startSession } from "@/lib/auth";
import { diffRecords, displayPhone, FIELDS, prepareRecords, type OfficerRecord, type RawRow } from "@/lib/records";
import { applyRecords, getAllRecords } from "@/lib/store";

export async function login(_prev: { error?: string } | undefined, formData: FormData) {
  if (!checkPassword(String(formData.get("password") ?? ""))) return { error: "Incorrect password." };
  await startSession();
  redirect("/admin");
}

export async function logout() {
  await endSession();
  redirect("/admin");
}

const MAX_ROWS = 20000;

// Rows arrive from the browser, so never trust their shape.
function validRows(rows: unknown): RawRow[] {
  if (!Array.isArray(rows) || rows.length === 0 || rows.length > MAX_ROWS) {
    throw new Error(`The file must contain between 1 and ${MAX_ROWS} rows.`);
  }
  return rows.map((row) => {
    const r = (row ?? {}) as Record<string, unknown>;
    return Object.fromEntries(FIELDS.map((f) => [f, String(r[f] ?? "").slice(0, 500)])) as RawRow;
  });
}

async function requireAdmin() {
  if (!(await isAdmin())) throw new Error("Your session has expired. Please sign in again.");
}

const summarise = (r: OfficerRecord) => ({
  key: r.key,
  name: `${r.firstName} ${r.lastName}`.trim() || displayPhone(r.phone),
  district: r.district,
  centre: r.centre1 || r.centre2,
});

export type ChangeSummary = ReturnType<typeof summarise>;

export type Preview = {
  read: number;
  valid: number;
  skipped: number;
  duplicatesInFile: number;
  added: ChangeSummary[];
  updated: ChangeSummary[];
  removed: ChangeSummary[];
  unchanged: number;
};

export async function previewUpload(rows: unknown): Promise<{ preview: Preview } | { error: string }> {
  try {
    await requireAdmin();
    const raws = validRows(rows);
    const { records, skipped, duplicatesInFile } = prepareRecords(raws);
    if (records.length === 0) return { error: "No usable rows found. Each row needs a region, district and officer." };
    const diff = diffRecords(await getAllRecords(), records);
    return {
      preview: {
        read: raws.length,
        valid: records.length,
        skipped,
        duplicatesInFile,
        added: diff.added.map(summarise),
        updated: diff.updated.map(summarise),
        removed: diff.removed.map(summarise),
        unchanged: diff.unchanged,
      },
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not read the file." };
  }
}

export async function applyUpload(
  rows: unknown,
  fileName: string,
  removeMissing: boolean,
): Promise<{ result: Awaited<ReturnType<typeof applyRecords>> } | { error: string }> {
  try {
    await requireAdmin();
    const { records } = prepareRecords(validRows(rows));
    if (records.length === 0) return { error: "No usable rows found." };
    const result = await applyRecords(records, String(fileName || "upload"), Boolean(removeMissing));
    revalidatePath("/");
    revalidatePath("/admin");
    return { result };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "The update failed. Nothing was changed." };
  }
}
