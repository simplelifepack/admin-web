import { useEffect, useState } from "react";

import { T, mono } from "@/constants/theme";
import {
  adminCommsApi, adminSystemSettingsApi, type AnnouncementValue, type EmailLogEntry, type EmailPreview,
  type FeatureFlagsValue, type MaintenanceModeValue, type MinSupportedVersionValue, type SystemSetting,
} from "@/lib/api";
import { relativeAge } from "@/lib/relativeTime";
import { useFetch } from "@/lib/useFetch";
import { withStepUp } from "@/lib/stepUp";

const TEMPLATE_LABELS: Record<string, string> = {
  welcome: "Welcome", login_alert: "Login alert", password_reset: "Password reset (link)",
  password_reset_otp: "Password reset (OTP)", signup_otp: "Signup OTP", account_change: "Account change OTP",
  trust_invitation: "Trust invitation", wealth_handoff: "Wealth SOS handoff", raw: "Raw (ad hoc — no fixed template)",
};

export default function Comms() {
  const [templateFilter, setTemplateFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "sent" | "failed">("");
  const { data, error } = useFetch(
    () => adminCommsApi.emailLog({ template: templateFilter || undefined, status: statusFilter || undefined }),
    [templateFilter, statusFilter],
  );

  return (
    <div>
      <h1 style={{ fontSize: 26, fontWeight: 800, color: "#fff", margin: "0 0 6px" }}>Comms &amp; system</h1>
      <p style={{ color: T.muted, fontSize: 14.5, margin: "0 0 16px" }}>
        Delivery log for every email the app sends, and a preview of each template with sample data — never a real
        user's content. Config below applies without a deploy. SMTP health isn't built yet.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.3fr) minmax(300px,1fr)", gap: 14, alignItems: "start" }}>
        <div>
          <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center", flexWrap: "wrap" }}>
            <input
              value={templateFilter}
              onChange={(e) => setTemplateFilter(e.target.value)}
              placeholder="Filter by template (e.g. welcome)…"
              style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 8, padding: "7px 11px", fontSize: 12.5, color: T.text, minWidth: 220 }}
            />
            {(["", "sent", "failed"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                style={{
                  border: `1px solid ${statusFilter === s ? T.gold + "88" : T.border}`,
                  background: statusFilter === s ? T.raised : T.panel, color: statusFilter === s ? "#fff" : T.muted,
                  borderRadius: 999, padding: "6px 13px", fontSize: 12.5, fontWeight: 600, cursor: "pointer",
                }}
              >
                {s === "" ? "All" : s === "sent" ? "Sent" : "Failed"}
              </button>
            ))}
            {data && (
              <span style={{ fontFamily: mono, fontSize: 11.5, color: T.faint, marginLeft: "auto" }}>
                {data.total.toLocaleString()} total · <span style={{ color: T.mint }}>{data.sentCount.toLocaleString()} sent</span> · <span style={{ color: T.coral }}>{data.failedCount.toLocaleString()} failed</span>
              </span>
            )}
          </div>

          {error && <ErrorMsg message={error} />}
          {data && data.items.length === 0 && <Empty label="No emails logged yet for this filter." />}
          {data && data.items.length > 0 && (
            <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 14, overflow: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 520 }}>
                <thead>
                  <tr>
                    {["When", "Template", "Recipient", "Status"].map((h) => (
                      <th key={h} style={{ textAlign: "left", padding: "9px 12px", fontFamily: mono, fontSize: 10.5, letterSpacing: 0.6, color: T.muted, textTransform: "uppercase", borderBottom: `1px solid ${T.border}` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((row) => (
                    <LogRow key={row.id} row={row} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <TemplatePreviewCard />
      </div>

      <SystemSettingsSection />
    </div>
  );
}

function LogRow({ row }: { row: EmailLogEntry }) {
  return (
    <tr>
      <td style={{ padding: "9px 12px", borderBottom: `1px solid ${T.border}`, color: T.muted, fontFamily: mono, fontSize: 11.5 }}>{relativeAge(row.createdAt)} ago</td>
      <td style={{ padding: "9px 12px", borderBottom: `1px solid ${T.border}`, fontFamily: mono, fontSize: 12 }}>{TEMPLATE_LABELS[row.template] ?? row.template}</td>
      <td style={{ padding: "9px 12px", borderBottom: `1px solid ${T.border}`, fontSize: 12 }}>{row.recipient}</td>
      <td style={{ padding: "9px 12px", borderBottom: `1px solid ${T.border}` }}>
        <span style={{ fontFamily: mono, fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: row.status === "sent" ? "rgba(79,203,149,.14)" : "rgba(232,115,106,.14)", color: row.status === "sent" ? T.mint : T.coral }}>
          {row.status}{row.status === "failed" && row.errorCode ? ` · ${row.errorCode}` : ""}
        </span>
      </td>
    </tr>
  );
}

function TemplatePreviewCard() {
  const [templates, setTemplates] = useState<string[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [preview, setPreview] = useState<EmailPreview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminCommsApi.templates().then((res) => {
      setTemplates(res.templates);
      if (res.templates.length) setSelected(res.templates[0]);
    }).catch((err) => setError(err instanceof Error ? err.message : "Failed to load templates."));
  }, []);

  useEffect(() => {
    if (!selected) return;
    setError(null);
    adminCommsApi.preview(selected).then(setPreview).catch((err) => setError(err instanceof Error ? err.message : "Failed to load preview."));
  }, [selected]);

  return (
    <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 14, padding: 16 }}>
      <b style={{ display: "block", color: "#fff", fontSize: 14, marginBottom: 10 }}>Template preview</b>
      {templates && (
        <select
          value={selected ?? ""}
          onChange={(e) => setSelected(e.target.value)}
          style={{ width: "100%", boxSizing: "border-box", background: T.raised, border: `1px solid ${T.border}`, borderRadius: 7, padding: "7px 9px", fontSize: 12, color: T.text, marginBottom: 10 }}
        >
          {templates.map((t) => <option key={t} value={t}>{TEMPLATE_LABELS[t] ?? t}</option>)}
        </select>
      )}

      {error && <ErrorMsg message={error} />}

      {preview && (
        <>
          <div style={{ fontSize: 12.5, color: T.text, marginBottom: 8 }}><b>Subject:</b> {preview.subject}</div>
          <div style={{ border: `1px solid ${T.border}`, borderRadius: 9, overflow: "hidden", background: "#fff" }}>
            <iframe
              title="Email preview"
              srcDoc={preview.html}
              sandbox=""
              style={{ width: "100%", height: 420, border: "none", display: "block" }}
            />
          </div>
          <p style={{ color: T.faint, fontSize: 10.5, margin: "8px 0 0" }}>
            Rendered with sample data, not any real user's content. Sandboxed — no scripts run.
          </p>
        </>
      )}
    </div>
  );
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
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 16, background: "rgba(232,115,106,.08)", border: `1px solid ${T.coral}55`, borderRadius: 14, marginBottom: 12 }}>
      <span style={{ color: T.coral }}>⚠</span>
      <span style={{ fontSize: 13, color: T.text }}>{message}</span>
    </div>
  );
}

