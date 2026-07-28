import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { guarded, ApiError } from "@/lib/api";
import { putAttachmentBlob, fetchAttachmentBlob, deleteAttachmentBlobs } from "@/lib/blob";

// Replaces this audience's template (subject, body, attachments) with a copy
// of another audience's template. The UI confirms before overwriting.
export const POST = guarded(async (req, params) => {
  const { sourceAudienceId } = await req.json();
  const [target, source] = await Promise.all([
    prisma.template.findUnique({
      where: { audienceId: params.id },
      include: { attachments: { select: { blobUrl: true } } },
    }),
    prisma.template.findUnique({
      where: { audienceId: sourceAudienceId },
      include: { attachments: true },
    }),
  ]);
  if (!target) throw new ApiError(404, "Template not found");
  if (!source) throw new ApiError(404, "Source template not found");
  if (target.id === source.id) throw new ApiError(400, "Cannot copy a template onto itself");

  // Each attachment row owns its blob, so copy the payloads first (outside
  // the transaction), then swap the rows.
  const copies = await Promise.all(
    source.attachments.map(async (a) => ({
      fileName: a.fileName,
      mimeType: a.mimeType,
      size: a.size,
      blobUrl: await putAttachmentBlob(
        target.id,
        a.fileName,
        a.mimeType,
        await fetchAttachmentBlob(a.blobUrl)
      ),
    }))
  );

  try {
    await prisma.$transaction([
      prisma.attachment.deleteMany({ where: { templateId: target.id } }),
      prisma.template.update({
        where: { id: target.id },
        data: {
          subject: source.subject,
          bodyHtml: source.bodyHtml,
          noAttachmentConfirmed: source.noAttachmentConfirmed,
          version: { increment: 1 },
        },
      }),
      ...copies.map((c) =>
        prisma.attachment.create({ data: { templateId: target.id, ...c } })
      ),
    ]);
  } catch (e) {
    await deleteAttachmentBlobs(copies.map((c) => c.blobUrl));
    throw e;
  }
  await deleteAttachmentBlobs(target.attachments.map((a) => a.blobUrl));
  return NextResponse.json({ ok: true });
});
