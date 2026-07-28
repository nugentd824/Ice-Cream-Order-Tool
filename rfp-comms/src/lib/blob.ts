import { put, del, get } from "@vercel/blob";
import { ApiError } from "./api";

// Attachment payloads live in Vercel Blob; Postgres keeps only metadata plus
// the blob URL. Two store generations are supported:
//  - private stores (current default): the runtime is bound to the store
//    (BLOB_STORE_ID is injected, the SDK authenticates via OIDC on Vercel)
//    and reads need an Authorization header;
//  - classic public stores: authenticated by *_READ_WRITE_TOKEN, URLs are
//    unguessable-but-public.
// Either way the URL never leaves the server — browsers download through the
// authenticated /api/attachments/[id] proxy.

export function resolveBlobToken(): string | undefined {
  if (process.env.BLOB_READ_WRITE_TOKEN) return process.env.BLOB_READ_WRITE_TOKEN;
  const key = Object.keys(process.env).find((k) => k.endsWith("_READ_WRITE_TOKEN"));
  return key ? process.env[key] : undefined;
}

export function blobConfigured(): boolean {
  return Boolean(process.env.BLOB_STORE_ID || resolveBlobToken());
}

function requireConfigured() {
  if (!blobConfigured())
    throw new ApiError(
      500,
      "Blob storage is not configured — connect a Blob store to this project (Vercel Storage tab)"
    );
}

// BLOB_STORE_ID marks a store-bound (private) setup; without it we assume a
// classic public store addressed purely by token.
function storeAccess(): "private" | "public" {
  return process.env.BLOB_STORE_ID ? "private" : "public";
}

export async function putAttachmentBlob(
  templateId: string,
  fileName: string,
  mimeType: string,
  body: Buffer
): Promise<string> {
  requireConfigured();
  const token = resolveBlobToken();
  const { url } = await put(`attachments/${templateId}/${fileName}`, body, {
    access: storeAccess(),
    addRandomSuffix: true,
    contentType: mimeType,
    ...(token ? { token } : {}),
  });
  return url;
}

export async function fetchAttachmentBlob(url: string): Promise<Buffer> {
  // Read through the SDK so authentication works exactly like uploads do
  // (store binding on Vercel, token elsewhere) — raw fetches against private
  // stores are rejected.
  const token = resolveBlobToken();
  const result = await get(url, {
    access: storeAccess(),
    ...(token ? { token } : {}),
  });
  if (!result || result.statusCode !== 200 || !result.stream)
    throw new ApiError(502, "Could not read attachment from storage");
  return Buffer.from(await new Response(result.stream).arrayBuffer());
}

// Best-effort cleanup: the DB row is the source of truth, and an orphaned
// blob is harmless where a failed user action is not.
export async function deleteAttachmentBlobs(urls: string[]): Promise<void> {
  if (urls.length === 0) return;
  try {
    const token = resolveBlobToken();
    await del(urls, token ? { token } : undefined);
  } catch (e) {
    console.error("Blob cleanup failed (orphaned blob left behind):", e);
  }
}