const ghostBtn: React.CSSProperties = {
  background: "transparent", border: `1px solid ${T.border}`, color: T.text, borderRadius: 8,
  padding: "7px 13px", fontSize: 12, fontWeight: 600, cursor: "pointer",
};
const goldBtn: React.CSSProperties = {
  background: T.gold, border: "none", color: T.inkOnGold, borderRadius: 8,
  padding: "8px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer",
};
const fieldStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", background: "#171E2E", border: `1px solid ${T.border}`, borderRadius: 7,
  padding: "7px 9px", fontSize: 12.5, color: T.text,
};

function SystemSettingsSection() {
  const [settings, setSettings] = useState<SystemSetting[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  function load() {
    adminSystemSettingsApi.list().then((res) => setSettings(res.settings)).catch((err) => setLoadError(err instanceof Error ? err.message : "Failed to load settings."));
  }
  useEffect(() => { load(); }, []);

  const byKey = new Map((settings ?? []).map((s) => [s.key, s]));

  return (
    <div style={{ marginTop: 14 }}>
      <b style={{ display: "block", color: "#fff", fontSize: 15, marginBottom: 4 }}>System settings</b>
      <p style={{ color: T.muted, fontSize: 12.5, margin: "0 0 12px" }}>
        Exposed to clients additively via <span style={{ fontFamily: mono }}>GET /api/bootstrap</span>'s <span style={{ fontFamily: mono }}>systemConfig</span> block — an older client build simply never looks at these fields.
      </p>
      {loadError && <ErrorMsg message={loadError} />}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 14 }}>
        <AnnouncementEditor current={byKey.get("announcement")?.value as AnnouncementValue | undefined} onSaved={load} />
        <FeatureFlagsEditor current={byKey.get("feature_flags")?.value as FeatureFlagsValue | undefined} onSaved={load} />
        <MinVersionEditor current={byKey.get("min_supported_version")?.value as MinSupportedVersionValue | undefined} onSaved={load} />
        <MaintenanceModeEditor current={byKey.get("maintenance_mode")?.value as MaintenanceModeValue | undefined} onSaved={load} />
      </div>
    </div>
  );
}

