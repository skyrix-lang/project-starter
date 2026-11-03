import { NextResponse } from "next/server";
import { isDatabaseReachable } from "@/lib/health";

// Public on purpose, for load balancers and uptime checks: it says only whether
// the app can reach its database. 503 tells them to stop sending traffic.
export async function GET() {
  if (!(await isDatabaseReachable())) {
    return NextResponse.json(
      { status: "unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
  return NextResponse.json(
    { status: "ok" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
