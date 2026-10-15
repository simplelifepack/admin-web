import { useEffect, useState } from "react";

import { T, mono } from "@/constants/theme";
import {
  adminAlertsApi, adminJobsApi, adminSecurityApi,
  type AlertChannel, type AlertRule, type Job, type JobType, type StorageAuditFinding,
} from "@/lib/api";
import { useFetch } from "@/lib/useFetch";
import { withStepUp } from "@/lib/stepUp";

const SEGMENT_COLORS = [T.gold, T.mint, T.coral, "#5B8DEF", "#9B7BE8", "#3FB9C7"];

export default function Security() {
  const { data, error } = useFetch(() => adminSecurityApi.get(), []);

  return (
    <div>
      <h1 style={{ fontSize: 26, fontWeight: 800, color: "#fff", margin: "0 0 6px" }}>Security &amp; keys</h1>
      <p style={{ color: T.muted, fontSize: 14.5, margin: "0 0 16px" }}>
        Key ring and encryption posture. No key material is ever displayed.
      </p>

      {error && <ErrorBox message={error} />}
      {!data && !error && null}

      {data && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 14, alignItems: "start" }}>
          <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 14, padding: 16 }}>
            <b style={{ display: "block", color: "#fff", fontSize: 14, marginBottom: 6 }}>Active document key</b>
            {data.activeKey ? (
              <>
                <div style={{ fontFamily: mono, fontSize: 12.5, color: T.gold }}>{data.activeKey.keyId} · v{data.activeKey.keyVersion}</div>
                <p style={{ color: T.muted, fontSize: 12, margin: "6px 0 16px" }}>{data.activeKey.algorithm} wraps a per-file AES-256-GCM key</p>
              </>
            ) : (
              <p style={{ color: T.coral, fontSize: 12.5, margin: "6px 0 16px" }}>No active key configured.</p>
            )}

            <Label text="Documents by wrapping key" />
            {data.keyDistribution.length === 0 ? (
              <p style={{ color: T.muted, fontSize: 12 }}>No documents yet.</p>
            ) : (
              <>
                <Segments
                  segments={data.keyDistribution.map((k, i) => ({
                    label: k.keyId ? `${k.keyId} v${k.keyVersion}${k.isActive ? " (active)" : ""}` : "no key (legacy)",
                    count: k.count, color: SEGMENT_COLORS[i % SEGMENT_COLORS.length],
                  }))}
                />
              </>
            )}

            <Label text="Documents by encryption" />
            <Segments
              segments={[
                { label: "client envelope", count: data.encryptionType.clientEnvelope, color: "#5B8DEF" },
                { label: "legacy server-encrypted", count: data.encryptionType.legacyServerEncrypted, color: T.faint },
              ]}
            />
          </div>

          <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 14, padding: 16 }}>
            <b style={{ display: "block", color: "#fff", fontSize: 14, marginBottom: 10 }}>Posture checks</b>
            {data.posture.map((check) => (
              <div key={check.label} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "8px 0", borderBottom: `1px solid ${T.border}`, fontSize: 12.5 }}>
                <span
                  style={{
                    fontFamily: mono, fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999, flexShrink: 0,
                    background: check.ok ? "rgba(79,203,149,.14)" : "rgba(217,184,106,.14)",
                    color: check.ok ? T.mint : T.gold,
                  }}
                >
                  {check.ok ? "ok" : "note"}
                </span>
                <span style={{ color: T.text }}>{check.label}</span>
              </div>
            ))}
          </div>

          <RewrapJobCard />
          <StorageAuditJobCard />
        </div>
      )}

      <AlertingCard />
    </div>
  );
}

