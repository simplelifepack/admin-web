import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";

import { T, mono, sans } from "@/constants/theme";
import { NAV } from "@/data/nav";
import { adminApi, clearToken, type AdminMe } from "@/lib/api";

export default function Shell({ me, onSignedOut, children }: { me: AdminMe; onSignedOut: () => void; children: ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: T.navy, color: T.text, fontFamily: sans, fontSize: 14 }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 14, minHeight: 32, padding: "6px 16px",
        background: "rgba(232,115,106,.09)", borderBottom: "1px solid rgba(232,115,106,.28)",
        fontFamily: mono, fontSize: 11, color: T.muted, flexShrink: 0,
      }}>
        <span><span style={{ width: 7, height: 7, borderRadius: "50%", background: T.coral, display: "inline-block", marginRight: 7 }} />
          <b style={{ color: T.coral, letterSpacing: 1.4 }}>{import.meta.env.DEV ? "DEVELOPMENT" : "PRODUCTION"}</b></span>
        <span>api · localhost:4000</span>
        <span>role · {me.admin.role}</span>
        <span style={{ marginLeft: "auto" }}>{me.admin.email}</span>
      </div>

      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <aside style={{ width: 232, flexShrink: 0, borderRight: `1px solid ${T.border}`, padding: 16, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "6px 8px 16px" }}>
            <span style={{ display: "grid", placeItems: "center", width: 40, height: 40, borderRadius: 12, background: "#e9c878", color: "#101827", fontWeight: 800, flexShrink: 0 }}>R</span>
            <div>
              <b style={{ display: "block", color: "#fff", fontSize: 17 }}>ReadiNes</b>
              <small style={{ display: "block", color: T.muted, fontFamily: mono, fontSize: 10, letterSpacing: 2 }}>CONSOLE</small>
            </div>
          </div>

          {NAV.map((group) => (
            <div key={group.label}>
              <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: 1.4, color: T.faint, padding: "14px 12px 6px", textTransform: "uppercase" }}>
                {group.label}
              </div>
              {group.items.map((item) => (
                <NavLink
                  key={item.id}
                  to={`/${item.id}`}
                  style={({ isActive }) => ({
                    display: "flex", alignItems: "center", gap: 10, width: "100%",
                    background: isActive ? T.raised : "transparent",
                    color: isActive ? "#fff" : T.muted,
                    border: `1px solid ${isActive ? T.border : "transparent"}`,
                    borderRadius: 10, padding: "9px 12px", fontSize: 13.5, fontWeight: 600,
                    textDecoration: "none", whiteSpace: "nowrap",
                  })}
                >
                  <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{item.label}</span>
                  {!item.built && <span style={{ fontFamily: mono, fontSize: 9, color: T.faint, letterSpacing: 0.5 }}>SCOPE</span>}
                </NavLink>
              ))}
            </div>
          ))}
        </aside>

        <main style={{ flex: 1, minWidth: 0, overflowY: "auto", padding: "18px 26px 32px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10, fontSize: 12.5, color: T.muted }}>
              <span>{me.admin.name}</span>
              <button
                onClick={() => void adminApi.logout().finally(() => { clearToken(); onSignedOut(); })}
                style={{ background: T.raised, color: T.text, border: `1px solid ${T.border}`, borderRadius: 8, padding: "6px 12px", fontSize: 12, cursor: "pointer" }}
              >
                Sign out
              </button>
            </div>
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
