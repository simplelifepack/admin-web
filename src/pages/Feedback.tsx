import { useEffect, useState } from "react";

import { T, mono } from "@/constants/theme";
import {
  adminAdminsApi, adminFeedbackApi, type AdminListItem, type FeedbackCategory,
  type FeedbackDetail, type FeedbackListItem, type FeedbackStatus,
} from "@/lib/api";
import { relativeAge } from "@/lib/relativeTime";

const STATUS_LABEL: Record<FeedbackStatus, string> = {
  open: "Open", in_progress: "In progress", resolved: "Resolved", dismissed: "Dismissed",
};
const STATUS_COLOR: Record<FeedbackStatus, string> = {
  open: T.coral, in_progress: T.gold, resolved: T.mint, dismissed: T.faint,
};
const CATEGORY_LABEL: Record<FeedbackCategory, string> = { bug: "Bug", idea: "Idea", other: "Other" };
const PLATFORM_LABEL: Record<string, string> = { web: "Web", ios: "iOS", android: "Android" };

function ErrorMsg({ message }: { message: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 16, background: "rgba(232,115,106,.08)", border: `1px solid ${T.coral}55`, borderRadius: 14, marginBottom: 12 }}>
      <span style={{ color: T.coral }}>⚠</span>
      <span style={{ fontSize: 13, color: T.text }}>{message}</span>
    </div>
  );
}

const fieldStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", background: "#171E2E", border: `1px solid ${T.border}`, borderRadius: 7,
  padding: "7px 9px", fontSize: 12.5, color: T.text,
};
const ghostBtn: React.CSSProperties = {
  background: "transparent", border: `1px solid ${T.border}`, color: T.text, borderRadius: 8,
  padding: "6px 12px", fontSize: 11.5, fontWeight: 600, cursor: "pointer",
};
const goldBtn: React.CSSProperties = {
  background: T.gold, border: "none", color: T.inkOnGold, borderRadius: 8,
  padding: "7px 13px", fontSize: 12, fontWeight: 700, cursor: "pointer",
};

