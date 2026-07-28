import { put, del } from "@vercel/blob";
import { ApiError } from "./api";

// Attachment payloads live in Vercel Blob; Postgres keeps only metadata plus
// the blob URL. Blob URLs carry an unguessable random suffix and never leave
// the server — browsers download through the authenticated
// /api/attachments/[id] proxy.

function requireToken() {
  if (!process.env.BLOB_READ_WRITE_TOKEN)
    throw new ApiError(
      500,
      "Blob storage is not configured — create a Blob store in your Vercel project (Storage tab) and set BLOB_READ_WRITE_TOKEN"
    );
}

export async function putAttachmentBlob(
  templateId: string,
  fileName: string,
  mimeType: string,
  body: Buffer
): Promise<string> {
  requireToken();
  const { url } = await put(`attachments/${templateId}/${fileName}`, body, {
    access: "public",
    addRandomSuffix: true,
    contentType: mimeType,
  });
  return url;
}

export async function fetchAttachmentBlob(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok)
    throw new ApiError(502, `Could not read attachment from storage (HTTP ${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}

// Best-effort cleanup: the DB row is the source of truth, and an orphaned
// blob is harmless where a failed user action is not.
export async function deleteAttachmentBlobs(urls: string[]): Promise<void> {
  if (urls.length === 0) return;
  try {
    await del(urls);
  } catch (e) {
    console.error("Blob cleanup failed (orphaned blob left behind):", e);
  }
}
