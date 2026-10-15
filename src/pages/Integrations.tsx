import { useEffect, useState } from "react";

import { T, mono } from "@/constants/theme";
import { adminIntegrationsApi, type ConnectionIssue } from "@/lib/api";
import { relativeAge } from "@/lib/relativeTime";
import { useFetch } from "@/lib/useFetch";
import { withStepUp } from "@/lib/stepUp";

type TabId = "disconnected" | "scan_errors" | "stuck_scans";
const TABS: { id: TabId; label: string }[] = [
  { id: "disconnected", label: "Disconnected (needs re-auth)" },
  { id: "scan_errors", label: "Scan errors" },
  { id: "stuck_scans", label: "Stuck scans" },
];

const PROVIDER_LABEL: Record<string, string> = { gmail: "Gmail", google_drive: "Drive" };

export default function Integrations() {
  const [tab, setTab] = useState<TabId>("disconnected");
  const [counts, setCounts] = useState<Partial<Record<TabId, number>>>({});
  const [refreshNonce, setRefreshNonce] = useState(0);

  return (
    <div>
      <h1 style={{ fontSize: 26, fontWeight: 800, color: "#fff", margin: "0 0 6px" }}>Integrations</h1>
      <p style={{ color: T.muted, fontSize: 14.5, margin: "0 0 16px" }}>
        Gmail and Drive connection health, scan errors, forced disconnect. A connected account's OAuth token itself
        is never shown here, only its operational state.
      </p>

      <div style={{ display: "flex", gap: 4, borderBottom: `1px solid ${T.border}`, marginBottom: 14, overflowX: "auto" }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              background: "none", border: 0, borderBottom: `2px solid ${tab === t.id ? T.gold : "transparent"}`,
              color: tab === t.id ? "#fff" : T.muted, padding: "9px 12px", fontWeight: 600, fontSize: 13,
              cursor: "pointer", whiteSpace: "nowrap", marginBottom: -1,
            }}
          >
            {t.label}
            {counts[t.id] !== undefined && <em style={{ fontFamily: mono, fontSize: 11, fontStyle: "normal", marginLeft: 6, color: T.faint }}>{counts[t.id]}</em>}
          </button>
        ))}
      </div>

      {tab === "disconnected" && (
        <IssueTab
          fetcher={adminIntegrationsApi.disconnected}
          emptyLabel="No disconnected connections needing re-auth."
          refreshNonce={refreshNonce}
          onCount={(n) => setCounts((c) => ({ ...c, disconnected: n }))}
          onChanged={() => setRefreshNonce((n) => n + 1)}
          extraColumn={null}
        />
      )}
      {tab === "scan_errors" && (
        <IssueTab
          fetcher={adminIntegrationsApi.scanErrors}
          emptyLabel="No scan errors."
          refreshNonce={refreshNonce}
          onCount={(n) => setCounts((c) => ({ ...c, scan_errors: n }))}
          onChanged={() => setRefreshNonce((n) => n + 1)}
          extraColumn="error"
        />
      )}
      {tab === "stuck_scans" && (
        <IssueTab
          fetcher={adminIntegrationsApi.stuckScans}
          emptyLabel="No scans stuck for over an hour."
          refreshNonce={refreshNonce}
          onCount={(n) => setCounts((c) => ({ ...c, stuck_scans: n }))}
          onChanged={() => setRefreshNonce((n) => n + 1)}
          extraColumn="phase"
        />
      )}
    </div>
  );
}

