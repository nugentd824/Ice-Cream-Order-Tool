import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { guarded, ApiError } from "@/lib/api";
import { putAttachmentBlob, fetchAttachmentBlob, deleteAttachmentBlobs } from "@/lib/blob";

// Duplicate a contact into the other audience so one supplier can receive
// BOTH communications. The copy is linked via duplicateOfId so re-imports
// ignore it (the primary record wins on email matching).
export const POST = guarded(async (req, params) => {
  const { contactId, audienceId } = await req.json();
  const source = await prisma.contact.findUnique({
    where: { id: contactId },
    include: { attachments: true },
  });
  if (!source || source.clientId !== params.id) throw new ApiError(404, "Contact not found");
  const audience = await prisma.audience.findUnique({ where: { id: audienceId } });
  if (!audience || audience.clientId !== params.id)
    throw new ApiError(400, "Audience does not belong to this client");
  if (source.audienceId === audienceId)
    throw new ApiError(400, "Contact is already in that audience");

  const existing = await prisma.contact.findFirst({
    where: { duplicateOfId: contactId, audienceId },
  });
  if (existing) throw new ApiError(409, "This contact already has a duplicate in that audience");

  // Copy vendor-specific file payloads first (each row owns its blob), then
  // create the contact and its attachment rows together.
  const copies = await Promise.all(
    source.attachments.map(async (a) => ({
      fileName: a.fileName,
      mimeType: a.mimeType,
      size: a.size,
      blobUrl: await putAttachmentBlob(
        `contact-dup-${source.id}`,
        a.fileName,
        a.mimeType,
        await fetchAttachmentBlob(a.blobUrl)
      ),
    }))
  );

  try {
    const copy = await prisma.contact.create({
      data: {
        clientId: source.clientId,
        audienceId,
        company: source.company,
        firstName: source.firstName,
        lastName: source.lastName,
        email: source.email,
        title: source.title,
        category: source.category,
        notes: source.notes,
        emailValid: source.emailValid,
        duplicateOfId: source.id,
        attachments: { create: copies },
      },
    });
    return NextResponse.json(copy, { status: 201 });
  } catch (e) {
    await deleteAttachmentBlobs(copies.map((c) => c.blobUrl));
    throw e;
  }
});
