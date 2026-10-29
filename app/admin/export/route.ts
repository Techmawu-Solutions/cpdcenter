import { isAdmin } from "@/lib/auth";
import { displayPhone, FIELDS, HEADINGS } from "@/lib/records";
import { getAllRecords } from "@/lib/store";

const cell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

export async function GET() {
  if (!(await isAdmin())) return new Response("Unauthorised", { status: 401 });
  const records = await getAllRecords();
  const lines = [
    FIELDS.map((f) => HEADINGS[f]).join(","),
    ...records.map((r) => FIELDS.map((f) => cell(f === "phone" ? displayPhone(r.phone) : r[f])).join(",")),
  ];
  return new Response("﻿" + lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="cpd-centres-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