export default function Feedback() {
  const [statusFilter, setStatusFilter] = useState<FeedbackStatus | "">("open");
  const [categoryFilter, setCategoryFilter] = useState<FeedbackCategory | "">("");
  const [items, setItems] = useState<FeedbackListItem[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<FeedbackDetail | null>(null);
  const [admins, setAdmins] = useState<AdminListItem[] | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);

  useEffect(() => {
    adminFeedbackApi.list({ status: statusFilter || undefined, category: categoryFilter || undefined })
      .then((res) => {
        setItems(res.items);
        setTotal(res.total);
        if (res.items.length && !res.items.some((i) => i.id === selectedId)) setSelectedId(res.items[0].id);
        if (!res.items.length) setSelectedId(null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load feedback."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, categoryFilter, refreshNonce]);

  useEffect(() => {
    if (!selectedId) { setDetail(null); return; }
    let active = true;
    adminFeedbackApi.get(selectedId).then((res) => { if (active) setDetail(res.item); }).catch(() => { if (active) setDetail(null); });
    return () => { active = false; };
  }, [selectedId, refreshNonce]);

  useEffect(() => {
    adminAdminsApi.list().then((res) => setAdmins(res.admins)).catch(() => setAdmins(null));
  }, []);

  function reload() { setRefreshNonce((n) => n + 1); }

  return (
    <div>
      <h1 style={{ fontSize: 26, fontWeight: 800, color: "#fff", margin: "0 0 6px" }}>Feedback &amp; support</h1>
      <p style={{ color: T.muted, fontSize: 14.5, margin: "0 0 16px" }}>
        User-submitted feedback and issues, triaged and resolved from one queue. {total} ticket{total === 1 ? "" : "s"} matching this filter.
      </p>

      {error && <ErrorMsg message={error} />}

      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        {(["", "open", "in_progress", "resolved", "dismissed"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            style={{
              border: `1px solid ${statusFilter === s ? T.gold + "88" : T.border}`,
              background: statusFilter === s ? T.raised : T.panel, color: statusFilter === s ? "#fff" : T.muted,
              borderRadius: 999, padding: "6px 13px", fontSize: 12.5, fontWeight: 600, cursor: "pointer",
            }}
          >
            {s === "" ? "All" : STATUS_LABEL[s]}
          </button>
        ))}
        <span style={{ width: 1, background: T.border, margin: "0 4px" }} />
        {(["", "bug", "idea", "other"] as const).map((c) => (
          <button
            key={c}
            onClick={() => setCategoryFilter(c)}
            style={{
              border: `1px solid ${categoryFilter === c ? T.gold + "88" : T.border}`,
              background: categoryFilter === c ? T.raised : T.panel, color: categoryFilter === c ? "#fff" : T.muted,
              borderRadius: 999, padding: "6px 13px", fontSize: 12.5, fontWeight: 600, cursor: "pointer",
            }}
          >
            {c === "" ? "Any category" : CATEGORY_LABEL[c]}
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.3fr) minmax(300px,1fr)", gap: 14, alignItems: "start" }}>
        <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 14, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                {["Status", "From", "Category", "Message", "Submitted"].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: "9px 12px", fontFamily: mono, fontSize: 10.5, letterSpacing: 0.6, color: T.muted, textTransform: "uppercase", borderBottom: `1px solid ${T.border}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(items ?? []).map((item) => (
                <tr key={item.id} onClick={() => setSelectedId(item.id)} style={{ cursor: "pointer", background: item.id === selectedId ? T.raised : "transparent" }}>
                  <td style={{ padding: "10px 12px", borderBottom: `1px solid ${T.border}` }}>
                    <span style={{ fontFamily: mono, fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: `${STATUS_COLOR[item.status]}22`, color: STATUS_COLOR[item.status] }}>
                      {STATUS_LABEL[item.status]}
                    </span>
                  </td>
                  <td style={{ padding: "10px 12px", borderBottom: `1px solid ${T.border}`, fontSize: 12 }}>
                    {item.email}
                    <div style={{ color: T.faint, fontSize: 10.5 }}>{PLATFORM_LABEL[item.platform] ?? item.platform}</div>
                  </td>
                  <td style={{ padding: "10px 12px", borderBottom: `1px solid ${T.border}`, color: T.muted, fontSize: 12 }}>{CATEGORY_LABEL[item.category]}</td>
                  <td style={{ padding: "10px 12px", borderBottom: `1px solid ${T.border}`, color: T.text, fontSize: 12, maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.message}</td>
                  <td style={{ padding: "10px 12px", borderBottom: `1px solid ${T.border}`, color: T.muted, fontFamily: mono, fontSize: 11.5 }}>{relativeAge(item.createdAt)} ago</td>
                </tr>
              ))}
              {items && items.length === 0 && (
                <tr><td colSpan={5} style={{ padding: 16, color: T.muted, textAlign: "center" }}>No tickets match.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {detail && <DetailCard detail={detail} admins={admins} onChanged={reload} />}
      </div>
    </div>
  );
}

function DetailCard({ detail, admins, onChanged }: { detail: FeedbackDetail; admins: AdminListItem[] | null; onChanged: () => void }) {
  const [note, setNote] = useState(detail.resolutionNote ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setNote(detail.resolutionNote ?? ""); }, [detail.id, detail.resolutionNote]);

  async function setStatus(status: FeedbackStatus) {
    setBusy(true); setError(null);
    try {
      await adminFeedbackApi.setStatus(detail.id, status, note || undefined);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setBusy(false);
    }
  }

  async function assign(adminId: string | null) {
    setBusy(true); setError(null);
    try {
      await adminFeedbackApi.assign(detail.id, adminId);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Assign failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 14, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div>
          <span style={{ fontFamily: mono, fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: `${STATUS_COLOR[detail.status]}22`, color: STATUS_COLOR[detail.status] }}>
            {STATUS_LABEL[detail.status]}
          </span>
          <div style={{ color: T.muted, fontSize: 12, marginTop: 6 }}>{detail.email} · {PLATFORM_LABEL[detail.platform] ?? detail.platform} · {CATEGORY_LABEL[detail.category]}</div>
        </div>
        <span style={{ color: T.faint, fontSize: 10.5, fontFamily: mono }}>{new Date(detail.createdAt).toLocaleString()}</span>
      </div>

      <p style={{ color: T.text, fontSize: 13, lineHeight: 1.6, background: "rgba(11,18,32,.5)", border: `1px solid ${T.border}`, borderRadius: 9, padding: 10, margin: "0 0 14px" }}>
        {detail.message}
      </p>

      <Label text="Assigned to" />
      <select
        value={detail.assignedToAdminId ?? ""}
        onChange={(e) => assign(e.target.value || null)}
        disabled={busy}
        style={{ ...fieldStyle, marginBottom: 14 }}
      >
        <option value="">Unassigned</option>
        {(admins ?? []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
      </select>

      <Label text="Resolution note" />
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={3}
        placeholder="What happened / how it was resolved…"
        style={{ ...fieldStyle, resize: "vertical", marginBottom: 10 }}
      />

      {error && <p style={{ color: T.coral, fontSize: 11.5, margin: "0 0 8px" }}>{error}</p>}

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {detail.status !== "in_progress" && (
          <button onClick={() => setStatus("in_progress")} disabled={busy} style={ghostBtn}>Mark in progress</button>
        )}
        {detail.status !== "resolved" && (
          <button onClick={() => setStatus("resolved")} disabled={busy} style={{ ...goldBtn, opacity: busy ? 0.7 : 1 }}>Resolve</button>
        )}
        {detail.status !== "dismissed" && (
          <button onClick={() => setStatus("dismissed")} disabled={busy} style={{ ...ghostBtn, color: T.coral }}>Dismiss</button>
        )}
        {detail.status !== "open" && (
          <button onClick={() => setStatus("open")} disabled={busy} style={ghostBtn}>Reopen</button>
        )}
      </div>
    </div>
  );
}

function Label({ text }: { text: string }) {
  return <span style={{ display: "block", fontFamily: mono, fontSize: 10.5, letterSpacing: 1, color: T.faint, textTransform: "uppercase", margin: "0 0 6px" }}>{text}</span>;
}
