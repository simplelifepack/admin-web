import { useEffect, useState } from "react";

import { T, mono } from "@/constants/theme";
import { adminPipelinesApi } from "@/lib/api";
import { bytesToMb } from "@/lib/format";
import { relativeAge, timeUntil } from "@/lib/relativeTime";
import { useFetch } from "@/lib/useFetch";

type TabId = "classification" | "health" | "storage" | "uploads";
const TABS: { id: TabId; label: string }[] = [
  { id: "classification", label: "Stuck classification" },
  { id: "health", label: "Health extraction errors" },
  { id: "storage", label: "Storage cleanup retrying" },
  { id: "uploads", label: "Expiring uploads" },
];

export default function Pipelines() {
  const [tab, setTab] = useState<TabId>("classification");
  const [counts, setCounts] = useState<Partial<Record<TabId, number>>>({});

  return (
    <div>
      <h1 style={{ fontSize: 26, fontWeight: 800, color: "#fff", margin: "0 0 6px" }}>Pipelines</h1>
      <p style={{ color: T.muted, fontSize: 14.5, margin: "0 0 16px" }}>
        Where uploads and extractions get stuck. Metadata only — retry arrives in Phase 2.
      </p>

      <div style={{ display: "flex", gap: 4, borderBottom: `1px solid ${T.border}`, marginBottom: 14, overflowX: "auto" }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              background: "none", border: 0, borderBottom: `2px solid ${tab === t.id ? T.gold : "transparent"}`,
              color: tab === t.id ? "#fff" : T.muted, padding: "9px 12px", fontWeight: 600, fontSize: 13,
              cursor: "pointer", whiteSpace: "nowrap", marginBottom: -1,
            }}
          >
            {t.label}
            {counts[t.id] !== undefined && <em style={{ fontFamily: mono, fontSize: 11, fontStyle: "normal", marginLeft: 6, color: T.faint }}>{counts[t.id]}</em>}
          </button>
        ))}
      </div>

      {tab === "classification" && <ClassificationTab onCount={(n) => setCounts((c) => ({ ...c, classification: n }))} />}
      {tab === "health" && <HealthTab onCount={(n) => setCounts((c) => ({ ...c, health: n }))} />}
      {tab === "storage" && <StorageTab onCount={(n) => setCounts((c) => ({ ...c, storage: n }))} />}
      {tab === "uploads" && <UploadsTab onCount={(n) => setCounts((c) => ({ ...c, uploads: n }))} />}
    </div>
  );
}

function Table({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 14, overflow: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 560 }}>
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h} style={{ textAlign: "left", padding: "9px 12px", fontFamily: mono, fontSize: 10.5, letterSpacing: 0.6, color: T.muted, textTransform: "uppercase", borderBottom: `1px solid ${T.border}` }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
function Td({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return <td style={{ padding: "9px 12px", borderBottom: `1px solid ${T.border}`, color: muted ? T.muted : T.text }}>{children}</td>;
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
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 16, background: "rgba(232,115,106,.08)", border: `1px solid ${T.coral}55`, borderRadius: 14 }}>
      <span style={{ color: T.coral }}>⚠</span>
      <span style={{ fontSize: 13, color: T.text }}>{message}</span>
    </div>
  );
}

function ClassificationTab({ onCount }: { onCount: (n: number) => void }) {
  const { data, error } = useFetch(() => adminPipelinesApi.stuckClassification(), []);
  useEffect(() => { if (data) onCount(data.total); }, [data, onCount]);
  if (error) return <ErrorMsg message={error} />;
  if (!data) return null;
  if (data.total === 0) return <Empty label="No documents stuck in classification." />;
  return (
    <Table headers={["ID", "Owner", "Type", "Size", "Pending for", "Mime"]}>
      {data.items.map((d) => (
        <tr key={d.id}>
          <Td><span style={{ fontFamily: mono, fontSize: 12 }}>{d.id}</span></Td>
          <Td muted><span style={{ fontFamily: mono, fontSize: 12 }}>{d.ownerProfileId ?? "—"}</span></Td>
          <Td>{d.documentType}</Td>
          <Td muted>{bytesToMb(d.size)} MB</Td>
          <Td><span style={{ color: T.coral, fontFamily: mono, fontSize: 12 }}>{relativeAge(d.createdAt)}</span></Td>
          <Td muted>{d.mimeType}</Td>
        </tr>
      ))}
    </Table>
  );
}

