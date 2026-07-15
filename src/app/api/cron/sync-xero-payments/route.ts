import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { syncAllDealPaymentsFromXero } from "@/lib/xero/sync-payment";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await syncAllDealPaymentsFromXero();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("Xero payment sync cron failed:", error);
    return NextResponse.json({ error: "Xero payment sync failed" }, { status: 500 });
  }
}