function SettingCard({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 14, padding: 16 }}>
      <b style={{ display: "block", color: "#fff", fontSize: 13.5, marginBottom: note ? 4 : 10 }}>{title}</b>
      {note && <p style={{ color: T.faint, fontSize: 11, margin: "0 0 10px" }}>{note}</p>}
      {children}
    </div>
  );
}

function SaveRow({ onSave, busy, reason, setReason, error }: { onSave: () => void; busy: boolean; reason: string; setReason: (v: string) => void; error: string | null }) {
  return (
    <>
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason (required, min 3 chars)…"
        style={{ ...fieldStyle, marginTop: 8, marginBottom: 8 }}
      />
      {error && <p style={{ color: T.coral, fontSize: 11.5, margin: "0 0 8px" }}>{error}</p>}
      <button onClick={onSave} disabled={busy} style={{ ...goldBtn, width: "100%", opacity: busy ? 0.7 : 1 }}>
        {busy ? "Saving…" : "Save"}
      </button>
      <p style={{ color: T.faint, fontSize: 10.5, margin: "8px 0 0" }}>May prompt for a fresh passkey verification (step-up).</p>
    </>
  );
}

function AnnouncementEditor({ current, onSaved }: { current: AnnouncementValue | undefined; onSaved: () => void }) {
  const [text, setText] = useState(current?.text ?? "");
  const [severity, setSeverity] = useState<AnnouncementValue["severity"]>(current?.severity ?? "info");
  const [active, setActive] = useState(current?.active ?? false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setText(current?.text ?? ""); setSeverity(current?.severity ?? "info"); setActive(current?.active ?? false);
  }, [current]);

  async function save() {
    if (reason.trim().length < 3) { setError("Reason must be at least 3 characters."); return; }
    setBusy(true); setError(null);
    try {
      await withStepUp(() => adminSystemSettingsApi.set("announcement", { text, severity, active }, reason));
      setReason("");
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SettingCard title="Announcement">
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder="Banner text shown to users…" style={{ ...fieldStyle, resize: "vertical", marginBottom: 8 }} />
      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
        {(["info", "warning", "critical"] as const).map((s) => (
          <button key={s} onClick={() => setSeverity(s)} style={{ flex: 1, padding: "6px 0", fontSize: 11, fontFamily: mono, borderRadius: 7, cursor: "pointer", border: `1px solid ${severity === s ? T.gold + "88" : T.border}`, background: severity === s ? T.raised : "transparent", color: severity === s ? "#fff" : T.muted }}>{s}</button>
        ))}
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: T.text, cursor: "pointer" }}>
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Active (shown to users)
      </label>
      <SaveRow onSave={save} busy={busy} reason={reason} setReason={setReason} error={error} />
    </SettingCard>
  );
}