function HealthTab({ onCount }: { onCount: (n: number) => void }) {
  const { data, error } = useFetch(() => adminPipelinesApi.failedHealthExtractions(), []);
  useEffect(() => { if (data) onCount(data.total); }, [data, onCount]);
  if (error) return <ErrorMsg message={error} />;
  if (!data) return null;
  if (data.total === 0) return <Empty label="No failed health extractions." />;
  return (
    <Table headers={["ID", "Owner", "Type", "Status", "Error", "Age"]}>
      {data.items.map((d) => (
        <tr key={d.id}>
          <Td><span style={{ fontFamily: mono, fontSize: 12 }}>{d.id}</span></Td>
          <Td muted><span style={{ fontFamily: mono, fontSize: 12 }}>{d.userId}</span></Td>
          <Td>{d.type}</Td>
          <Td muted>{d.processingStatus}</Td>
          <Td><span style={{ color: T.coral, fontSize: 12 }}>{d.processingError}</span></Td>
          <Td muted><span style={{ fontFamily: mono, fontSize: 12 }}>{relativeAge(d.createdAt)}</span></Td>
        </tr>
      ))}
    </Table>
  );
}

function StorageTab({ onCount }: { onCount: (n: number) => void }) {
  const { data, error } = useFetch(() => adminPipelinesApi.storageCleanup(), []);
  useEffect(() => { if (data) onCount(data.total); }, [data, onCount]);
  if (error) return <ErrorMsg message={error} />;
  if (!data) return null;
  if (data.total === 0) return <Empty label="No storage deletions pending." />;
  return (
    <Table headers={["Storage key", "Owner", "Size", "Retrying for"]}>
      {data.items.map((d) => (
        <tr key={d.storageKey}>
          <Td><span style={{ fontFamily: mono, fontSize: 12 }}>{d.storageKey}</span></Td>
          <Td muted><span style={{ fontFamily: mono, fontSize: 12 }}>{d.ownerUserId}</span></Td>
          <Td muted>{bytesToMb(d.sizeBytes)} MB</Td>
          <Td><span style={{ color: T.gold, fontFamily: mono, fontSize: 12 }}>{relativeAge(d.createdAt)}</span></Td>
        </tr>
      ))}
    </Table>
  );
}

function UploadsTab({ onCount }: { onCount: (n: number) => void }) {
  const { data, error } = useFetch(() => adminPipelinesApi.expiringUploads(), []);
  useEffect(() => { if (data) onCount(data.total); }, [data, onCount]);
  if (error) return <ErrorMsg message={error} />;
  if (!data) return null;
  if (data.total === 0) return <Empty label="No temporary uploads awaiting review." />;
  return (
    <Table headers={["ID", "Owner", "Mime", "Size", "Expires in"]}>
      {data.items.map((d) => (
        <tr key={d.id}>
          <Td><span style={{ fontFamily: mono, fontSize: 12 }}>{d.id}</span></Td>
          <Td muted><span style={{ fontFamily: mono, fontSize: 12 }}>{d.ownerProfileId}</span></Td>
          <Td muted>{d.detectedMimeType}</Td>
          <Td muted>{bytesToMb(d.size)} MB</Td>
          <Td><span style={{ fontFamily: mono, fontSize: 12, color: T.gold }}>{timeUntil(d.expiresAt)}</span></Td>
        </tr>
      ))}
    </Table>
  );
}
