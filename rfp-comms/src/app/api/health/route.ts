import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// Unauthenticated deployment health check: confirms this build is live and the
// database is reachable. Exposes no application data.
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, db: true });
  } catch (e) {
    const error = e instanceof Error ? e.message.slice(0, 200) : "unknown";
    return NextResponse.json({ ok: true, db: false, error }, { status: 503 });
  }
}
