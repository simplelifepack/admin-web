import { T, mono } from "@/constants/theme";
import { adminBillingApi } from "@/lib/api";
import { relativeAge } from "@/lib/relativeTime";
import { useFetch } from "@/lib/useFetch";

function ErrorMsg({ message }: { message: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 16, background: "rgba(232,115,106,.08)", border: `1px solid ${T.coral}55`, borderRadius: 14 }}>
      <span style={{ color: T.coral }}>⚠</span>
      <span style={{ fontSize: 13, color: T.text }}>{message}</span>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 14, padding: 16 }}>
      <div style={{ fontFamily: mono, fontSize: 28, fontWeight: 800, color: "#fff" }}>{value.toLocaleString()}</div>
      <div style={{ color: T.muted, fontSize: 12, marginTop: 4 }}>{label}</div>
    </div>
  );
}

export default function Billing() {
  const { data: stats, error: statsError } = useFetch(() => adminBillingApi.stats(), []);
  const { data: history, error: historyError } = useFetch(() => adminBillingApi.tierChanges(), []);

  return (
    <div>
      <h1 style={{ fontSize: 26, fontWeight: 800, color: "#fff", margin: "0 0 6px" }}>Billing &amp; revenue</h1>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 14px", background: "rgba(217,184,106,.08)", border: `1px solid ${T.gold}44`, borderRadius: 12, marginBottom: 20 }}>
        <span style={{ color: T.gold }}>ⓘ</span>
        <p style={{ color: T.text, fontSize: 13, margin: 0 }}>
          No payment gateway exists yet (Cashfree for Android/web, Apple IAP for iOS are both still a design decision,
          not built). This is <b>not an MRR or revenue dashboard</b> — there's no real payment data to show one with.
          What's below is the two things that actually are real today: the free/paid account split, and the history
          of manual tier changes an admin has made.
        </p>
      </div>

      {statsError && <ErrorMsg message={statsError} />}
      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 24 }}>
          <StatCard label="Free accounts" value={stats.free} />
          <StatCard label="Paid accounts" value={stats.paid} />
          <StatCard label="Total accounts" value={stats.total} />
        </div>
      )}

      <b style={{ display: "block", color: "#fff", fontSize: 15, marginBottom: 10 }}>Tier change history</b>
      {historyError && <ErrorMsg message={historyError} />}
      {history && history.items.length === 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 16, background: T.panel, border: `1px solid ${T.border}`, borderRadius: 14 }}>
          <span style={{ color: T.mint }}>✓</span>
          <span style={{ fontSize: 13, color: T.text }}>No manual tier changes recorded yet.</span>
        </div>
      )}
      {history && history.items.length > 0 && (
        <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 14, overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 560 }}>
            <thead>
              <tr>
                {["When", "Admin", "Account", "Change", "Reason"].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: "9px 12px", fontFamily: mono, fontSize: 10.5, letterSpacing: 0.6, color: T.muted, textTransform: "uppercase", borderBottom: `1px solid ${T.border}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {history.items.map((row) => (
                <tr key={row.id}>
                  <td style={{ padding: "9px 12px", borderBottom: `1px solid ${T.border}`, color: T.muted, fontFamily: mono, fontSize: 11.5 }}>{relativeAge(row.at)} ago</td>
                  <td style={{ padding: "9px 12px", borderBottom: `1px solid ${T.border}`, fontSize: 12 }}>{row.actorEmail}</td>
                  <td style={{ padding: "9px 12px", borderBottom: `1px solid ${T.border}`, fontFamily: mono, fontSize: 11.5, color: T.muted }}>{row.targetId ?? "—"}</td>
                  <td style={{ padding: "9px 12px", borderBottom: `1px solid ${T.border}` }}>
                    {row.diff?.from && row.diff?.to ? (
                      <span style={{ fontFamily: mono, fontSize: 12 }}>
                        <span style={{ color: T.muted }}>{row.diff.from}</span> → <span style={{ color: row.diff.to === "paid" ? T.mint : T.text }}>{row.diff.to}</span>
                      </span>
                    ) : "—"}
                  </td>
                  <td style={{ padding: "9px 12px", borderBottom: `1px solid ${T.border}`, color: T.muted, fontSize: 12 }}>{row.reason ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