function RewrapJobCard() {
  const [job, setJob] = useState<Job | null | undefined>(undefined); // undefined = loading
  const [preview, setPreview] = useState<{ documentsToRewrap: number; activeKeyId: string; activeKeyVersion: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    adminJobsApi.rewrapCurrent().then((res) => setJob(res.job)).catch(() => setJob(null));
  }, []);

  // Dev-only convenience: auto-advance by calling tick on an interval while
  // this card is mounted and a job is running. There is no Vercel Cron
  // attached in local dev — in production this same `/jobs/:id/tick`
  // endpoint is meant to be hit on a schedule (decision D5), which is a
  // deploy-config change outside this session's scope, not wired here.
  useEffect(() => {
    if (!job || job.status !== "running") return;
    const id = window.setInterval(() => {
      adminJobsApi.tick(job.id).then((res) => setJob(res.job)).catch((err) => setError(err instanceof Error ? err.message : "Tick failed."));
    }, 1500);
    return () => window.clearInterval(id);
  }, [job]);

  async function runPreview() {
    setError(null);
    try {
      setPreview(await adminJobsApi.rewrapPreview());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preview failed.");
    }
  }

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const { job: started } = await withStepUp(() => adminJobsApi.rewrapStart());
      setJob(started);
      setPreview(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the rewrap job.");
    } finally {
      setBusy(false);
    }
  }

  async function pause() {
    if (!job) return;
    setBusy(true);
    try {
      setJob((await adminJobsApi.pause(job.id)).job);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not pause.");
    } finally {
      setBusy(false);
    }
  }

  async function resume() {
    if (!job) return;
    setBusy(true);
    try {
      setJob((await adminJobsApi.resume(job.id)).job);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not resume.");
    } finally {
      setBusy(false);
    }
  }

  const pct = job && job.totalCount ? Math.min(100, Math.round((job.processedCount / job.totalCount) * 100)) : 0;

  return (
    <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 14, padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <b style={{ color: "#fff", fontSize: 14 }}>Rewrap job</b>
        {job && <StatusPill status={job.status} />}
      </div>
      <p style={{ color: T.muted, fontSize: 12, margin: "0 0 12px" }}>
        Re-wraps only the 32-byte file key per document; ciphertext is never read or rewritten.
      </p>

      {!job && (
        <>
          <button onClick={runPreview} style={ghostBtn}>Preview</button>
          {preview && (
            <p style={{ fontSize: 12.5, color: T.text, margin: "10px 0" }}>
              <b style={{ color: T.gold }}>{preview.documentsToRewrap.toLocaleString()}</b> document key(s) would move to{" "}
              <span style={{ fontFamily: mono }}>{preview.activeKeyId} v{preview.activeKeyVersion}</span>.
            </p>
          )}
          <button onClick={start} disabled={busy} style={{ ...goldBtn, marginTop: 10, opacity: busy ? 0.7 : 1 }}>
            {busy ? "Starting…" : "Start rewrap"}
          </button>
          <p style={{ color: T.faint, fontSize: 10.5, margin: "8px 0 0" }}>Requires step-up (fresh passkey verification).</p>
        </>
      )}

      {job && job.status !== "completed" && (
        <>
          <div style={{ height: 10, borderRadius: 999, background: T.navy, overflow: "hidden", margin: "10px 0 6px" }}>
            <div style={{ width: `${pct}%`, height: "100%", background: job.status === "failed" ? T.coral : T.gold, transition: "width .3s" }} />
          </div>
          <div style={{ fontFamily: mono, fontSize: 11.5, color: T.muted }}>
            {job.processedCount.toLocaleString()} of {job.totalCount?.toLocaleString() ?? "?"} · {job.updatedCount.toLocaleString()} rewrapped
          </div>
          {job.lastError && <p style={{ color: T.coral, fontSize: 11.5, margin: "8px 0 0" }}>{job.lastError}</p>}
          <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
            {job.status === "running" && <button onClick={pause} disabled={busy} style={ghostBtn}>Pause</button>}
            {job.status === "paused" && <button onClick={resume} disabled={busy} style={ghostBtn}>Resume</button>}
          </div>
        </>
      )}

      {job && job.status === "completed" && (
        <p style={{ color: T.mint, fontSize: 12.5, margin: "10px 0 0" }}>
          ✓ Complete — {job.updatedCount.toLocaleString()} document key(s) rewrapped.
        </p>
      )}

      {error && <p style={{ color: T.coral, fontSize: 11.5, marginTop: 10 }}>{error}</p>}
    </div>
  );
}

