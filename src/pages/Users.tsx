import { useEffect, useState } from "react";

import { T, mono } from "@/constants/theme";
import { adminUsersApi, type ExportJob, type SignInEventRow, type TrustMemberRow, type UserDetail, type UserListItem } from "@/lib/api";
import { timeUntil } from "@/lib/relativeTime";
import { bytesToMb } from "@/lib/format";
import { withStepUp } from "@/lib/stepUp";

type ActionId = "tier" | "suspend" | "unsuspend" | "signout" | "cancel_deletion";

export default function Users() {
  const [tier, setTier] = useState<"all" | "free" | "paid">("all");
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<UserListItem[] | null>(null);
  const [total, setTotal] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [exportJobs, setExportJobs] = useState<ExportJob[] | null>(null);
  const [signInEvents, setSignInEvents] = useState<SignInEventRow[] | null>(null);
  const [trustMembers, setTrustMembers] = useState<TrustMemberRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);

  const [activeAction, setActiveAction] = useState<ActionId | null>(null);
  const [newTier, setNewTier] = useState<"free" | "paid">("paid");
  const [reason, setReason] = useState("");
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [overrideFormOpen, setOverrideFormOpen] = useState(false);
  const [overrideStorageMb, setOverrideStorageMb] = useState("");
  const [overrideAiLimit, setOverrideAiLimit] = useState("");
  const [overrideExpiresInDays, setOverrideExpiresInDays] = useState("7");
  const [overrideReason, setOverrideReason] = useState("");
  const [overrideBusy, setOverrideBusy] = useState(false);
  const [overrideError, setOverrideError] = useState<string | null>(null);
  const [revokeConfirming, setRevokeConfirming] = useState(false);
  const [revokeReason, setRevokeReason] = useState("");

  useEffect(() => {
    let active = true;
    adminUsersApi.list({ tier: tier === "all" ? undefined : tier, search: search || undefined, limit: 50 })
      .then((res) => {
        if (!active) return;
        setItems(res.items);
        setTotal(res.pagination.total);
        if (res.items.length && !res.items.some((u) => u.id === selectedId)) setSelectedId(res.items[0].id);
        if (!res.items.length) setSelectedId(null);
      })
      .catch((err) => { if (active) setError(err instanceof Error ? err.message : "Failed to load users."); });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tier, search, refreshNonce]);

  useEffect(() => {
    if (!selectedId) { setDetail(null); setExportJobs(null); setSignInEvents(null); setTrustMembers(null); return; }
    let active = true;
    adminUsersApi.get(selectedId).then((d) => { if (active) setDetail(d); }).catch(() => { if (active) setDetail(null); });
    adminUsersApi.exportJobs(selectedId).then((res) => { if (active) setExportJobs(res.jobs); }).catch(() => { if (active) setExportJobs(null); });
    adminUsersApi.signInEvents(selectedId).then((res) => { if (active) setSignInEvents(res.events); }).catch(() => { if (active) setSignInEvents(null); });
    adminUsersApi.trustMembers(selectedId).then((res) => { if (active) setTrustMembers(res.members); }).catch(() => { if (active) setTrustMembers(null); });
    return () => { active = false; };
  }, [selectedId, refreshNonce]);

  function openAction(id: ActionId) {
    setActiveAction(id);
    setReason("");
    setActionError(null);
    if (detail) setNewTier(detail.user.accountTier === "free" ? "paid" : "free");
  }
  function closeAction() {
    setActiveAction(null);
    setActionError(null);
  }

  async function confirmAction() {
    if (!detail || !activeAction) return;
    setActionBusy(true);
    setActionError(null);
    try {
      await withStepUp(() => {
        const id = detail.user.id;
        if (activeAction === "tier") return adminUsersApi.changeTier(id, newTier, reason);
        if (activeAction === "suspend") return adminUsersApi.suspend(id, reason);
        if (activeAction === "unsuspend") return adminUsersApi.unsuspend(id, reason);
        if (activeAction === "cancel_deletion") return adminUsersApi.cancelDeletion(id, reason);
        return adminUsersApi.forceSignOut(id, reason || undefined);
      });
      setActiveAction(null);
      setRefreshNonce((n) => n + 1);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setActionBusy(false);
    }
  }

  function openOverrideForm() {
    setOverrideFormOpen(true);
    setOverrideStorageMb("");
    setOverrideAiLimit("");
    setOverrideExpiresInDays("7");
    setOverrideReason("");
    setOverrideError(null);
  }

  async function grantOverride() {
    if (!detail) return;
    const storageLimitMb = overrideStorageMb.trim() ? Number(overrideStorageMb) : undefined;
    const aiActionLimit = overrideAiLimit.trim() ? Number(overrideAiLimit) : undefined;
    const expiresInDays = Number(overrideExpiresInDays);
    if (storageLimitMb === undefined && aiActionLimit === undefined) {
      setOverrideError("Set at least one of storage limit or AI action limit.");
      return;
    }
    if (overrideReason.trim().length < 3) {
      setOverrideError("Reason must be at least 3 characters.");
      return;
    }
    setOverrideBusy(true);
    setOverrideError(null);
    try {
      await withStepUp(() => adminUsersApi.grantOverride(detail.user.id, { storageLimitMb, aiActionLimit, expiresInDays, reason: overrideReason }));
      setOverrideFormOpen(false);
      setRefreshNonce((n) => n + 1);
    } catch (err) {
      setOverrideError(err instanceof Error ? err.message : "Grant failed.");
    } finally {
      setOverrideBusy(false);
    }
  }

  async function confirmRevokeOverride() {
    if (!detail) return;
    if (revokeReason.trim().length < 3) {
      setOverrideError("Reason must be at least 3 characters.");
      return;
    }
    setOverrideBusy(true);
    setOverrideError(null);
    try {
      await withStepUp(() => adminUsersApi.revokeOverride(detail.user.id, revokeReason));
      setRevokeConfirming(false);
      setRefreshNonce((n) => n + 1);
    } catch (err) {
      setOverrideError(err instanceof Error ? err.message : "Revoke failed.");
    } finally {
      setOverrideBusy(false);
    }
  }

  return (
    <div>
      <h1 style={{ fontSize: 26, fontWeight: 800, color: "#fff", margin: "0 0 6px" }}>Users &amp; accounts</h1>
      <p style={{ color: T.muted, fontSize: 14.5, margin: "0 0 16px" }}>
        Metadata only — vault contents are sealed. {total} account{total === 1 ? "" : "s"}.
      </p>

      {error && <p style={{ color: T.coral, fontSize: 13 }}>{error}</p>}

      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email…"
          style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 8, padding: "7px 11px", fontSize: 12.5, color: T.text, minWidth: 220 }}
        />
        {(["all", "free", "paid"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTier(t)}
            style={{
              border: `1px solid ${tier === t ? T.gold + "88" : T.border}`,
              background: tier === t ? T.raised : T.panel, color: tier === t ? "#fff" : T.muted,
              borderRadius: 999, padding: "6px 13px", fontSize: 12.5, fontWeight: 600, cursor: "pointer",
            }}
          >
            {t === "all" ? "All" : t === "free" ? "Free" : "Paid"}
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.3fr) minmax(280px,1fr)", gap: 14, alignItems: "start" }}>
        <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 14, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                {["Account", "Tier", "Methods", "Joined"].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: "9px 12px", fontFamily: mono, fontSize: 10.5, letterSpacing: 0.6, color: T.muted, textTransform: "uppercase", borderBottom: `1px solid ${T.border}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(items ?? []).map((u) => (
                <tr
                  key={u.id}
                  onClick={() => { setSelectedId(u.id); setActiveAction(null); }}
                  style={{ cursor: "pointer", background: u.id === selectedId ? T.raised : "transparent" }}
                >
                  <td style={{ padding: "10px 12px", borderBottom: `1px solid ${T.border}` }}>
                    <div style={{ color: "#fff", fontWeight: 600 }}>{u.name}</div>
                    <div style={{ color: T.muted, fontSize: 11.5 }}>{u.email}</div>
                  </td>
                  <td style={{ padding: "10px 12px", borderBottom: `1px solid ${T.border}` }}>
                    <span style={{ fontFamily: mono, fontSize: 11, padding: "2px 8px", borderRadius: 999, background: u.accountTier === "paid" ? "rgba(79,203,149,.14)" : "rgba(147,160,181,.12)", color: u.accountTier === "paid" ? T.mint : T.muted }}>
                      {u.accountTier}
                    </span>
                    {u.suspended && <span style={{ marginLeft: 6, fontFamily: mono, fontSize: 10, color: T.coral }}>suspended</span>}
                    {u.pendingDeletion && <span style={{ marginLeft: 6, fontFamily: mono, fontSize: 10, color: T.coral }}>deletion scheduled</span>}
                  </td>
                  <td style={{ padding: "10px 12px", borderBottom: `1px solid ${T.border}`, color: T.muted, fontSize: 12 }}>{u.signInMethods.join(", ") || "—"}</td>
                  <td style={{ padding: "10px 12px", borderBottom: `1px solid ${T.border}`, color: T.muted, fontSize: 12 }}>{new Date(u.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
              {items && items.length === 0 && (
                <tr><td colSpan={4} style={{ padding: 16, color: T.muted, textAlign: "center" }}>No accounts match.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {detail && (
          <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 14, padding: 16 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 10 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: "#313743", color: T.gold, display: "grid", placeItems: "center", fontWeight: 700 }}>
                {detail.user.name.charAt(0)}
              </div>
              <div>
                <strong style={{ display: "block", color: "#fff", fontSize: 14.5 }}>{detail.user.name}</strong>
                <span style={{ color: T.muted, fontSize: 12 }}>{detail.user.email}</span>
              </div>
            </div>
            <div style={{ fontFamily: mono, fontSize: 10.5, color: T.faint, marginBottom: 14 }}>{detail.user.id}</div>

            {detail.user.suspendedAt && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "rgba(232,115,106,.1)", border: `1px solid ${T.coral}55`, borderRadius: 9, fontSize: 12, marginBottom: 14 }}>
                <span style={{ color: T.coral }}>⛔</span>
                <span>Suspended {new Date(detail.user.suspendedAt).toLocaleString()}{detail.user.suspendedReason ? ` — ${detail.user.suspendedReason}` : ""}</span>
              </div>
            )}

            <Label text="Account" />
            <Fact label="Tier" value={detail.user.accountTier} />
            <Fact label="Joined" value={new Date(detail.user.createdAt).toLocaleDateString()} />
            <Fact label="Sign-in methods" value={detail.user.signInMethods.join(", ") || "—"} />
            <Fact label="Country" value={detail.user.country ?? "—"} />
            {detail.usage && (
              <>
                <Fact label="Storage" value={`${bytesToMb(detail.usage.storage.usedBytes)} MB${detail.usage.storage.unlimited ? " (unlimited)" : detail.usage.storage.limitBytes ? ` / ${bytesToMb(detail.usage.storage.limitBytes)} MB` : ""}`} mono />
                <Fact label="AI actions this period" value={detail.usage.aiUsage.unlimited ? "unlimited" : `${detail.usage.aiUsage.used} of ${detail.usage.aiUsage.limit}`} mono />
                {detail.usage.override && (
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "8px 10px", background: "rgba(217,184,106,.1)", border: `1px solid ${T.gold}55`, borderRadius: 9, fontSize: 11.5, margin: "8px 0" }}>
                    <span style={{ color: T.gold }}>⬆</span>
                    <span>
                      Override active — {detail.usage.override.storageLimitBytes ? `${bytesToMb(detail.usage.override.storageLimitBytes)} MB storage` : null}
                      {detail.usage.override.storageLimitBytes && detail.usage.override.aiActionLimit ? ", " : ""}
                      {detail.usage.override.aiActionLimit ? `${detail.usage.override.aiActionLimit} AI actions/mo` : null}.
                      {" "}Expires in {timeUntil(detail.usage.override.expiresAt)}.
                      <div style={{ color: T.faint, marginTop: 2 }}>{detail.usage.override.reason}</div>
                    </span>
                  </div>
                )}
              </>
            )}
            {detail.user.scheduledDeletionAt && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "8px 10px", background: "rgba(232,115,106,.1)", border: `1px solid ${T.coral}55`, borderRadius: 9, fontSize: 12, margin: "8px 0" }}>
                <span>
                  <span style={{ color: T.coral }}>⏳</span> Deletion scheduled for {new Date(detail.user.scheduledDeletionAt).toLocaleDateString()}
                  {detail.user.deletionRequestedAt && <span style={{ display: "block", color: T.faint, fontSize: 10.5, marginTop: 2 }}>Requested {new Date(detail.user.deletionRequestedAt).toLocaleDateString()} — self-service, 30-day grace period</span>}
                </span>
                {activeAction !== "cancel_deletion" && (
                  <button onClick={() => openAction("cancel_deletion")} style={{ flexShrink: 0, border: `1px solid ${T.border}`, background: T.raised, color: T.text, borderRadius: 7, padding: "5px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                    Cancel on their behalf
                  </button>
                )}
              </div>
            )}

            {exportJobs && exportJobs.length > 0 && (
              <>
                <Label text="Export jobs" />
                {exportJobs.map((job) => <ExportJobRow key={job.id} job={job} />)}
              </>
            )}

            {signInEvents && signInEvents.length > 0 && (
              <>
                <Label text="Recent sign-ins" />
                {signInEvents.map((ev) => <SignInEventRowView key={ev.id} event={ev} />)}
              </>
            )}

            {trustMembers && trustMembers.length > 0 && (
              <>
                <Label text="Trust members" />
                {trustMembers.map((m) => (
                  <TrustMemberRowView key={m.id} member={m} userId={detail.user.id} onChanged={() => setRefreshNonce((n) => n + 1)} />
                ))}
              </>
            )}

            {detail.usage && !detail.usage.storage.unlimited && (
              <>
                <Label text="Usage override" />
                {!overrideFormOpen && !revokeConfirming && (
                  <div style={{ display: "flex", gap: 6 }}>
                    {detail.usage.override ? (
                      <ActionButton danger onClick={() => { setRevokeConfirming(true); setRevokeReason(""); setOverrideError(null); }}>Revoke</ActionButton>
                    ) : (
                      <ActionButton onClick={openOverrideForm}>Grant exception</ActionButton>
                    )}
                  </div>
                )}

                {overrideFormOpen && (
                  <div style={{ border: `1px solid ${T.border}`, borderRadius: 9, padding: 10 }}>
                    <p style={{ fontSize: 12.5, margin: "0 0 8px", color: T.text }}>
                      Grant a temporary limit exception (max 90 days). Leave a field blank to leave that limit unchanged.
                    </p>
                    <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                      <input
                        value={overrideStorageMb}
                        onChange={(e) => setOverrideStorageMb(e.target.value)}
                        placeholder="Storage limit (MB)"
                        inputMode="numeric"
                        style={{ flex: 1, background: T.raised, border: `1px solid ${T.border}`, borderRadius: 7, padding: "6px 9px", fontSize: 11.5, color: T.text }}
                      />
                      <input
                        value={overrideAiLimit}
                        onChange={(e) => setOverrideAiLimit(e.target.value)}
                        placeholder="AI actions/mo"
                        inputMode="numeric"
                        style={{ flex: 1, background: T.raised, border: `1px solid ${T.border}`, borderRadius: 7, padding: "6px 9px", fontSize: 11.5, color: T.text }}
                      />
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                      <span style={{ fontSize: 11.5, color: T.muted }}>Expires in</span>
                      <input
                        value={overrideExpiresInDays}
                        onChange={(e) => setOverrideExpiresInDays(e.target.value)}
                        inputMode="numeric"
                        style={{ width: 50, background: T.raised, border: `1px solid ${T.border}`, borderRadius: 7, padding: "6px 9px", fontSize: 11.5, color: T.text }}
                      />
                      <span style={{ fontSize: 11.5, color: T.muted }}>days</span>
                    </div>
                    <input
                      value={overrideReason}
                      onChange={(e) => setOverrideReason(e.target.value)}
                      placeholder="Reason (required, min 3 chars)…"
                      style={{ width: "100%", boxSizing: "border-box", background: T.raised, border: `1px solid ${T.border}`, borderRadius: 7, padding: "7px 9px", fontSize: 12, color: T.text, marginBottom: 8 }}
                    />
                    {overrideError && <p style={{ color: T.coral, fontSize: 11.5, margin: "0 0 8px" }}>{overrideError}</p>}
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={grantOverride} disabled={overrideBusy} style={{ flex: 1, background: T.gold, color: T.inkOnGold, border: "none", borderRadius: 7, padding: "7px 0", fontSize: 12, fontWeight: 700, cursor: "pointer", opacity: overrideBusy ? 0.7 : 1 }}>
                        {overrideBusy ? "Granting…" : "Confirm"}
                      </button>
                      <button onClick={() => setOverrideFormOpen(false)} disabled={overrideBusy} style={{ flex: 1, background: "transparent", color: T.muted, border: `1px solid ${T.border}`, borderRadius: 7, padding: "7px 0", fontSize: 12, cursor: "pointer" }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {revokeConfirming && (
                  <div style={{ border: `1px solid ${T.border}`, borderRadius: 9, padding: 10 }}>
                    <p style={{ fontSize: 12.5, margin: "0 0 8px", color: T.text }}>Revoke the active override now?</p>
                    <input
                      value={revokeReason}
                      onChange={(e) => setRevokeReason(e.target.value)}
                      placeholder="Reason (required, min 3 chars)…"
                      style={{ width: "100%", boxSizing: "border-box", background: T.raised, border: `1px solid ${T.border}`, borderRadius: 7, padding: "7px 9px", fontSize: 12, color: T.text, marginBottom: 8 }}
                    />
                    {overrideError && <p style={{ color: T.coral, fontSize: 11.5, margin: "0 0 8px" }}>{overrideError}</p>}
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={confirmRevokeOverride} disabled={overrideBusy} style={{ flex: 1, background: T.coral, color: "#fff", border: "none", borderRadius: 7, padding: "7px 0", fontSize: 12, fontWeight: 700, cursor: "pointer", opacity: overrideBusy ? 0.7 : 1 }}>
                        {overrideBusy ? "Revoking…" : "Confirm"}
                      </button>
                      <button onClick={() => setRevokeConfirming(false)} disabled={overrideBusy} style={{ flex: 1, background: "transparent", color: T.muted, border: `1px solid ${T.border}`, borderRadius: 7, padding: "7px 0", fontSize: 12, cursor: "pointer" }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
                <p style={{ color: T.faint, fontSize: 10.5, margin: "8px 0 0" }}>May prompt for a fresh passkey verification (step-up).</p>
              </>
            )}

            <Label text="Sealed" />
            <SealedRow label="Documents" count={detail.sealed.documentCount} />
            <SealedRow label="Health members" count={detail.sealed.healthMemberCount} />
            <SealedRow label="Trust members (active)" count={detail.sealed.trustMemberCount} />

            <Label text="Actions" />
            {activeAction === null ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                <ActionButton onClick={() => openAction("tier")}>
                  Change to {detail.user.accountTier === "free" ? "paid" : "free"}
                </ActionButton>
                {detail.user.suspendedAt ? (
                  <ActionButton onClick={() => openAction("unsuspend")}>Unsuspend</ActionButton>
                ) : (
                  <ActionButton danger onClick={() => openAction("suspend")}>Suspend</ActionButton>
                )}
                <ActionButton danger onClick={() => openAction("signout")}>Force sign-out</ActionButton>
              </div>
            ) : (
              <div style={{ border: `1px solid ${T.border}`, borderRadius: 9, padding: 10 }}>
                <p style={{ fontSize: 12.5, margin: "0 0 8px", color: T.text }}>
                  {actionTitle(activeAction, newTier)}
                </p>
                {activeAction === "tier" && (
                  <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                    {(["free", "paid"] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => setNewTier(t)}
                        style={{
                          flex: 1, padding: "6px 0", fontSize: 11.5, fontFamily: mono, borderRadius: 7, cursor: "pointer",
                          border: `1px solid ${newTier === t ? T.gold + "88" : T.border}`,
                          background: newTier === t ? T.raised : "transparent", color: newTier === t ? "#fff" : T.muted,
                        }}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                )}
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={activeAction === "signout" ? "Reason (optional)…" : "Reason (required, min 3 chars)…"}
                  style={{ width: "100%", boxSizing: "border-box", background: T.raised, border: `1px solid ${T.border}`, borderRadius: 7, padding: "7px 9px", fontSize: 12, color: T.text, marginBottom: 8 }}
                />
                {actionError && <p style={{ color: T.coral, fontSize: 11.5, margin: "0 0 8px" }}>{actionError}</p>}
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    onClick={confirmAction}
                    disabled={actionBusy || (activeAction !== "signout" && reason.trim().length < 3)}
                    style={{ flex: 1, background: T.gold, color: T.inkOnGold, border: "none", borderRadius: 7, padding: "7px 0", fontSize: 12, fontWeight: 700, cursor: "pointer", opacity: actionBusy ? 0.7 : 1 }}
                  >
                    {actionBusy ? "Confirming…" : "Confirm"}
                  </button>
                  <button
                    onClick={closeAction}
                    disabled={actionBusy}
                    style={{ flex: 1, background: "transparent", color: T.muted, border: `1px solid ${T.border}`, borderRadius: 7, padding: "7px 0", fontSize: 12, cursor: "pointer" }}
                  >
                    Cancel
                  </button>
                </div>
                <p style={{ color: T.faint, fontSize: 10.5, margin: "8px 0 0" }}>
                  May prompt for a fresh passkey verification (step-up, 5-minute window).
                </p>
              </div>
            )}

            <p style={{ color: T.muted, fontSize: 11.5, marginTop: 14 }}>
              Opening this account was recorded as <span style={{ fontFamily: mono, color: T.gold }}>user.view</span>. Every action above is logged the same way.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function actionTitle(action: ActionId, newTier: "free" | "paid") {
  switch (action) {
    case "tier": return `Move this account to the ${newTier} tier?`;
    case "suspend": return "Suspend this account? Access ends immediately and every session is signed out.";
    case "unsuspend": return "Restore access to this account?";
    case "signout": return "Sign this account out of every device?";
    case "cancel_deletion": return "Cancel the scheduled deletion? The account keeps its data and stays active.";
  }
}

function ActionButton({ children, onClick, danger }: { children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      style={{
        border: `1px solid ${danger ? T.coral + "66" : T.border}`, background: T.raised, color: danger ? T.coral : T.text,
        borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function Label({ text }: { text: string }) {
  return <span style={{ display: "block", fontFamily: mono, fontSize: 10.5, letterSpacing: 1, color: T.faint, textTransform: "uppercase", margin: "14px 0 6px" }}>{text}</span>;
}
function Fact({ label, value, mono: isMono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "7px 0", borderBottom: `1px solid ${T.border}`, fontSize: 12.5 }}>
      <span style={{ color: T.muted }}>{label}</span>
      <span style={isMono ? { fontFamily: mono, fontSize: 11.5 } : undefined}>{value}</span>
    </div>
  );
}
const EXPORT_STATUS_COLOR: Record<string, string> = {
  READY: "#4FCB95", REQUESTED: "#8A97AE", PREPARING: "#D9B86A", FAILED: "#E8736A",
};
function ExportJobRow({ job }: { job: ExportJob }) {
  const color = EXPORT_STATUS_COLOR[job.status] ?? "#8A97AE";
  const expired = job.expiresAt ? new Date(job.expiresAt) <= new Date() : false;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderBottom: `1px solid ${T.border}`, fontSize: 12 }}>
      <span>
        <span style={{ fontFamily: mono, fontSize: 10.5, fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: `${color}22`, color, marginRight: 8 }}>
          {job.status.toLowerCase()}{job.status === "READY" && expired ? " · expired" : ""}
        </span>
        {job.sizeBytes != null && <span style={{ color: T.muted, fontFamily: mono, fontSize: 11 }}>{bytesToMb(job.sizeBytes)} MB</span>}
        {job.errorMessage && <span style={{ color: T.coral, fontSize: 11 }}> — {job.errorMessage}</span>}
      </span>
      <span style={{ color: T.faint, fontSize: 10.5, fontFamily: mono }}>{new Date(job.requestedAt).toLocaleDateString()}</span>
    </div>
  );
}
const SIGN_IN_METHOD_LABEL: Record<string, string> = {
  password: "Password", pin: "PIN", google: "Google", signup: "Signup",
};
function SignInEventRowView({ event }: { event: SignInEventRow }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderBottom: `1px solid ${T.border}`, fontSize: 12 }}>
      <span>
        <span style={{ fontFamily: mono, fontSize: 10.5, fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: "rgba(147,160,181,.12)", color: T.muted, marginRight: 8 }}>
          {SIGN_IN_METHOD_LABEL[event.method] ?? event.method}
        </span>
        <span style={{ color: T.muted, fontFamily: mono, fontSize: 11 }}>{event.ip ?? "—"}</span>
      </span>
      <span style={{ color: T.faint, fontSize: 10.5, fontFamily: mono }}>{new Date(event.at).toLocaleString()}</span>
    </div>
  );
}
const TRUST_STATUS_COLOR: Record<string, string> = {
  ACTIVE: T.mint, INVITED: T.gold, REVOKED: T.faint, REJECTED: T.coral,
};
function TrustMemberRowView({ member, userId, onChanged }: { member: TrustMemberRow; userId: string; onChanged: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const locked = member.pinLockedUntil && new Date(member.pinLockedUntil) > new Date();

  async function revoke() {
    if (reason.trim().length < 3) { setError("Reason required, min 3 chars."); return; }
    setBusy(true); setError(null);
    try {
      await withStepUp(() => adminUsersApi.revokeTrustMember(userId, member.id, reason));
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Revoke failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ padding: "7px 0", borderBottom: `1px solid ${T.border}`, fontSize: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>
          <b style={{ color: T.text }}>{member.name}</b>
          <span style={{ color: T.muted, marginLeft: 6, fontSize: 11 }}>{member.relation === "OTHER" && member.customRelation ? member.customRelation : member.relation.toLowerCase()}</span>
          <span style={{ fontFamily: mono, fontSize: 10.5, fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: "rgba(255,255,255,.04)", color: TRUST_STATUS_COLOR[member.status] ?? T.muted, marginLeft: 8 }}>
            {member.status.toLowerCase()}
          </span>
          {locked && <span style={{ color: T.coral, fontSize: 10.5, marginLeft: 6 }}>⛔ PIN locked</span>}
        </span>
        {member.status !== "REVOKED" && !confirming && (
          <button onClick={() => setConfirming(true)} style={{ border: `1px solid ${T.border}`, background: T.raised, color: T.coral, borderRadius: 6, padding: "3px 9px", fontSize: 10.5, fontWeight: 600, cursor: "pointer" }}>
            Revoke
          </button>
        )}
      </div>
      {confirming && (
        <div style={{ marginTop: 6 }}>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason for revoking (abuse report, etc.)…"
            style={{ width: "100%", boxSizing: "border-box", background: "#171E2E", border: `1px solid ${T.border}`, borderRadius: 6, padding: "5px 8px", fontSize: 11, color: T.text, marginBottom: 4 }}
          />
          {error && <p style={{ color: T.coral, fontSize: 10.5, margin: "0 0 4px" }}>{error}</p>}
          <div style={{ display: "flex", gap: 4 }}>
            <button onClick={revoke} disabled={busy} style={{ background: T.coral, border: "none", color: "#fff", borderRadius: 6, padding: "4px 9px", fontSize: 10.5, fontWeight: 700, cursor: "pointer", opacity: busy ? 0.7 : 1 }}>
              {busy ? "…" : "Confirm"}
            </button>
            <button onClick={() => { setConfirming(false); setError(null); }} disabled={busy} style={{ background: "transparent", border: `1px solid ${T.border}`, color: T.muted, borderRadius: 6, padding: "4px 9px", fontSize: 10.5, cursor: "pointer" }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
function SealedRow({ label, count }: { label: string; count: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", border: "1px dashed #33405c", borderRadius: 9, fontSize: 12, marginBottom: 6, background: "rgba(11,18,32,.5)" }}>
      <span style={{ flex: 1 }}><b style={{ color: T.text }}>{label}</b><small style={{ display: "block", color: T.faint }}>{count} · contents not exposed</small></span>
      <span style={{ transform: "rotate(-7deg)", border: `1.5px solid ${T.coral}`, color: T.coral, borderRadius: 5, padding: "1px 6px", fontFamily: mono, fontSize: 9.5, fontWeight: 800, letterSpacing: 1.6 }}>SEALED</span>
    </div>
  );
}
