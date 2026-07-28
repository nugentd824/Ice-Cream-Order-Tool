"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/clientApi";
import type { ClientListPage } from "@/lib/types";
import { fmtDateOnly } from "@/lib/format";
import { ClientStatusPill, SendStatusPill, EmptyState, Modal } from "@/components/ui";
import { useToast } from "@/components/toast";

const PAGE_SIZE = 20;

export default function Dashboard() {
  const [data, setData] = useState<ClientListPage | null>(null);
  const [page, setPage] = useState(1);
  const [showAdd, setShowAdd] = useState(false);
  const router = useRouter();
  const toast = useToast();

  const load = useCallback(() => {
    api<ClientListPage>(`/api/clients?page=${page}&pageSize=${PAGE_SIZE}`)
      .then(setData)
      .catch((e) => toast(e.message, "error"));
  }, [page, toast]);

  useEffect(load, [load]);

  return (
    <div>
      <div className="row between" style={{ marginBottom: 20 }}>
        <div>
          <h1>Client Engagements</h1>
          <p className="subtle">All pre-RFP communication campaigns, one workspace per client.</p>
        </div>
        <button className="btn primary" onClick={() => setShowAdd(true)}>
          + Add New Client
        </button>
      </div>

      {data === null ? (
        <p className="subtle">Loading…</p>
      ) : data.total === 0 ? (
        <EmptyState
          title="No client engagements yet"
          hint="Add your first client to set up its supplier list, audiences, and communications."
          action={
            <button className="btn primary" onClick={() => setShowAdd(true)}>
              + Add New Client
            </button>
          }
        />
      ) : (
        <>
        <div className="card-grid">
          {data.clients.map((c) => (
            <div
              key={c.id}
              className="card client-card"
              onClick={() => router.push(`/clients/${c.id}`)}
              role="link"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && router.push(`/clients/${c.id}`)}
            >
              <div className="row between" style={{ marginBottom: 4 }}>
                <h2 style={{ marginBottom: 0 }}>{c.name}</h2>
                <ClientStatusPill status={c.status} />
              </div>
              {c.engagement && <div className="subtle">{c.engagement}</div>}
              <div className="row wrap" style={{ margin: "12px 0" }}>
                <span className="pill gray">{c.totalContacts} contacts</span>
                <span className="pill blue">{c.assignedContacts} assigned</span>
                {c.unassignedContacts > 0 && (
                  <span className="pill amber">{c.unassignedContacts} unassigned</span>
                )}
              </div>
              <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
                <tbody>
                  {c.audiences.map((a) => (
                    <tr key={a.id}>
                      <td style={{ padding: "3px 0", fontWeight: 600 }}>{a.label}</td>
                      <td className="subtle" style={{ textAlign: "right", padding: "3px 8px" }}>
                        {a.sentCount}/{a.assignedCount}
                      </td>
                      <td style={{ textAlign: "right", padding: "3px 0", width: 110 }}>
                        <SendStatusPill status={a.sendStatus} />
                      </td>
                      <td className="faint" style={{ textAlign: "right", padding: "3px 0", width: 105 }}>
                        {a.targetSendDate ? fmtDateOnly(a.targetSendDate) : "no date"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
        {data.total > PAGE_SIZE && (
          <div className="row between" style={{ marginTop: 20 }}>
            <span className="subtle">
              Showing {(data.page - 1) * data.pageSize + 1}–
              {Math.min(data.page * data.pageSize, data.total)} of {data.total} clients
            </span>
            <div className="row">
              <button className="btn" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                ← Previous
              </button>
              <button
                className="btn"
                disabled={page * PAGE_SIZE >= data.total}
                onClick={() => setPage((p) => p + 1)}
              >
                Next →
              </button>
            </div>
          </div>
        )}
        </>
      )}

      {showAdd && (
        <AddClientModal
          onClose={() => setShowAdd(false)}
          onCreated={(id) => router.push(`/clients/${id}`)}
        />
      )}
    </div>
  );
}

function AddClientModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [engagement, setEngagement] = useState("");
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const submit = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const { id } = await api<{ id: string }>("/api/clients", {
        json: { name, engagement },
      });
      onCreated(id);
    } catch (e) {
      toast((e as Error).message, "error");
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Add New Client"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" disabled={!name.trim() || busy} onClick={submit}>
            Create Client
          </button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label className="field">
          <span>Client name *</span>
          <input
            type="text"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Acme Foods"
          />
        </label>
        <label className="field">
          <span>Engagement name / year</span>
          <input
            type="text"
            value={engagement}
            onChange={(e) => setEngagement(e.target.value)}
            placeholder='e.g., "Q4 2026 Packaging RFP"'
          />
        </label>
        <p className="faint">
          Two audiences (&ldquo;Audience A&rdquo; and &ldquo;Audience B&rdquo;) are created
          automatically — rename them in the workspace.
        </p>
      </form>
    </Modal>
  );
}
