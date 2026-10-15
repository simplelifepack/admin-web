import { useEffect, useState } from "react";

import { T, mono } from "@/constants/theme";
import { adminAuditApi, type AuditLogEntry, type ChainVerification, type ChainVerifyJob, type RetentionStatus } from "@/lib/api";
import { relativeAge } from "@/lib/relativeTime";
import { useFetch } from "@/lib/useFetch";

export default function Audit() {
  const [actionFilter, setActionFilter] = useState("");
  const [selected, setSelected] = useState<AuditLogEntry | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<ChainVerification | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const { data, error } = useFetch(
    () => adminAuditApi.list({ action: actionFilter || undefined }),
    [actionFilter],
  );

  async function handleVerify() {
    setVerifying(true);
    setVerifyError(null);
    setVerifyResult(null);
    try {
      setVerifyResult(await adminAuditApi.verifyChain());
    } catch (err) {
      setVerifyError(err instanceof Error ? err.message : "Verification failed.");
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div>
      <h1 style={{ fontSize: 26, fontWeight: 800, color: "#fff", margin: "0 0 6px" }}>Audit log</h1>
      <p style={{ color: T.muted, fontSize: 14.5, margin: "0 0 16px" }}>
        Every privileged read and write, hash-chained and tamper-evident. Support and catalogue roles see only their own actions (per the access matrix) — this view reflects whatever the signed-in role is scoped to.
      </p>

      <div style={{ display: "flex", gap: 8, marginBottom: 14, alignItems: "center", flexWrap: "wrap" }}>
        <input
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          placeholder="Filter by action, e.g. user.view…"
          style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 8, padding: "7px 11px", fontSize: 12.5, color: T.text, minWidth: 220 }}
        />
        <button
          onClick={handleVerify}
          disabled={verifying}
          style={{ border: `1px solid ${T.gold}88`, background: T.raised, color: "#fff", borderRadius: 8, padding: "7px 13px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}
        >
          {verifying ? "Verifying…" : "Verify chain integrity"}
        </button>
        {verifyResult && (
          <span style={{ fontFamily: mono, fontSize: 12, color: verifyResult.intact ? T.mint : T.coral }}>
            {verifyResult.intact
              ? `✓ Intact — ${verifyResult.checkedCount} rows checked`
              : `⚠ Broken at ${verifyResult.brokenAt} (${verifyResult.checkedCount} rows checked)`}
          </span>
        )}
        {verifyError && <span style={{ fontFamily: mono, fontSize: 12, color: T.coral }}>{verifyError}</span>}
      </div>

      {error && <ErrorMsg message={error} />}

      {data && (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.5fr) minmax(280px,1fr)", gap: 14, alignItems: "start" }}>
          <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 14, overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 560 }}>
              <thead>
                <tr>
                  {["When", "Actor", "Action", "Target"].map((h) => (
                    <th key={h} style={{ textAlign: "left", padding: "9px 12px", fontFamily: mono, fontSize: 10.5, letterSpacing: 0.6, color: T.muted, textTransform: "uppercase", borderBottom: `1px solid ${T.border}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.items.map((row) => (
                  <tr key={row.id} onClick={() => setSelected(row)} style={{ cursor: "pointer", background: row.id === selected?.id ? T.raised : "transparent" }}>
                    <td style={{ padding: "9px 12px", borderBottom: `1px solid ${T.border}`, color: T.muted, fontFamily: mono, fontSize: 11.5 }}>{relativeAge(row.at)} ago</td>
                    <td style={{ padding: "9px 12px", borderBottom: `1px solid ${T.border}`, fontSize: 12 }}>{row.actorEmail}</td>
                    <td style={{ padding: "9px 12px", borderBottom: `1px solid ${T.border}` }}>
                      <span style={{ fontFamily: mono, fontSize: 11.5, color: row.action.startsWith("auth.") ? T.gold : T.text }}>{row.action}</span>
                    </td>
                    <td style={{ padding: "9px 12px", borderBottom: `1px solid ${T.border}`, color: T.muted, fontFamily: mono, fontSize: 11.5 }}>
                      {row.targetType ? `${row.targetType}:${shortId(row.targetId)}` : "—"}
                    </td>
                  </tr>
                ))}
                {data.items.length === 0 && (
                  <tr><td colSpan={4} style={{ padding: 16, color: T.muted, textAlign: "center" }}>No matching audit events.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {selected && (
            <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 14, padding: 16 }}>
              <span style={{ fontFamily: mono, fontSize: 13, color: T.gold }}>{selected.action}</span>
              <div style={{ color: T.muted, fontSize: 12, margin: "4px 0 14px" }}>{new Date(selected.at).toLocaleString()}</div>

              <Fact label="Actor" value={selected.actorEmail} />
              <Fact label="Target" value={selected.targetType ? `${selected.targetType}:${shortId(selected.targetId)}` : "—"} />
              {selected.reason && <Fact label="Reason" value={selected.reason} />}

              {selected.diff != null && (
                <>
                  <Label text="Diff (allowlisted)" />
                  <pre style={{ background: "rgba(11,18,32,.6)", border: `1px solid ${T.border}`, borderRadius: 9, padding: 10, fontSize: 11, fontFamily: mono, color: T.text, overflow: "auto", margin: 0 }}>
                    {JSON.stringify(selected.diff, null, 2)}
                  </pre>
                </>
              )}

              <Label text="Chain" />
              <Fact label="Hash" value={shortId(selected.hash)} mono />
              <Fact label="Prev hash" value={selected.prevHash ? shortId(selected.prevHash) : "— (chain start)"} mono />
            </div>
          )}
        </div>
      )}

      <RetentionCard />
      <ChainVerifyHistoryCard />
    </div>
  );
}

function ChainVerifyHistoryCard() {
  const [jobs, setJobs] = useState<ChainVerifyJob[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  function load() {
    adminAuditApi.chainVerifyHistory().then((res) => setJobs(res.jobs)).catch((err) => setError(err instanceof Error ? err.message : "Failed to load history."));
  }
  useEffect(load, []);

  async function runNow() {
    setRunning(true);
    setError(null);
    try {
      await adminAuditApi.runChainVerify();
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Run failed.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
        <b style={{ display: "block", color: "#fff", fontSize: 15 }}>Scheduled chain verification</b>
        <button onClick={runNow} disabled={running} style={{ border: `1px solid ${T.gold}88`, background: T.raised, color: "#fff", borderRadius: 8, padding: "6px 12px", fontSize: 11.5, fontWeight: 600, cursor: "pointer", opacity: running ? 0.7 : 1 }}>
          {running ? "Running…" : "Run now"}
        </button>
      </div>
      <p style={{ color: T.muted, fontSize: 12.5, margin: "0 0 12px" }}>
        The same check as "Verify chain integrity" above, persisted as a run history with an alert on failure
        (reuses the job-failed alert hook from Catalogue/Security's job runner — one <span style={{ fontFamily: mono }}>audit_chain_verify</span> rule
        with no channel configured yet does nothing). Not actually on a cron in dev — "Run now" is the manual trigger that a scheduler would call in production.
      </p>
      {error && <ErrorMsg message={error} />}
      {jobs && jobs.length === 0 && <p style={{ color: T.muted, fontSize: 12.5 }}>No runs yet.</p>}
      {jobs && jobs.length > 0 && (
        <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 14, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                {["When", "Result", "Rows checked", "Detail"].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: "9px 12px", fontFamily: mono, fontSize: 10.5, letterSpacing: 0.6, color: T.muted, textTransform: "uppercase", borderBottom: `1px solid ${T.border}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id}>
                  <td style={{ padding: "9px 12px", borderBottom: `1px solid ${T.border}`, color: T.muted, fontFamily: mono, fontSize: 11.5 }}>{relativeAge(job.createdAt)} ago</td>
                  <td style={{ padding: "9px 12px", borderBottom: `1px solid ${T.border}` }}>
                    <span style={{ fontFamily: mono, fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: job.status === "completed" ? "rgba(79,203,149,.14)" : "rgba(232,115,106,.14)", color: job.status === "completed" ? T.mint : T.coral }}>
                      {job.status === "completed" ? "intact" : "broken"}
                    </span>
                  </td>
                  <td style={{ padding: "9px 12px", borderBottom: `1px solid ${T.border}`, color: T.text, fontFamily: mono, fontSize: 12 }}>{job.processedCount.toLocaleString()}</td>
                  <td style={{ padding: "9px 12px", borderBottom: `1px solid ${T.border}`, color: T.coral, fontSize: 11.5 }}>{job.lastError ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function RetentionCard() {
  const { data, error } = useFetch(() => adminAuditApi.retention(), []);
  if (error) return <div style={{ marginTop: 14 }}><ErrorMsg message={error} /></div>;
  if (!data) return null;
  return (
    <div style={{ marginTop: 14 }}>
      <b style={{ display: "block", color: "#fff", fontSize: 15, marginBottom: 4 }}>Retention</b>
      <p style={{ color: T.muted, fontSize: 12.5, margin: "0 0 12px" }}>
        DPDP Rules 2025 security/access-log floor: {data.floorDays} days minimum. Facts, not a verdict — there's no
        retention ceiling specified, so this reports what's checkable rather than a single pass/fail.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
        <RetentionTable title="Admin audit log" stats={data.adminAuditLog} floorDays={data.floorDays} />
        <RetentionTable title="Sign-in events" stats={data.signInEvent} floorDays={data.floorDays} />
      </div>
      <p style={{ color: T.faint, fontSize: 11, margin: "10px 0 0" }}>{data.structuralGuarantee}</p>
    </div>
  );
}

function RetentionTable({ title, stats, floorDays }: { title: string; stats: RetentionStatus["adminAuditLog"]; floorDays: number }) {
  return (
    <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 14, padding: 16 }}>
      <b style={{ display: "block", color: "#fff", fontSize: 13.5, marginBottom: 10 }}>{title}</b>
      <Fact label="Rows" value={stats.count.toLocaleString()} mono />
      <Fact label="Oldest row" value={stats.oldestAt ? new Date(stats.oldestAt).toLocaleDateString() : "— (empty)"} mono />
      <Fact
        label="Oldest row age"
        value={stats.oldestAgeDays === null ? "—" : `${stats.oldestAgeDays} day${stats.oldestAgeDays === 1 ? "" : "s"}${stats.oldestAgeDays < floorDays ? " (app younger than the floor)" : ""}`}
        mono
      />
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, fontSize: 11.5, color: T.mint }}>
        <span>✓</span><span>No deletion path exists for this table.</span>
      </div>
    </div>
  );
}

function shortId(id: string | null) {
  if (!id) return "—";
  return id.length > 10 ? `…${id.slice(-9)}` : id;
}

function ErrorMsg({ message }: { message: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 16, background: "rgba(232,115,106,.08)", border: `1px solid ${T.coral}55`, borderRadius: 14 }}>
      <span style={{ color: T.coral }}>⚠</span>
      <span style={{ fontSize: 13, color: T.text }}>{message}</span>
    </div>
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
