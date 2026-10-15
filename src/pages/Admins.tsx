import { useEffect, useState } from "react";

import { T, mono } from "@/constants/theme";
import { adminAdminsApi, type AccessReviewStatus, type AdminDetail, type AdminListItem, type AdminRoleName } from "@/lib/api";
import { withStepUp } from "@/lib/stepUp";

const ROLES: AdminRoleName[] = ["support", "catalogue", "ops_security", "owner"];
const ROLE_LABEL: Record<AdminRoleName, string> = {
  support: "Support", catalogue: "Catalogue", ops_security: "Ops & security", owner: "Owner",
};

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

function ErrorMsg({ message }: { message: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 16, background: "rgba(232,115,106,.08)", border: `1px solid ${T.coral}55`, borderRadius: 14, marginBottom: 12 }}>
      <span style={{ color: T.coral }}>⚠</span>
      <span style={{ fontSize: 13, color: T.text }}>{message}</span>
    </div>
  );
}

export default function Admins() {
  const [admins, setAdmins] = useState<AdminListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminDetail | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [inviting, setInviting] = useState(false);

  function reload() {
    adminAdminsApi.list()
      .then((res) => {
        setAdmins(res.admins);
        if (res.admins.length && !res.admins.some((a) => a.id === selectedId)) setSelectedId(res.admins[0].id);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load admins."));
  }
  useEffect(reload, [refreshNonce]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedId) { setDetail(null); return; }
    let active = true;
    adminAdminsApi.get(selectedId).then((res) => { if (active) setDetail(res.admin); }).catch(() => { if (active) setDetail(null); });
    return () => { active = false; };
  }, [selectedId, refreshNonce]);

  return (
    <div>
      <h1 style={{ fontSize: 26, fontWeight: 800, color: "#fff", margin: "0 0 6px" }}>Admins &amp; roles</h1>
      <p style={{ color: T.muted, fontSize: 14.5, margin: "0 0 16px" }}>
        Who can do what. Owner-only — everything here needs a fresh passkey verification. Admin accounts are
        provisioned, not self-registered: creating one here is the whole invitation, and the new admin enrolls
        their own passkey on first real Google sign-in.
      </p>

      {error && <ErrorMsg message={error} />}

      <AccessReviewCard />

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.2fr) minmax(300px,1fr)", gap: 14, alignItems: "start" }}>
        <div>
          <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 14, overflow: "hidden", marginBottom: 12 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  {["Admin", "Role", "Sessions", "Passkeys", "Last login"].map((h) => (
                    <th key={h} style={{ textAlign: "left", padding: "9px 12px", fontFamily: mono, fontSize: 10.5, letterSpacing: 0.6, color: T.muted, textTransform: "uppercase", borderBottom: `1px solid ${T.border}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(admins ?? []).map((a) => (
                  <tr key={a.id} onClick={() => setSelectedId(a.id)} style={{ cursor: "pointer", background: a.id === selectedId ? T.raised : "transparent" }}>
                    <td style={{ padding: "10px 12px", borderBottom: `1px solid ${T.border}` }}>
                      <div style={{ color: a.disabledAt ? T.faint : "#fff", fontWeight: 600 }}>{a.name}{a.disabledAt && " (disabled)"}</div>
                      <div style={{ color: T.muted, fontSize: 11.5 }}>{a.email}</div>
                    </td>
                    <td style={{ padding: "10px 12px", borderBottom: `1px solid ${T.border}` }}>
                      <span style={{ fontFamily: mono, fontSize: 11, padding: "2px 8px", borderRadius: 999, background: a.role === "owner" ? "rgba(217,184,106,.16)" : "rgba(147,160,181,.12)", color: a.role === "owner" ? T.gold : T.muted }}>
                        {ROLE_LABEL[a.role]}
                      </span>
                    </td>
                    <td style={{ padding: "10px 12px", borderBottom: `1px solid ${T.border}`, color: T.muted, fontSize: 12 }}>{a.activeSessionCount}</td>
                    <td style={{ padding: "10px 12px", borderBottom: `1px solid ${T.border}`, color: T.muted, fontSize: 12 }}>{a.passkeyCount}</td>
                    <td style={{ padding: "10px 12px", borderBottom: `1px solid ${T.border}`, color: T.muted, fontSize: 12 }}>{a.lastLoginAt ? new Date(a.lastLoginAt).toLocaleDateString() : "never"}</td>
                  </tr>
                ))}
                {admins && admins.length === 0 && (
                  <tr><td colSpan={5} style={{ padding: 16, color: T.muted, textAlign: "center" }}>No admins.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {!inviting ? (
            <button onClick={() => setInviting(true)} style={ghostBtn}>+ Invite admin</button>
          ) : (
            <InviteCard onDone={() => { setInviting(false); setRefreshNonce((n) => n + 1); }} onCancel={() => setInviting(false)} />
          )}
        </div>

        {detail && <AdminDetailCard key={`${detail.id}-${refreshNonce}`} admin={detail} onChanged={() => setRefreshNonce((n) => n + 1)} />}
      </div>
    </div>
  );
}

function timeAgo(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

function AccessReviewCard() {
  const [status, setStatus] = useState<AccessReviewStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function load() {
    adminAdminsApi.accessReview().then(setStatus).catch((err) => setError(err instanceof Error ? err.message : "Failed to load."));
  }
  useEffect(load, []);

  async function submit() {
    if (note.trim().length < 3) { setSubmitError("Describe what was reviewed, at least 3 characters."); return; }
    setBusy(true); setSubmitError(null);
    try {
      await withStepUp(() => adminAdminsApi.recordAccessReview(note));
      setNote(""); setReviewing(false);
      load();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to record review.");
    } finally {
      setBusy(false);
    }
  }

  if (error) return <div style={{ marginBottom: 14 }}><ErrorMsg message={error} /></div>;
  if (!status) return null;

  return (
    <div style={{
      background: T.panel, border: `1px solid ${status.overdue ? T.coral + "66" : T.border}`, borderRadius: 14,
      padding: 16, marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap",
    }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <b style={{ color: "#fff", fontSize: 14 }}>Quarterly access review</b>
          <span style={{
            fontFamily: mono, fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 999,
            background: status.overdue ? "rgba(232,115,106,.14)" : "rgba(79,203,149,.14)", color: status.overdue ? T.coral : T.mint,
          }}>
            {status.overdue ? "overdue" : "up to date"}
          </span>
        </div>
        {status.lastReviewedAt ? (
          <p style={{ color: T.muted, fontSize: 12.5, margin: 0 }}>
            Last reviewed {timeAgo(status.lastReviewedAt)} by {status.lastReviewedBy} — "{status.lastReviewNote}"
            <br />
            <span style={{ color: T.faint, fontSize: 11 }}>Next due {status.dueAt ? new Date(status.dueAt).toLocaleDateString() : "—"} ({status.cadenceDays}-day cadence)</span>
          </p>
        ) : (
          <p style={{ color: T.muted, fontSize: 12.5, margin: 0 }}>Never recorded. Review the roster below — every admin's role, sessions and passkeys — then mark it reviewed.</p>
        )}
      </div>

      {!reviewing ? (
        <button onClick={() => setReviewing(true)} style={goldBtn}>Mark reviewed</button>
      ) : (
        <div style={{ minWidth: 280 }}>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What was reviewed / any action taken…"
            style={{ ...fieldStyle, marginBottom: 6 }}
          />
          {submitError && <p style={{ color: T.coral, fontSize: 11, margin: "0 0 6px" }}>{submitError}</p>}
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={submit} disabled={busy} style={{ ...goldBtn, opacity: busy ? 0.7 : 1 }}>{busy ? "Recording…" : "Confirm"}</button>
            <button onClick={() => { setReviewing(false); setSubmitError(null); }} disabled={busy} style={ghostBtn}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

function InviteCard({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<AdminRoleName>("support");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    if (!email.trim() || !name.trim()) { setError("Email and name are required."); return; }
    if (reason.trim().length < 3) { setError("Reason must be at least 3 characters."); return; }
    setBusy(true); setError(null);
    try {
      await withStepUp(() => adminAdminsApi.invite({ email: email.trim(), name: name.trim(), role }, reason));
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invite failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ background: T.panel, border: `1px dashed ${T.border}`, borderRadius: 14, padding: 14, marginTop: 10 }}>
      <b style={{ display: "block", color: "#fff", fontSize: 13.5, marginBottom: 10 }}>Invite a new admin</b>
      <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Google account email" style={{ ...fieldStyle, marginBottom: 8 }} />
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" style={{ ...fieldStyle, marginBottom: 8 }} />
      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
        {ROLES.map((r) => (
          <button key={r} onClick={() => setRole(r)} style={{ flex: 1, padding: "6px 0", fontSize: 11, fontFamily: mono, borderRadius: 7, cursor: "pointer", border: `1px solid ${role === r ? T.gold + "88" : T.border}`, background: role === r ? T.raised : "transparent", color: role === r ? "#fff" : T.muted }}>
            {r}
          </button>
        ))}
      </div>
      <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (required, min 3 chars)…" style={{ ...fieldStyle, marginBottom: 8 }} />
      {error && <p style={{ color: T.coral, fontSize: 11.5, margin: "0 0 8px" }}>{error}</p>}
      <div style={{ display: "flex", gap: 6 }}>
        <button onClick={create} disabled={busy} style={{ ...goldBtn, opacity: busy ? 0.7 : 1 }}>{busy ? "Inviting…" : "Invite"}</button>
        <button onClick={onCancel} disabled={busy} style={ghostBtn}>Cancel</button>
      </div>
      <p style={{ color: T.faint, fontSize: 10.5, margin: "8px 0 0" }}>
        No invitation email is sent — the new admin signs in with this exact Google account to enroll their passkey.
      </p>
    </div>
  );
}

type ActionId = "role" | "disable" | "enable";

function AdminDetailCard({ admin, onChanged }: { admin: AdminDetail; onChanged: () => void }) {
  const [activeAction, setActiveAction] = useState<ActionId | null>(null);
  const [newRole, setNewRole] = useState<AdminRoleName>(admin.role);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openAction(id: ActionId) {
    setActiveAction(id);
    setNewRole(admin.role);
    setReason("");
    setError(null);
  }

  async function confirmAction() {
    if (!activeAction) return;
    if (reason.trim().length < 3) { setError("Reason must be at least 3 characters."); return; }
    setBusy(true); setError(null);
    try {
      await withStepUp(async () => {
        if (activeAction === "role") return adminAdminsApi.changeRole(admin.id, newRole, reason);
        if (activeAction === "disable") return adminAdminsApi.disable(admin.id, reason);
        return adminAdminsApi.enable(admin.id, reason);
      });
      setActiveAction(null);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  }

  async function revokeSession(sessionId: string) {
    setBusy(true); setError(null);
    try {
      await withStepUp(() => adminAdminsApi.revokeSession(admin.id, sessionId, "Revoked from admin detail panel"));
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Revoke failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 14, padding: 16 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 10 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: "#313743", color: T.gold, display: "grid", placeItems: "center", fontWeight: 700 }}>
          {admin.name.charAt(0)}
        </div>
        <div>
          <strong style={{ display: "block", color: "#fff", fontSize: 14.5 }}>{admin.name}</strong>
          <span style={{ color: T.muted, fontSize: 12 }}>{admin.email}</span>
        </div>
      </div>
      <div style={{ fontFamily: mono, fontSize: 10.5, color: T.faint, marginBottom: 14 }}>{admin.id}</div>

      {admin.disabledAt && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "rgba(232,115,106,.1)", border: `1px solid ${T.coral}55`, borderRadius: 9, fontSize: 12, marginBottom: 14 }}>
          <span style={{ color: T.coral }}>⛔</span>
          <span>Disabled {new Date(admin.disabledAt).toLocaleString()}</span>
        </div>
      )}

      <Label text="Sessions" />
      {admin.sessions.length === 0 && <p style={{ color: T.muted, fontSize: 12, margin: "0 0 8px" }}>No sessions.</p>}
      {admin.sessions.map((s) => (
        <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderBottom: `1px solid ${T.border}`, fontSize: 12 }}>
          <span>
            <span style={{ fontFamily: mono, fontSize: 10.5, fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: s.revokedAt ? "rgba(147,160,181,.12)" : "rgba(79,203,149,.14)", color: s.revokedAt ? T.muted : T.mint, marginRight: 8 }}>
              {s.revokedAt ? "revoked" : "active"}
            </span>
            <span style={{ color: T.muted, fontSize: 11 }}>{s.ip ?? "—"}</span>
            {s.stepUpAt && <span style={{ color: T.gold, fontSize: 10.5, marginLeft: 6 }}>stepped up</span>}
          </span>
          {!s.revokedAt ? (
            <button onClick={() => revokeSession(s.id)} disabled={busy} style={{ ...ghostBtn, padding: "3px 9px", fontSize: 10.5, color: T.coral }}>Revoke</button>
          ) : (
            <span style={{ color: T.faint, fontSize: 10.5, fontFamily: mono }}>{new Date(s.createdAt).toLocaleDateString()}</span>
          )}
        </div>
      ))}

      <Label text="Passkeys" />
      {admin.passkeys.length === 0 && <p style={{ color: T.muted, fontSize: 12, margin: "0 0 8px" }}>None enrolled yet.</p>}
      {admin.passkeys.map((p) => (
        <div key={p.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${T.border}`, fontSize: 12 }}>
          <span>{p.deviceLabel ?? "Unlabeled device"}</span>
          <span style={{ color: T.faint, fontSize: 10.5, fontFamily: mono }}>{p.lastUsedAt ? `used ${new Date(p.lastUsedAt).toLocaleDateString()}` : "never used"}</span>
        </div>
      ))}

      <Label text="Actions" />
      {activeAction === null ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          <button onClick={() => openAction("role")} style={ghostBtn}>Change role</button>
          {admin.disabledAt ? (
            <button onClick={() => openAction("enable")} style={ghostBtn}>Re-enable</button>
          ) : (
            <button onClick={() => openAction("disable")} style={{ ...ghostBtn, color: T.coral }}>Disable</button>
          )}
        </div>
      ) : (
        <div style={{ border: `1px solid ${T.border}`, borderRadius: 9, padding: 10 }}>
          <p style={{ fontSize: 12.5, margin: "0 0 8px", color: T.text }}>
            {activeAction === "role" ? "Change this admin's role?" : activeAction === "disable" ? "Disable this admin? Every active session is revoked immediately." : "Re-enable this admin?"}
          </p>
          {activeAction === "role" && (
            <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
              {ROLES.map((r) => (
                <button key={r} onClick={() => setNewRole(r)} style={{ flex: 1, padding: "6px 0", fontSize: 10.5, fontFamily: mono, borderRadius: 7, cursor: "pointer", border: `1px solid ${newRole === r ? T.gold + "88" : T.border}`, background: newRole === r ? T.raised : "transparent", color: newRole === r ? "#fff" : T.muted }}>
                  {r}
                </button>
              ))}
            </div>
          )}
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (required, min 3 chars)…" style={{ ...fieldStyle, marginBottom: 8 }} />
          {error && <p style={{ color: T.coral, fontSize: 11.5, margin: "0 0 8px" }}>{error}</p>}
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={confirmAction} disabled={busy} style={{ flex: 1, ...goldBtn, opacity: busy ? 0.7 : 1 }}>{busy ? "Confirming…" : "Confirm"}</button>
            <button onClick={() => setActiveAction(null)} disabled={busy} style={{ flex: 1, ...ghostBtn }}>Cancel</button>
          </div>
          <p style={{ color: T.faint, fontSize: 10.5, margin: "8px 0 0" }}>Owner-only — needs a fresh passkey verification (step-up).</p>
        </div>
      )}
    </div>
  );
}

function Label({ text }: { text: string }) {
  return <span style={{ display: "block", fontFamily: mono, fontSize: 10.5, letterSpacing: 1, color: T.faint, textTransform: "uppercase", margin: "14px 0 6px" }}>{text}</span>;
}