function IssueTab({ fetcher, emptyLabel, refreshNonce, onCount, onChanged, extraColumn }: {
  fetcher: (limit?: number) => Promise<{ total: number; items: ConnectionIssue[] }>;
  emptyLabel: string;
  refreshNonce: number;
  onCount: (n: number) => void;
  onChanged: () => void;
  extraColumn: "error" | "phase" | null;
}) {
  const { data, error } = useFetch(() => fetcher(), [refreshNonce]);
  useEffect(() => { if (data) onCount(data.total); }, [data, onCount]);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  if (error) return <ErrorMsg message={error} />;
  if (!data) return null;
  if (data.total === 0) return <Empty label={emptyLabel} />;

  return (
    <Table headers={["Provider", "Account", "Owner", extraColumn === "error" ? "Error" : extraColumn === "phase" ? "Phase" : "Status", "Updated", ""]}>
      {data.items.map((c) => (
        <tr key={c.id}>
          <Td>{PROVIDER_LABEL[c.provider] ?? c.provider}</Td>
          <Td muted><span style={{ fontFamily: mono, fontSize: 12 }}>{c.providerEmail}</span></Td>
          <Td muted><span style={{ fontFamily: mono, fontSize: 12 }}>{c.userId}</span></Td>
          <Td>
            {extraColumn === "error" ? (
              <span style={{ color: T.coral, fontSize: 12 }}>{c.lastScanError}</span>
            ) : extraColumn === "phase" ? (
              <span style={{ color: T.gold, fontFamily: mono, fontSize: 12 }}>{c.scanPhase ?? "—"} ({c.scanProcessed}/{c.scanTotal || "?"})</span>
            ) : (
              <span style={{ fontFamily: mono, fontSize: 11, padding: "2px 8px", borderRadius: 999, background: "rgba(232,115,106,.14)", color: T.coral }}>{c.status}</span>
            )}
          </Td>
          <Td muted><span style={{ fontFamily: mono, fontSize: 12 }}>{relativeAge(c.updatedAt)} ago</span></Td>
          <Td>
            {confirmingId === c.id ? (
              <DisconnectConfirm connectionId={c.id} onDone={() => { setConfirmingId(null); onChanged(); }} onCancel={() => setConfirmingId(null)} />
            ) : (
              <button onClick={() => setConfirmingId(c.id)} style={{ border: `1px solid ${T.border}`, background: T.raised, color: T.coral, borderRadius: 7, padding: "4px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                Force disconnect
              </button>
            )}
          </Td>
        </tr>
      ))}
    </Table>
  );
}

function DisconnectConfirm({ connectionId, onDone, onCancel }: { connectionId: string; onDone: () => void; onCancel: () => void }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    if (reason.trim().length < 3) { setError("Reason required, min 3 chars."); return; }
    setBusy(true); setError(null);
    try {
      await withStepUp(() => adminIntegrationsApi.disconnect(connectionId, reason));
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Disconnect failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ minWidth: 220 }}>
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason…"
        style={{ width: "100%", boxSizing: "border-box", background: "#171E2E", border: `1px solid ${T.border}`, borderRadius: 6, padding: "5px 8px", fontSize: 11.5, color: T.text, marginBottom: 4 }}
      />
      {error && <p style={{ color: T.coral, fontSize: 10.5, margin: "0 0 4px" }}>{error}</p>}
      <div style={{ display: "flex", gap: 4 }}>
        <button onClick={confirm} disabled={busy} style={{ background: T.coral, border: "none", color: "#fff", borderRadius: 6, padding: "4px 9px", fontSize: 10.5, fontWeight: 700, cursor: "pointer", opacity: busy ? 0.7 : 1 }}>
          {busy ? "…" : "Confirm"}
        </button>
        <button onClick={onCancel} disabled={busy} style={{ background: "transparent", border: `1px solid ${T.border}`, color: T.muted, borderRadius: 6, padding: "4px 9px", fontSize: 10.5, cursor: "pointer" }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function Table({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 14, overflow: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 700 }}>
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h} style={{ textAlign: "left", padding: "9px 12px", fontFamily: mono, fontSize: 10.5, letterSpacing: 0.6, color: T.muted, textTransform: "uppercase", borderBottom: `1px solid ${T.border}` }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
function Td({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return <td style={{ padding: "9px 12px", borderBottom: `1px solid ${T.border}`, color: muted ? T.muted : T.text }}>{children}</td>;
}
function Empty({ label }: { label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 16, background: T.panel, border: `1px solid ${T.border}`, borderRadius: 14 }}>
      <span style={{ color: T.mint }}>✓</span>
      <span style={{ fontSize: 13, color: T.text }}>{label}</span>
    </div>
  );
}
function ErrorMsg({ message }: { message: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 16, background: "rgba(232,115,106,.08)", border: `1px solid ${T.coral}55`, borderRadius: 14 }}>
      <span style={{ color: T.coral }}>⚠</span>
      <span style={{ fontSize: 13, color: T.text }}>{message}</span>
    </div>
  );
}