function StorageAuditJobCard() {
  const [job, setJob] = useState<Job | null | undefined>(undefined);
  const [preview, setPreview] = useState<{ totalCount: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    adminJobsApi.storageAuditCurrent().then((res) => setJob(res.job)).catch(() => setJob(null));
  }, []);

  useEffect(() => {
    if (!job || job.status !== "running") return;
    const id = window.setInterval(() => {
      adminJobsApi.tick(job.id).then((res) => setJob(res.job)).catch((err) => setError(err instanceof Error ? err.message : "Tick failed."));
    }, 1500);
    return () => window.clearInterval(id);
  }, [job]);

  async function runPreview() {
    setError(null);
    try {
      setPreview(await adminJobsApi.storageAuditPreview());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preview failed.");
    }
  }

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const { job: started } = await withStepUp(() => adminJobsApi.storageAuditStart());
      setJob(started);
      setPreview(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the audit.");
    } finally {
      setBusy(false);
    }
  }

  async function pause() {
    if (!job) return;
    setBusy(true);
    try {
      setJob((await adminJobsApi.pause(job.id)).job);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not pause.");
    } finally {
      setBusy(false);
    }
  }

  async function resume() {
    if (!job) return;
    setBusy(true);
    try {
      setJob((await adminJobsApi.resume(job.id)).job);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not resume.");
    } finally {
      setBusy(false);
    }
  }

  const pct = job && job.totalCount ? Math.min(100, Math.round((job.processedCount / job.totalCount) * 100)) : 0;
  const findings = ((job?.resultSummary as { findings?: StorageAuditFinding[] } | null)?.findings) ?? [];

  return (
    <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 14, padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <b style={{ color: "#fff", fontSize: 14 }}>Storage audit</b>
        {job && <StatusPill status={job.status} />}
      </div>
      <p style={{ color: T.muted, fontSize: 12, margin: "0 0 12px" }}>
        Confirms every document's storage object still exists. Read-only — recovering a missing file stays a CLI-only action.
      </p>

      {!job && (
        <>
          <button onClick={runPreview} style={ghostBtn}>Preview</button>
          {preview && (
            <p style={{ fontSize: 12.5, color: T.text, margin: "10px 0" }}>
              <b style={{ color: T.gold }}>{preview.totalCount.toLocaleString()}</b> document(s) would be checked.
            </p>
          )}
          <button onClick={start} disabled={busy} style={{ ...goldBtn, marginTop: 10, opacity: busy ? 0.7 : 1 }}>
            {busy ? "Starting…" : "Start audit"}
          </button>
          <p style={{ color: T.faint, fontSize: 10.5, margin: "8px 0 0" }}>Requires step-up (fresh passkey verification).</p>
        </>
      )}

      {job && job.status !== "completed" && (
        <>
          <div style={{ height: 10, borderRadius: 999, background: T.navy, overflow: "hidden", margin: "10px 0 6px" }}>
            <div style={{ width: `${pct}%`, height: "100%", background: T.gold, transition: "width .3s" }} />
          </div>
          <div style={{ fontFamily: mono, fontSize: 11.5, color: T.muted }}>
            {job.processedCount.toLocaleString()} of {job.totalCount?.toLocaleString() ?? "?"} checked · {job.updatedCount.toLocaleString()} issue(s) found
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
            {job.status === "running" && <button onClick={pause} disabled={busy} style={ghostBtn}>Pause</button>}
            {job.status === "paused" && <button onClick={resume} disabled={busy} style={ghostBtn}>Resume</button>}
          </div>
        </>
      )}

      {job && job.status === "completed" && (
        <p style={{ color: job.updatedCount > 0 ? T.coral : T.mint, fontSize: 12.5, margin: "10px 0 0" }}>
          {job.updatedCount > 0 ? `⚠ ${job.updatedCount.toLocaleString()} issue(s) found` : "✓ Clean — every document's storage object exists"}
          {" "}({job.processedCount.toLocaleString()} checked).
        </p>
      )}

      {findings.length > 0 && (
        <div style={{ marginTop: 10, maxHeight: 180, overflow: "auto", border: `1px solid ${T.border}`, borderRadius: 9 }}>
          {findings.map((f, i) => (
            <div key={`${f.documentId}-${f.label}-${i}`} style={{ padding: "7px 9px", borderBottom: i < findings.length - 1 ? `1px solid ${T.border}` : undefined, fontSize: 11 }}>
              <span style={{ fontFamily: mono, color: T.coral }}>{f.label}</span>
              <span style={{ color: T.faint }}> · </span>
              <span style={{ fontFamily: mono, color: T.muted }}>{f.documentId}</span>
              {f.error && <div style={{ color: T.faint, marginTop: 2 }}>{f.error}</div>}
            </div>
          ))}
        </div>
      )}

      {error && <p style={{ color: T.coral, fontSize: 11.5, marginTop: 10 }}>{error}</p>}
    </div>
  );
}

