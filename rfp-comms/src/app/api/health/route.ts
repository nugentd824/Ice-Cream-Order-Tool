import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { blobConfigured } from "@/lib/blob";

export const dynamic = "force-dynamic";

// Unauthenticated deployment health check: confirms this build is live, the
// database is reachable, and blob storage is configured. Reports env var
// NAMES only where useful for diagnosis — never values or application data.
export async function GET() {
  const blob = blobConfigured();
  const blobEnvNames = Object.keys(process.env).filter((k) => /blob|_read_write_token/i.test(k));
  let db = false;
  let error: string | undefined;
  try {
    await prisma.$queryRaw`SELECT 1`;
    db = true;
  } catch (e) {
    error = e instanceof Error ? e.message.slice(0, 200) : "unknown";
  }
  const healthy = db && blob;
  return NextResponse.json(
    { ok: true, db, blob, blobEnvNames, ...(error ? { error } : {}) },
    { status: healthy ? 200 : 503 }
  );
}
