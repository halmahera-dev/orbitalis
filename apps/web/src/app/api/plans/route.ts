import { auth } from "@repo/auth";
import { headers } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

import { getCells } from "@/features/bowls/bowls-queries";
import { planKinds, unservedPeople, type PlanKind } from "@/features/plans/plan-scores";
import { getPlanEntries } from "@/features/plans/plans-queries";

function csvRow(values: (string | number | null)[]) {
  return values.map((value) => (value === null ? "" : String(value))).join(",");
}

export async function GET(request: NextRequest) {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session) {
    return new NextResponse("Sign in first.", { status: 401 });
  }
  const kind = planKinds.find((option) => option === request.nextUrl.searchParams.get("kind"));
  if (!kind) {
    return new NextResponse("Use ?kind=recharge or ?kind=pipe.", { status: 400 });
  }
  const [cells, entries] = await Promise.all([getCells(), getPlanEntries()]);
  const cellById = new Map(cells.map((cell) => [cell.id, cell]));
  const header = csvRow([
    "cell_id",
    "longitude",
    "latitude",
    "status",
    "sinking_mm_yr",
    "uncertainty_mm_yr",
    "people",
    "people_without_pipes_estimate",
  ]);
  const rows = entries
    .filter((entry) => entry.kind === kind)
    .flatMap((entry) => {
      const cell = cellById.get(entry.cellId);
      if (!cell) {
        return [];
      }
      return [
        csvRow([
          cell.id,
          cell.center[0],
          cell.center[1],
          entry.status,
          cell.sinkingMmYr,
          cell.uncertaintyMmYr,
          cell.people,
          unservedPeople(cell),
        ]),
      ];
    });
  return new NextResponse([header, ...rows].join("\n") + "\n", {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="orbitalis-${kind satisfies PlanKind}-plan.csv"`,
    },
  });
}