function StatusPill({ status }: { status: Job["status"] }) {
  const colors: Record<Job["status"], { bg: string; fg: string }> = {
    running: { bg: "rgba(217,184,106,.14)", fg: T.gold },
    paused: { bg: "rgba(147,160,181,.14)", fg: T.muted },
    completed: { bg: "rgba(79,203,149,.14)", fg: T.mint },
    failed: { bg: "rgba(232,115,106,.14)", fg: T.coral },
  };
  const c = colors[status];
  return <span style={{ fontFamily: mono, fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: c.bg, color: c.fg }}>{status}</span>;
}

const ghostBtn: React.CSSProperties = {
  background: "transparent", border: `1px solid ${T.border}`, color: T.text, borderRadius: 8,
  padding: "7px 13px", fontSize: 12, fontWeight: 600, cursor: "pointer",
};
const goldBtn: React.CSSProperties = {
  background: T.gold, border: "none", color: T.inkOnGold, borderRadius: 8,
  padding: "8px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer",
};

function Label({ text }: { text: string }) {
  return <span style={{ display: "block", fontFamily: mono, fontSize: 10.5, letterSpacing: 1, color: T.faint, textTransform: "uppercase", margin: "14px 0 8px" }}>{text}</span>;
}

function Segments({ segments }: { segments: { label: string; count: number; color: string }[] }) {
  const total = segments.reduce((s, x) => s + x.count, 0) || 1;
  return (
    <div>
      <div style={{ display: "flex", height: 14, borderRadius: 7, overflow: "hidden", gap: 2, background: T.navy }}>
        {segments.map((s) => (
          <div key={s.label} style={{ width: `${(s.count / total) * 100}%`, background: s.color }} title={`${s.label}: ${s.count}`} />
        ))}
      </div>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 8, fontSize: 12, color: T.muted }}>
        {segments.map((s) => (
          <span key={s.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <i style={{ width: 9, height: 9, borderRadius: 3, display: "inline-block", background: s.color }} />
            {s.label} · {s.count.toLocaleString()} ({Math.round((s.count / total) * 100)}%)
          </span>
        ))}
      </div>
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 16, background: "rgba(232,115,106,.08)", border: `1px solid ${T.coral}55`, borderRadius: 14, marginBottom: 14 }}>
      <span style={{ color: T.coral }}>⚠</span>
      <span style={{ fontSize: 13, color: T.text }}>{message}</span>
    </div>
  );
}