function FeatureFlagsEditor({ current, onSaved }: { current: FeatureFlagsValue | undefined; onSaved: () => void }) {
  const [flags, setFlags] = useState<Record<string, boolean>>(current ?? {});
  const [newFlagName, setNewFlagName] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setFlags(current ?? {}); }, [current]);

  function addFlag() {
    const name = newFlagName.trim();
    if (!name || name in flags) return;
    setFlags({ ...flags, [name]: false });
    setNewFlagName("");
  }

  async function save() {
    if (reason.trim().length < 3) { setError("Reason must be at least 3 characters."); return; }
    setBusy(true); setError(null);
    try {
      await withStepUp(() => adminSystemSettingsApi.set("feature_flags", flags, reason));
      setReason("");
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SettingCard title="Feature flags">
      {Object.keys(flags).length === 0 && <p style={{ color: T.muted, fontSize: 12, margin: "0 0 8px" }}>No flags yet.</p>}
      {Object.entries(flags).map(([name, value]) => (
        <div key={name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: `1px solid ${T.border}`, fontSize: 12.5 }}>
          <span style={{ fontFamily: mono }}>{name}</span>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => setFlags({ ...flags, [name]: !value })} style={{ ...ghostBtn, padding: "4px 8px", fontSize: 10.5, color: value ? T.mint : T.muted }}>{value ? "on" : "off"}</button>
            <button onClick={() => { const rest = { ...flags }; delete rest[name]; setFlags(rest); }} style={{ ...ghostBtn, padding: "4px 8px", fontSize: 10.5, color: T.coral }}>remove</button>
          </div>
        </div>
      ))}
      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
        <input value={newFlagName} onChange={(e) => setNewFlagName(e.target.value)} placeholder="new_flag_name" style={{ ...fieldStyle, flex: 1 }} />
        <button onClick={addFlag} style={ghostBtn}>Add</button>
      </div>
      <SaveRow onSave={save} busy={busy} reason={reason} setReason={setReason} error={error} />
    </SettingCard>
  );
}

function MinVersionEditor({ current, onSaved }: { current: MinSupportedVersionValue | undefined; onSaved: () => void }) {
  const [ios, setIos] = useState(current?.ios ?? "");
  const [android, setAndroid] = useState(current?.android ?? "");
  const [web, setWeb] = useState(current?.web ?? "");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setIos(current?.ios ?? ""); setAndroid(current?.android ?? ""); setWeb(current?.web ?? ""); }, [current]);

  async function save() {
    if (reason.trim().length < 3) { setError("Reason must be at least 3 characters."); return; }
    setBusy(true); setError(null);
    try {
      await withStepUp(() => adminSystemSettingsApi.set("min_supported_version", {
        ios: ios.trim() || null, android: android.trim() || null, web: web.trim() || null,
      }, reason));
      setReason("");
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SettingCard title="Minimum supported version" note="Clients would need their own update to actually check and enforce this — stored and exposed here, not wired client-side.">
      <input value={ios} onChange={(e) => setIos(e.target.value)} placeholder="iOS (e.g. 2.4.0)" style={{ ...fieldStyle, marginBottom: 6 }} />
      <input value={android} onChange={(e) => setAndroid(e.target.value)} placeholder="Android (e.g. 2.4.0)" style={{ ...fieldStyle, marginBottom: 6 }} />
      <input value={web} onChange={(e) => setWeb(e.target.value)} placeholder="Web (e.g. 2026.10.1)" style={fieldStyle} />
      <SaveRow onSave={save} busy={busy} reason={reason} setReason={setReason} error={error} />
    </SettingCard>
  );
}

function MaintenanceModeEditor({ current, onSaved }: { current: MaintenanceModeValue | undefined; onSaved: () => void }) {
  const [active, setActive] = useState(current?.active ?? false);
  const [message, setMessage] = useState(current?.message ?? "");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setActive(current?.active ?? false); setMessage(current?.message ?? ""); }, [current]);

  async function save() {
    if (reason.trim().length < 3) { setError("Reason must be at least 3 characters."); return; }
    setBusy(true); setError(null);
    try {
      await withStepUp(() => adminSystemSettingsApi.set("maintenance_mode", { active, message }, reason));
      setReason("");
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SettingCard
      title="Maintenance mode"
      note="Not enforced yet — this flag is stored and exposed via bootstrap, but nothing server-side currently blocks requests when it's active. Flipping this does not take the app down."
    >
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: T.text, cursor: "pointer", marginBottom: 8 }}>
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Active
      </label>
      <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={2} placeholder="Message shown during maintenance…" style={{ ...fieldStyle, resize: "vertical" }} />
      <SaveRow onSave={save} busy={busy} reason={reason} setReason={setReason} error={error} />
    </SettingCard>
  );
}
