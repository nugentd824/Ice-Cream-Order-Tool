import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { guarded, ApiError } from "@/lib/api";
import { fetchAttachmentBlob, deleteAttachmentBlobs } from "@/lib/blob";

// Authenticated download proxy — the blob URL itself never reaches the browser.
export const GET = guarded(async (_req, params) => {
  const attachment = await prisma.contactAttachment.findUnique({ where: { id: params.id } });
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
  const attachment = await prisma.contactAttachment.findUnique({ where: { id: params.id } });
  if (!attachment) throw new ApiError(404, "Attachment not found");
  await prisma.contactAttachment.delete({ where: { id: params.id } });
  await deleteAttachmentBlobs([attachment.blobUrl]);
  return NextResponse.json({ ok: true });
});
