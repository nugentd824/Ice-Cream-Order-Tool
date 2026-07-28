"use client";

import { useRef, useState } from "react";
import { api } from "./clientApi";

export type SendItem = {
  contactId: string;
  audienceId: string;
  label: string;
  // Explicit user intent to send again to a contact who already received this
  // template version (the server refuses otherwise).
  allowResend?: boolean;
};

export type SendProgress = {
  running: boolean;
  total: number;
  done: number;
  ok: number;
  fail: number;
  current: string | null;
};

const IDLE: SendProgress = { running: false, total: 0, done: 0, ok: 0, fail: 0, current: null };

// The browser drives the send loop: one API call per recipient with a delay
// between messages (throttle for spam-filter friendliness). This also keeps
// each serverless invocation short, shows live progress, and lets the user
// cancel between messages. Every attempt is logged server-side regardless.
export function useSendLoop() {
  const [progress, setProgress] = useState<SendProgress>(IDLE);
  const cancelRef = useRef(false);

  const start = async (
    items: SendItem[],
    delayMs: number,
    onDone: (ok: number, fail: number, cancelled: boolean) => void
  ) => {
    cancelRef.current = false;
    let ok = 0;
    let fail = 0;
    setProgress({ running: true, total: items.length, done: 0, ok: 0, fail: 0, current: null });
    for (let i = 0; i < items.length; i++) {
      if (cancelRef.current) break;
      const item = items[i];
      setProgress((p) => ({ ...p, current: item.label }));
      // One idempotency key per recipient per run. Network failures are
      // ambiguous (the send may have gone through), so those are retried with
      // the SAME key — the server replays the recorded outcome rather than
      // sending twice. HTTP errors are real outcomes and are not retried.
      const idempotencyKey = crypto.randomUUID();
      let sent = false;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          await api("/api/send", {
            json: {
              audienceId: item.audienceId,
              contactId: item.contactId,
              idempotencyKey,
              allowResend: item.allowResend === true,
            },
          });
          sent = true;
          break;
        } catch (e) {
          if (e instanceof TypeError && attempt < 2) {
            await new Promise((r) => setTimeout(r, 2000));
            continue;
          }
          break;
        }
      }
      if (sent) ok++;
      else fail++;
      setProgress((p) => ({ ...p, done: i + 1, ok, fail }));
      if (i < items.length - 1 && delayMs > 0) {
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
    const cancelled = cancelRef.current;
    setProgress((p) => ({ ...p, running: false, current: null }));
    onDone(ok, fail, cancelled);
  };

  const cancel = () => {
    cancelRef.current = true;
  };

  const reset = () => setProgress(IDLE);

  return { progress, start, cancel, reset };
}
