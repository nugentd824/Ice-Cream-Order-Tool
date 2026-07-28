import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { guarded, ApiError } from "@/lib/api";
import { renderMerge, contactMergeContext } from "@/lib/merge";
import { sendMailViaGraph } from "@/lib/graph";
import { emailHtmlWrap, loadAudienceBundle, parseBcc } from "@/lib/sendMail";
import { fetchAttachmentBlob } from "@/lib/blob";

// How long an in-flight PENDING claim blocks a competing send for the same
// contact+audience+version. Past this it is treated as abandoned (crashed run).
const PENDING_TTL_MS = 10 * 60 * 1000;

// Sends ONE personalized email to ONE contact. The browser drives the send
// loop (one call per recipient, throttled client-side) so long campaigns
// never hit serverless time limits and every message is individually logged.
//
// Duplicate protection is two-layered:
//  1. idempotencyKey — replaying a key we already processed returns the
//     recorded outcome without sending, so network retries are safe.
//  2. same-version guard — unless allowResend is set, a contact who already
//     has a SENT log for this template version is refused (409), so stale
//     client state or a second tab cannot double-send a campaign.
export const POST = guarded(async (req, _params, session) => {
  if (!session.accessToken)
    throw new ApiError(401, "Microsoft sign-in token unavailable — sign out and back in.");

  const { audienceId, contactId, idempotencyKey, allowResend } = await req.json();
  if (typeof idempotencyKey !== "string" || idempotencyKey.length < 8 || idempotencyKey.length > 128)
    throw new ApiError(400, "idempotencyKey (8–128 chars) is required");

  const prior = await prisma.sendLog.findUnique({ where: { idempotencyKey } });
  if (prior) {
    if (prior.status === "SENT") return NextResponse.json({ log: prior, replayed: true });
    if (prior.status === "PENDING")
      return NextResponse.json(
        { error: "This send is already in progress", log: prior },
        { status: 409 }
      );
    return NextResponse.json(
      { error: prior.error || "Send failed", log: prior, replayed: true },
      { status: 502 }
    );
  }

  const audience = await loadAudienceBundle(audienceId);
  const template = audience.template!;
  const contact = await prisma.contact.findUnique({ where: { id: contactId } });

  if (!contact || contact.clientId !== audience.clientId)
    throw new ApiError(404, "Contact not found");
  if (contact.audienceId !== audience.id)
    throw new ApiError(400, `${contact.email} is not assigned to ${audience.label}`);
  if (!contact.emailValid)
    throw new ApiError(400, `${contact.email} is not a valid email address`);
  if (!template.subject.trim() || !template.bodyHtml.trim())
    throw new ApiError(400, "Template subject and body must not be empty");

  if (allowResend !== true) {
    const staleCutoff = new Date(Date.now() - PENDING_TTL_MS);
    const dup = await prisma.sendLog.findFirst({
      where: {
        contactId: contact.id,
        audienceId: audience.id,
        isTest: false,
        templateVersion: template.version,
        OR: [{ status: "SENT" }, { status: "PENDING", sentAt: { gte: staleCutoff } }],
      },
      select: { status: true },
    });
    if (dup)
      throw new ApiError(
        409,
        dup.status === "PENDING"
          ? `A send to ${contact.email} is already in progress`
          : `${contact.email} already received v${template.version} of this email — select them explicitly to resend`
      );
  }

  const ctx = contactMergeContext(contact, audience.client.name);
  const subject = renderMerge(template.subject, ctx);
  const html = emailHtmlWrap(renderMerge(template.bodyHtml, ctx));

  const logBase = {
    clientId: audience.clientId,
    contactId: contact.id,
    audienceId: audience.id,
    toEmail: contact.email,
    contactName: `${contact.firstName} ${contact.lastName}`.trim(),
    audienceLabel: audience.label,
    subject,
    templateVersion: template.version,
    isTest: false,
  };

  // Claim the key BEFORE contacting Graph. Concurrent duplicates lose the
  // race on the unique index; a crash mid-send leaves the PENDING row as
  // evidence that an email may have gone out.
  let claimed;
  try {
    claimed = await prisma.sendLog.create({
      data: { ...logBase, status: "PENDING", idempotencyKey },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")
      throw new ApiError(409, "This send is already in progress");
    throw e;
  }

  try {
    await sendMailViaGraph(session.accessToken, {
      to: contact.email,
      subject,
      html,
      bcc: parseBcc(audience.bccEmails),
      attachments: await Promise.all(
        template.attachments.map(async (a) => ({
          fileName: a.fileName,
          mimeType: a.mimeType,
          data: await fetchAttachmentBlob(a.blobUrl),
        }))
      ),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Send failed";
    const log = await prisma.sendLog.update({
      where: { id: claimed.id },
      data: { status: "FAILED", error: message },
    });
    return NextResponse.json({ error: message, log }, { status: 502 });
  }

  const log = await prisma.sendLog.update({
    where: { id: claimed.id },
    data: { status: "SENT", sentAt: new Date() },
  });
  return NextResponse.json({ log });
});
