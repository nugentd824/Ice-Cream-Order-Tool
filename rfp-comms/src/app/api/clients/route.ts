import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { guarded, ApiError } from "@/lib/api";
import { deriveSendStatus } from "@/lib/aggregate";
import type { ClientListPage, ClientSummary } from "@/lib/types";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

function intParam(params: URLSearchParams, name: string, fallback: number): number {
  const n = Number.parseInt(params.get(name) ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export const GET = guarded(async (req) => {
  const search = new URL(req.url).searchParams;
  const page = intParam(search, "page", 1);
  const pageSize = Math.min(intParam(search, "pageSize", DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE);

  const [total, clients] = await Promise.all([
    prisma.client.count(),
    prisma.client.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { audiences: { orderBy: { key: "asc" } } },
    }),
  ]);

  const clientIds = clients.map((c) => c.id);
  const audienceIds = clients.flatMap((c) => c.audiences.map((a) => a.id));

  // All counting happens in the database, scoped to this page of clients.
  const [contactTotals, assignedCounts, sentCounts] = await Promise.all([
    clientIds.length
      ? prisma.contact.groupBy({
          by: ["clientId"],
          where: { clientId: { in: clientIds } },
          _count: { _all: true },
        })
      : [],
    audienceIds.length
      ? prisma.contact.groupBy({
          by: ["audienceId"],
          where: { audienceId: { in: audienceIds } },
          _count: { _all: true },
        })
      : [],
    // COUNT(DISTINCT …) is not expressible with Prisma groupBy. The join keeps
    // the previous semantics: a send only counts toward an audience while the
    // contact is still assigned to the audience it was sent for.
    audienceIds.length
      ? prisma.$queryRaw<{ audienceId: string; sent: number }[]>`
          SELECT sl."audienceId", COUNT(DISTINCT sl."contactId")::int AS "sent"
          FROM "SendLog" sl
          JOIN "Contact" ct ON ct.id = sl."contactId" AND ct."audienceId" = sl."audienceId"
          WHERE sl.status = 'SENT' AND sl."isTest" = false
            AND sl."audienceId" IN (${Prisma.join(audienceIds)})
          GROUP BY sl."audienceId"`
      : [],
  ]);

  const totalByClient = new Map(contactTotals.map((r) => [r.clientId, r._count._all]));
  const assignedByAudience = new Map(assignedCounts.map((r) => [r.audienceId, r._count._all]));
  const sentByAudience = new Map(sentCounts.map((r) => [r.audienceId, r.sent]));

  const summaries: ClientSummary[] = clients.map((c) => {
    const audiences = c.audiences.map((a) => {
      const assignedCount = assignedByAudience.get(a.id) ?? 0;
      const sentCount = sentByAudience.get(a.id) ?? 0;
      return {
        id: a.id,
        key: a.key,
        label: a.label,
        targetSendDate: a.targetSendDate,
        assignedCount,
        sentCount,
        sendStatus: deriveSendStatus(assignedCount, sentCount),
      };
    });
    const totalContacts = totalByClient.get(c.id) ?? 0;
    const assignedContacts = audiences.reduce((sum, a) => sum + a.assignedCount, 0);
    return {
      id: c.id,
      name: c.name,
      engagement: c.engagement,
      status: c.status as ClientSummary["status"],
      totalContacts,
      assignedContacts,
      unassignedContacts: totalContacts - assignedContacts,
      audiences,
    };
  });

  const body: ClientListPage = { clients: summaries, page, pageSize, total };
  return NextResponse.json(body);
});

export const POST = guarded(async (req) => {
  const body = await req.json();
  const name = (body.name ?? "").trim();
  if (!name) throw new ApiError(400, "Client name is required");

  const client = await prisma.client.create({
    data: {
      name,
      engagement: (body.engagement ?? "").trim(),
      notes: body.notes ?? "",
      audiences: {
        create: [
          { key: "A", label: "Audience A", template: { create: {} } },
          { key: "B", label: "Audience B", template: { create: {} } },
        ],
      },
    },
  });
  return NextResponse.json({ id: client.id }, { status: 201 });
});
