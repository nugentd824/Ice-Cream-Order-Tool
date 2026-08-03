"use client";

import { useRef, useState } from "react";
import type { AttachmentMeta, ContactDTO } from "@/lib/types";
import { api } from "@/lib/clientApi";
import { fmtBytes } from "@/lib/format";
import { Modal } from "@/components/ui";
import { useToast } from "@/components/toast";

// Vendor-specific files for one supplier. Anything uploaded here is
// automatically included in every email sent to this contact, on top of the
// audience template's shared attachments.
export function ContactAttachmentsModal({
  contact,
  onClose,
  onChanged,
}: {
  contact: ContactDTO;
  onClose: () => void;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [files, setFiles] = useState<AttachmentMeta[]>(contact.attachments);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = async (list: FileList | null) => {
    if (!list || list.length === 0) return;
    setBusy(true);
    try {
      for (const f of Array.from(list)) {
        const fd = new FormData();
        fd.append("file", f);
        const meta = await api<AttachmentMeta>(`/api/contacts/${contact.id}/attachments`, {
          method: "POST",
          body: fd,
        });
        setFiles((prev) => [...prev, meta]);
      }
      onChanged();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const remove = async (id: string) => {
    setBusy(true);
    try {
      await api(`/api/contact-attachments/${id}`, { method: "DELETE" });
      setFiles((prev) => prev.filter((f) => f.id !== id));
      onChanged();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  const total = files.reduce((s, f) => s + f.size, 0);

  return (
    <Modal
      title={`Vendor files — ${contact.company || contact.email}`}
      onClose={onClose}
      footer={
        <button className="btn primary" onClick={onClose}>
          Done
        </button>
      }
    >
      <div className="stack">
        <p className="subtle" style={{ margin: 0 }}>
          Files here go out <strong>automatically with every email to this supplier</strong> —
          on top of the audience template's shared attachments. Use them for vendor-specific
          items like pricing sheets or site packets.
        </p>

        {files.length === 0 ? (
          <p className="faint">No vendor-specific files yet.</p>
        ) : (
          <div className="stack" style={{ gap: 6 }}>
            {files.map((f) => (
              <div key={f.id} className="row between" style={{ gap: 8 }}>
                <a href={`/api/contact-attachments/${f.id}`} className="attachment-chip">
                  📎 {f.fileName} <span className="faint">{fmtBytes(f.size)}</span>
                </a>
                <button className="btn ghost sm" disabled={busy} onClick={() => remove(f.id)}>
                  Remove
                </button>
              </div>
            ))}
            <p className="faint" style={{ margin: 0 }}>
              {files.length} file(s) · {fmtBytes(total)} total
            </p>
          </div>
        )}

        <div>
          <input
            ref={inputRef}
            type="file"
            multiple
            style={{ display: "none" }}
            onChange={(e) => upload(e.target.files)}
          />
          <button className="btn" disabled={busy} onClick={() => inputRef.current?.click()}>
            {busy ? "Uploading…" : "+ Add file(s)"}
          </button>
          <span className="faint" style={{ marginLeft: 8 }}>
            Up to 4 MB per file
          </span>
        </div>
      </div>
    </Modal>
  );
}
