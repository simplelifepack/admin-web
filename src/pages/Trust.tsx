import { T, mono } from "@/constants/theme";
import { adminTrustApi } from "@/lib/api";
import { useFetch } from "@/lib/useFetch";

function ErrorMsg({ message }: { message: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 16, background: "rgba(232,115,106,.08)", border: `1px solid ${T.coral}55`, borderRadius: 14 }}>
      <span style={{ color: T.coral }}>⚠</span>
      <span style={{ fontSize: 13, color: T.text }}>{message}</span>
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone?: "warn" | "coral" }) {
  const color = tone === "coral" ? T.coral : tone === "warn" ? T.gold : "#fff";
  return (
    <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 14, padding: 16 }}>
      <div style={{ fontFamily: mono, fontSize: 28, fontWeight: 800, color }}>{value.toLocaleString()}</div>
      <div style={{ color: T.muted, fontSize: 12, marginTop: 4 }}>{label}</div>
    </div>
  );
}

export default function Trust() {
  const { data, error } = useFetch(() => adminTrustApi.stats(), []);

  return (
    <div>
      <h1 style={{ fontSize: 26, fontWeight: 800, color: "#fff", margin: "0 0 6px" }}>Trust &amp; sharing</h1>
      <p style={{ color: T.muted, fontSize: 14.5, margin: "0 0 20px" }}>
        Invitations, PIN lockouts and revocations in aggregate. Counts and status only — what a specific trust
        member was granted access to stays sealed here, the same as everywhere else in this console. To act on a
        specific abuse report (revoke a trust member), open that owner's account on the Users page — their trust
        members and a revoke action are there, scoped to the account you're already looking at.
      </p>

      {error && <ErrorMsg message={error} />}
      {!data && !error && null}
      {data && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 20 }}>
            <StatCard label="Active" value={data.byStatus.ACTIVE} />
            <StatCard label="Invited (pending)" value={data.byStatus.INVITED} />
            <StatCard label="Revoked" value={data.byStatus.REVOKED} />
            <StatCard label="Rejected" value={data.byStatus.REJECTED} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            <StatCard label="Currently PIN-locked" value={data.currentlyLocked} tone="coral" />
            <StatCard label="Pending invites (not yet expired)" value={data.pendingInvites} />
            <StatCard label="Expired, never accepted" value={data.expiredInvites} tone="warn" />
          </div>
        </>
      )}
    </div>
  );
}
