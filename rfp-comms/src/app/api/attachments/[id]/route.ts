import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { guarded, ApiError } from "@/lib/api";
import { fetchAttachmentBlob, deleteAttachmentBlobs } from "@/lib/blob";

// Authenticated download proxy — the blob URL itself never reaches the browser.
export const GET = guarded(async (_req, params) => {
  const attachment = await prisma.attachment.findUnique({ where: { id: params.id } });
  if (!attachment) throw new ApiError(404, "Attachment not found");
  const data = await fetchAttachmentBlob(attachment.blobUrl);
  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": attachment.mimeType,
      "Content-Disposition": `attachment; filename="${attachment.fileName.replace(/"/g, "")}"`,
      "Content-Length": String(data.length),
    },
  });
});

export const DELETE = guarded(async (_req, params) => {
  const attachment = await prisma.attachment.findUnique({ where: { id: params.id } });
  if (!attachment) throw new ApiError(404, "Attachment not found");
  await prisma.$transaction([
    prisma.attachment.delete({ where: { id: params.id } }),
    prisma.template.update({
      where: { id: attachment.templateId },
      data: { version: { increment: 1 } },
    }),
  ]);
  await deleteAttachmentBlobs([attachment.blobUrl]);
  return NextResponse.json({ ok: true });
});
