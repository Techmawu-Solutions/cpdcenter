import { getLastUpdated, getPublicDirectory } from "@/lib/store";
import type { PublicRegion } from "@/lib/records";
import CentreFinder from "./centre-finder";

// Rebuilt straight away after every admin upload; the hourly refresh is only a safety net.
export const revalidate = 3600;

export default async function Home() {
  let regions: PublicRegion[] = [];
  let lastUpdated: string | null = null;
  let failed = false;
  try {
    [regions, lastUpdated] = await Promise.all([getPublicDirectory(), getLastUpdated()]);
  } catch (error) {
    console.error(error);
    failed = true;
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Find your training centre</h1>
      <p className="mt-2 text-gray-600">
        National CPD Training for Private School Teachers. Select your region and district to see the proposed
        training centres.
      </p>

      {failed ? (
        <p className="mt-8 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-900">
          The centre list is not available right now. Please try again later.
        </p>
      ) : regions.length === 0 ? (
        <p className="mt-8 rounded-lg border border-gray-200 bg-white p-4 text-gray-600">
          No centres have been published yet.
        </p>
      ) : (
        <CentreFinder regions={regions} />
      )}

      {lastUpdated && (
        <p className="mt-8 text-sm text-gray-500">
          List last updated{" "}
          {new Date(lastUpdated).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
        </p>
      )}
    </main>
  );
}