function AlertingCard() {
  const [channels, setChannels] = useState<AlertChannel[] | null>(null);
  const [rules, setRules] = useState<AlertRule[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [channelFormOpen, setChannelFormOpen] = useState(false);
  const [channelType, setChannelType] = useState<"email" | "webhook">("email");
  const [channelName, setChannelName] = useState("");
  const [channelTarget, setChannelTarget] = useState("");

  const [ruleFormOpen, setRuleFormOpen] = useState(false);
  const [ruleName, setRuleName] = useState("");
  const [ruleJobType, setRuleJobType] = useState<JobType | "any">("any");
  const [ruleChannelId, setRuleChannelId] = useState("");
  const [ruleCooldown, setRuleCooldown] = useState("60");

  function load() {
    adminAlertsApi.listChannels().then((res) => setChannels(res.channels)).catch((err) => setError(err instanceof Error ? err.message : "Failed to load channels."));
    adminAlertsApi.listRules().then((res) => setRules(res.rules)).catch((err) => setError(err instanceof Error ? err.message : "Failed to load rules."));
  }

  useEffect(() => { load(); }, []);

  async function createChannel() {
    if (channelName.trim().length < 1 || channelTarget.trim().length < 1) {
      setError("Name and target are required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await withStepUp(() => adminAlertsApi.createChannel({ type: channelType, name: channelName.trim(), target: channelTarget.trim() }));
      setChannelFormOpen(false);
      setChannelName("");
      setChannelTarget("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create channel.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleChannel(channel: AlertChannel) {
    setBusy(true);
    setError(null);
    try {
      await withStepUp(() => adminAlertsApi.setChannelEnabled(channel.id, !channel.enabled));
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update channel.");
    } finally {
      setBusy(false);
    }
  }

  async function removeChannel(channel: AlertChannel) {
    setBusy(true);
    setError(null);
    try {
      await withStepUp(() => adminAlertsApi.deleteChannel(channel.id));
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete channel.");
    } finally {
      setBusy(false);
    }
  }

  async function createRule() {
    if (ruleName.trim().length < 1) {
      setError("Rule name is required.");
      return;
    }
    if (!ruleChannelId) {
      setError("Pick a channel.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await withStepUp(() => adminAlertsApi.createRule({
        name: ruleName.trim(), sourceModule: "security", condition: "job_failed",
        jobType: ruleJobType === "any" ? null : ruleJobType, channelId: ruleChannelId,
        cooldownMinutes: Number(ruleCooldown) || 60,
      }));
      setRuleFormOpen(false);
      setRuleName("");
      setRuleJobType("any");
      setRuleChannelId("");
      setRuleCooldown("60");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create rule.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleRule(rule: AlertRule) {
    setBusy(true);
    setError(null);
    try {
      await withStepUp(() => adminAlertsApi.setRuleEnabled(rule.id, !rule.enabled));
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update rule.");
    } finally {
      setBusy(false);
    }
  }

  async function removeRule(rule: AlertRule) {
    setBusy(true);
    setError(null);
    try {
      await withStepUp(() => adminAlertsApi.deleteRule(rule.id));
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete rule.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 14, padding: 16, marginTop: 14 }}>
      <b style={{ display: "block", color: "#fff", fontSize: 14, marginBottom: 6 }}>Alerting</b>
      <p style={{ color: T.muted, fontSize: 12, margin: "0 0 14px" }}>
        Shared alerting (decision D8) — Pipelines, Security and AI operations all write into the same rules/channels.
        Only one trigger is wired up so far: a Job (rewrap, storage audit, backfill) transitioning to <span style={{ fontFamily: mono }}>failed</span>.
        Count-based checks (stuck classification backlog, etc.) aren't built yet.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
        <div>
          <Label text={`Channels (${channels?.length ?? 0})`} />
          {channels && channels.length === 0 && !channelFormOpen && <p style={{ color: T.muted, fontSize: 12 }}>No channels configured.</p>}
          {channels?.map((c) => (
            <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 10px", border: `1px solid ${T.border}`, borderRadius: 9, fontSize: 12, marginBottom: 6 }}>
              <div>
                <b style={{ color: T.text }}>{c.name}</b>
                <div style={{ color: T.faint, fontSize: 11, fontFamily: mono }}>{c.type} · {c.target}</div>
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                <button onClick={() => toggleChannel(c)} disabled={busy} style={{ ...ghostBtn, padding: "4px 8px", fontSize: 10.5, color: c.enabled ? T.mint : T.muted }}>
                  {c.enabled ? "enabled" : "disabled"}
                </button>
                <button onClick={() => removeChannel(c)} disabled={busy} style={{ ...ghostBtn, padding: "4px 8px", fontSize: 10.5, color: T.coral }}>delete</button>
              </div>
            </div>
          ))}

          {!channelFormOpen ? (
            <button onClick={() => setChannelFormOpen(true)} style={{ ...ghostBtn, marginTop: 4 }}>Add channel</button>
          ) : (
            <div style={{ border: `1px solid ${T.border}`, borderRadius: 9, padding: 10, marginTop: 4 }}>
              <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                {(["email", "webhook"] as const).map((t) => (
                  <button key={t} onClick={() => setChannelType(t)} style={{ flex: 1, padding: "6px 0", fontSize: 11, fontFamily: mono, borderRadius: 7, cursor: "pointer", border: `1px solid ${channelType === t ? T.gold + "88" : T.border}`, background: channelType === t ? T.raised : "transparent", color: channelType === t ? "#fff" : T.muted }}>{t}</button>
                ))}
              </div>
              <input value={channelName} onChange={(e) => setChannelName(e.target.value)} placeholder="Name (e.g. On-call email)" style={{ width: "100%", boxSizing: "border-box", background: T.raised, border: `1px solid ${T.border}`, borderRadius: 7, padding: "6px 9px", fontSize: 11.5, color: T.text, marginBottom: 6 }} />
              <input value={channelTarget} onChange={(e) => setChannelTarget(e.target.value)} placeholder={channelType === "email" ? "ops@example.com" : "https://hooks.slack.com/..."} style={{ width: "100%", boxSizing: "border-box", background: T.raised, border: `1px solid ${T.border}`, borderRadius: 7, padding: "6px 9px", fontSize: 11.5, color: T.text, marginBottom: 8 }} />
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={createChannel} disabled={busy} style={{ ...goldBtn, flex: 1, padding: "6px 0", fontSize: 11.5 }}>{busy ? "Saving…" : "Confirm"}</button>
                <button onClick={() => setChannelFormOpen(false)} disabled={busy} style={{ ...ghostBtn, flex: 1, padding: "6px 0", fontSize: 11.5 }}>Cancel</button>
              </div>
            </div>
          )}
        </div>

        <div>
          <Label text={`Rules (${rules?.length ?? 0})`} />
          {rules && rules.length === 0 && !ruleFormOpen && <p style={{ color: T.muted, fontSize: 12 }}>No rules configured.</p>}
          {rules?.map((r) => (
            <div key={r.id} style={{ padding: "7px 10px", border: `1px solid ${T.border}`, borderRadius: 9, fontSize: 12, marginBottom: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <b style={{ color: T.text }}>{r.name}</b>
                <div style={{ display: "flex", gap: 4 }}>
                  <button onClick={() => toggleRule(r)} disabled={busy} style={{ ...ghostBtn, padding: "4px 8px", fontSize: 10.5, color: r.enabled ? T.mint : T.muted }}>
                    {r.enabled ? "enabled" : "disabled"}
                  </button>
                  <button onClick={() => removeRule(r)} disabled={busy} style={{ ...ghostBtn, padding: "4px 8px", fontSize: 10.5, color: T.coral }}>delete</button>
                </div>
              </div>
              <div style={{ color: T.faint, fontSize: 11, marginTop: 2 }}>
                job_failed · {r.jobType ?? "any job type"} · → {r.channel.name} · {r.cooldownMinutes}m cooldown
                {r.lastTriggeredAt && <> · last fired {relativeAgeInline(r.lastTriggeredAt)}</>}
              </div>
            </div>
          ))}

          {!ruleFormOpen ? (
            <button onClick={() => setRuleFormOpen(true)} style={{ ...ghostBtn, marginTop: 4 }} disabled={!channels || channels.length === 0}>
              {channels && channels.length === 0 ? "Add a channel first" : "Add rule"}
            </button>
          ) : (
            <div style={{ border: `1px solid ${T.border}`, borderRadius: 9, padding: 10, marginTop: 4 }}>
              <input value={ruleName} onChange={(e) => setRuleName(e.target.value)} placeholder="Name (e.g. Rewrap failures)" style={{ width: "100%", boxSizing: "border-box", background: T.raised, border: `1px solid ${T.border}`, borderRadius: 7, padding: "6px 9px", fontSize: 11.5, color: T.text, marginBottom: 6 }} />
              <select value={ruleJobType} onChange={(e) => setRuleJobType(e.target.value as JobType | "any")} style={{ width: "100%", boxSizing: "border-box", background: T.raised, border: `1px solid ${T.border}`, borderRadius: 7, padding: "6px 9px", fontSize: 11.5, color: T.text, marginBottom: 6 }}>
                <option value="any">Any job type</option>
                <option value="key_rewrap">key_rewrap</option>
                <option value="storage_audit">storage_audit</option>
                <option value="package_source_backfill">package_source_backfill</option>
              </select>
              <select value={ruleChannelId} onChange={(e) => setRuleChannelId(e.target.value)} style={{ width: "100%", boxSizing: "border-box", background: T.raised, border: `1px solid ${T.border}`, borderRadius: 7, padding: "6px 9px", fontSize: 11.5, color: T.text, marginBottom: 6 }}>
                <option value="">Select a channel…</option>
                {channels?.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.type})</option>)}
              </select>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <span style={{ fontSize: 11.5, color: T.muted }}>Cooldown</span>
                <input value={ruleCooldown} onChange={(e) => setRuleCooldown(e.target.value)} inputMode="numeric" style={{ width: 60, background: T.raised, border: `1px solid ${T.border}`, borderRadius: 7, padding: "6px 9px", fontSize: 11.5, color: T.text }} />
                <span style={{ fontSize: 11.5, color: T.muted }}>minutes</span>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={createRule} disabled={busy} style={{ ...goldBtn, flex: 1, padding: "6px 0", fontSize: 11.5 }}>{busy ? "Saving…" : "Confirm"}</button>
                <button onClick={() => setRuleFormOpen(false)} disabled={busy} style={{ ...ghostBtn, flex: 1, padding: "6px 0", fontSize: 11.5 }}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {error && <p style={{ color: T.coral, fontSize: 11.5, marginTop: 10 }}>{error}</p>}
      <p style={{ color: T.faint, fontSize: 10.5, margin: "10px 0 0" }}>Every change above may prompt for a fresh passkey verification (step-up).</p>
    </div>
  );
}

function relativeAgeInline(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
