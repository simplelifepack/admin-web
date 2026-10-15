import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { T, mono } from "@/constants/theme";
import { adminStatsApi, type ActionCenter, type OverviewStats } from "@/lib/api";
import { relativeAge } from "@/lib/relativeTime";

const GROUP_COLOR: Record<string, string> = {
  catalogue: "#D9B86A",
  pipelines: "#3FB9C7",
  security: "#E8736A",
  integrations: "#3FB9C7",
};

export default function Overview() {
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [actionCenter, setActionCenter] = useState<ActionCenter | null>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    Promise.all([adminStatsApi.overview(), adminStatsApi.actionCenter()])
      .then(([s, a]) => { if (active) { setStats(s); setActionCenter(a); } })
      .catch((err) => { if (active) setError(err instanceof Error ? err.message : "Failed to load."); });
    return () => { active = false; };
  }, []);

  return (
    <div>
      <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: -0.5, color: "#fff", margin: "0 0 6px" }}>Platform overview</h1>
      <p style={{ color: T.muted, fontSize: 14.5, margin: "0 0 20px" }}>
        Live from Postgres — not sample data. Period: {stats?.period ?? "…"}
      </p>

      {error && <p style={{ color: T.coral, fontSize: 13 }}>{error}</p>}

      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 14 }}>
          <Stat label="Accounts" value={stats.totalUsers} sub={`+${stats.newUsersThisWeek} this week`} color="#5B8DEF" />
          <Stat label="Documents" value={stats.totalDocuments} sub="not deleted" color="#4FCB95" />
          <Stat label="Pending classification" value={stats.pendingClassification} sub="stuck in Pipelines" color={stats.pendingClassification > 0 ? T.coral : "#4FCB95"} />
          <Stat label="AI actions this month" value={stats.aiActionsThisMonth} sub={stats.period} color="#9B7BE8" />
        </div>
      )}

      {actionCenter && (
        <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 14, overflow: "hidden", maxWidth: 620 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "14px 16px", borderBottom: `1px solid ${T.border}` }}>
            <b style={{ color: "#fff", fontSize: 14 }}>Action center</b>
            <span style={{ marginLeft: "auto", fontFamily: mono, fontSize: 11, color: actionCenter.totalCount ? T.gold : T.mint }}>
              {actionCenter.totalCount || "all clear"}
            </span>
          </div>

          {actionCenter.groups.length === 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px" }}>
              <span style={{ color: T.mint }}>✓</span>
              <span style={{ fontSize: 13, color: T.text }}>Nothing stuck or stale right now.</span>
            </div>
          )}

          {actionCenter.groups.map((group) => (
            <div key={group.key}>
              <div style={{
                display: "flex", alignItems: "center", gap: 9, width: "100%", padding: "10px 16px",
                background: "rgba(27,39,64,.5)", borderBottom: `1px solid ${T.border}`, fontSize: 12.5, color: T.muted,
              }}>
                <strong style={{ color: T.text, fontWeight: 700 }}>{group.label}</strong>
                <span style={{ marginLeft: "auto", fontFamily: mono, fontSize: 11 }}>
                  {group.items.reduce((s, i) => s + i.count, 0)}
                </span>
              </div>
              {group.items.map((item) => (
                <button
                  key={item.label}
                  onClick={() => navigate(`/${item.navTo}`)}
                  style={{
                    display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "11px 16px",
                    background: "none", border: 0, borderBottom: `1px solid ${T.border}`, cursor: "pointer", textAlign: "left", fontSize: 13,
                  }}
                >
                  <i style={{ width: 3, alignSelf: "stretch", borderRadius: 3, flexShrink: 0, background: GROUP_COLOR[group.key] ?? T.muted }} />
                  <span style={{ flex: 1, minWidth: 0, color: T.text }}>{item.label}</span>
                  <span style={{ fontFamily: mono, fontSize: 11, color: T.muted, whiteSpace: "nowrap" }}>
                    {item.count} · oldest {relativeAge(item.oldestAt)}
                  </span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}

      <p style={{ color: T.faint, fontSize: 11.5, marginTop: 20, fontFamily: mono }}>
        GET /admin/v1/overview/stats · /action-center · generated {stats ? new Date(stats.generatedAt).toLocaleTimeString() : "…"}
      </p>
    </div>
  );
}

function Stat({ label, value, sub, color }: { label: string; value: number; sub: string; color: string }) {
  return (
    <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 14, padding: 16 }}>
      <div style={{ width: 34, height: 34, borderRadius: 10, background: `${color}22`, color, display: "grid", placeItems: "center", marginBottom: 10, fontWeight: 700, fontSize: 13 }}>
        {label.charAt(0)}
      </div>
      <strong style={{ display: "block", fontSize: 26, fontWeight: 800, color: "#fff" }}>{value.toLocaleString()}</strong>
      <span style={{ display: "block", color: T.muted, fontSize: 12.5, marginTop: 2 }}>{label}</span>
      <em style={{ display: "block", fontFamily: mono, fontSize: 11, color: T.faint, fontStyle: "normal", marginTop: 4 }}>{sub}</em>
    </div>
  );
}
