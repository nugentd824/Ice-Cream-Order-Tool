import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { guarded, ApiError } from "@/lib/api";
import { putAttachmentBlob, deleteAttachmentBlobs } from "@/lib/blob";
import { fmtBytes } from "@/lib/format";

// Vercel serverless caps request bodies at ~4.5MB, so each file must come in
// its own request and stay under PER_FILE_LIMIT.
const PER_FILE_LIMIT = 4 * 1024 * 1024;
const PER_CONTACT_LIMIT = 25 * 1024 * 1024;

// Upload a vendor-specific attachment onto one supplier contact.
export const POST = guarded(async (req, params) => {
  const contact = await prisma.contact.findUnique({
    where: { id: params.id },
    include: { attachments: { select: { size: true } } },
  });
  if (!contact) throw new ApiError(404, "Contact not found");

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw new ApiError(400, "No file provided");
  if (file.size > PER_FILE_LIMIT)
    throw new ApiError(
      413,
      `${file.name} is ${fmtBytes(file.size)} — files must be under ${fmtBytes(PER_FILE_LIMIT)} each`
    );
  const existingTotal = contact.attachments.reduce((s, a) => s + a.size, 0);
  if (existingTotal + file.size > PER_CONTACT_LIMIT)
    throw new ApiError(
      413,
      `This supplier's files would exceed ${fmtBytes(PER_CONTACT_LIMIT)} — most mail gateways reject messages that large`
    );

  const mimeType = file.type || "application/octet-stream";
  const blobUrl = await putAttachmentBlob(
    `contact-${contact.id}`,
    file.name,
    mimeType,
    Buffer.from(await file.arrayBuffer())
  );

  try {
    const attachment = await prisma.contactAttachment.create({
      data: {
        contactId: contact.id,
        fileName: file.name,
        mimeType,
        size: file.size,
        blobUrl,
      },
      select: { id: true, fileName: true, mimeType: true, size: true },
    });
    return NextResponse.json(attachment, { status: 201 });
  } catch (e) {
    await deleteAttachmentBlobs([blobUrl]);
    throw e;
  }
});
