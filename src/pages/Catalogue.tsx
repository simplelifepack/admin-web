import { useEffect, useState } from "react";

import { T, mono } from "@/constants/theme";
import {
  adminCatalogueApi, adminJobsApi, API_URL, getToken, type BackfillOutcome, type ImportPreview, type ImportResult, type Job,
  type PackDetail, type PackEditInput, type PackRevision, type PackSummary,
} from "@/lib/api";
import { relativeAge } from "@/lib/relativeTime";
import { useFetch } from "@/lib/useFetch";
import { withStepUp } from "@/lib/stepUp";

const EDITABLE_FIELDS = ["title", "subtitle", "category", "description", "sourceType", "sourceName", "sourceTitle", "sourceUrl", "verificationStatus"] as const;
type EditableField = (typeof EDITABLE_FIELDS)[number];
type EditFormState = Record<EditableField, string>;

function formFromDetail(detail: PackDetail): EditFormState {
  return {
    title: detail.title, subtitle: detail.subtitle ?? "", category: detail.category, description: detail.description ?? "",
    sourceType: detail.sourceType ?? "", sourceName: detail.sourceName ?? "", sourceTitle: detail.sourceTitle ?? "",
    sourceUrl: detail.sourceUrl ?? "", verificationStatus: detail.verificationStatus,
  };
}

const NULLABLE_FIELDS = new Set<EditableField>(["subtitle", "sourceName", "sourceTitle", "sourceUrl"]);

function diffForm(form: EditFormState, detail: PackDetail): PackEditInput {
  const updates: PackEditInput = {};
  const original = formFromDetail(detail);
  for (const field of EDITABLE_FIELDS) {
    if (form[field] === original[field]) continue;
    const value = form[field].trim();
    if (NULLABLE_FIELDS.has(field)) {
      (updates as Record<string, string | null>)[field] = value || null;
    } else {
      (updates as Record<string, string>)[field] = value;
    }
  }
  return updates;
}

type TabId = "review" | "stale" | "import";
const TABS: { id: TabId; label: string }[] = [
  { id: "review", label: "Review queue" },
  { id: "stale", label: "Stale sources" },
  { id: "import", label: "Bulk import" },
];

export default function Catalogue() {
  const [tab, setTab] = useState<TabId>("review");
  const [counts, setCounts] = useState<Partial<Record<TabId, number>>>({});
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [detail, setDetail] = useState<PackDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [listRefreshKey, setListRefreshKey] = useState(0);

  const [revisions, setRevisions] = useState<PackRevision[] | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState<EditFormState | null>(null);
  const [editReason, setEditReason] = useState("");
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [rollbackTargetId, setRollbackTargetId] = useState<string | null>(null);
  const [rollbackReason, setRollbackReason] = useState("");
  const [rollbackBusy, setRollbackBusy] = useState(false);

  const [mergeFormOpen, setMergeFormOpen] = useState(false);
  const [mergeDuplicateSlug, setMergeDuplicateSlug] = useState("");
  const [mergeReason, setMergeReason] = useState("");
  const [mergeBusy, setMergeBusy] = useState(false);
  const [mergeResultMsg, setMergeResultMsg] = useState<string | null>(null);

  useEffect(() => {
    setSelectedSlug(null);
    setDetail(null);
  }, [tab]);

  function loadDetail(slug: string) {
    setDetailError(null);
    adminCatalogueApi.detail(slug)
      .then((res) => setDetail(res.pack))
      .catch((err) => setDetailError(err instanceof Error ? err.message : "Failed to load pack."));
    adminCatalogueApi.revisions(slug)
      .then((res) => setRevisions(res.revisions))
      .catch(() => setRevisions(null));
  }

  useEffect(() => {
    setEditMode(false);
    setEditError(null);
    if (!selectedSlug) { setDetail(null); setRevisions(null); return; }
    loadDetail(selectedSlug);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSlug]);

  function startEdit() {
    if (!detail) return;
    setEditForm(formFromDetail(detail));
    setEditReason("");
    setEditError(null);
    setEditMode(true);
  }

  async function saveEdit() {
    if (!detail || !editForm) return;
    const updates = diffForm(editForm, detail);
    if (Object.keys(updates).length === 0) {
      setEditError("No changes to save.");
      return;
    }
    if (editReason.trim().length < 3) {
      setEditError("Reason must be at least 3 characters.");
      return;
    }
    setEditBusy(true);
    setEditError(null);
    try {
      await withStepUp(() => adminCatalogueApi.edit(detail.slug, updates, editReason));
      setEditMode(false);
      loadDetail(detail.slug);
      setListRefreshKey((k) => k + 1);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setEditBusy(false);
    }
  }

  function openRollback(revisionId: string) {
    setRollbackTargetId(revisionId);
    setRollbackReason("");
    setEditError(null);
  }

  async function confirmRollback() {
    if (!detail || !rollbackTargetId) return;
    if (rollbackReason.trim().length < 3) {
      setEditError("Reason must be at least 3 characters.");
      return;
    }
    setRollbackBusy(true);
    setEditError(null);
    try {
      await withStepUp(() => adminCatalogueApi.rollback(detail.slug, rollbackTargetId, rollbackReason));
      setRollbackTargetId(null);
      loadDetail(detail.slug);
      setListRefreshKey((k) => k + 1);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Rollback failed.");
    } finally {
      setRollbackBusy(false);
    }
  }

  function openMergeForm() {
    setMergeFormOpen(true);
    setMergeDuplicateSlug("");
    setMergeReason("");
    setMergeResultMsg(null);
    setEditError(null);
  }

  async function confirmMerge() {
    if (!detail) return;
    if (mergeDuplicateSlug.trim().length < 1) {
      setEditError("Enter the duplicate pack's slug.");
      return;
    }
    if (mergeReason.trim().length < 3) {
      setEditError("Reason must be at least 3 characters.");
      return;
    }
    setMergeBusy(true);
    setEditError(null);
    try {
      const { result } = await withStepUp(() => adminCatalogueApi.merge(detail.slug, mergeDuplicateSlug.trim(), mergeReason));
      setMergeFormOpen(false);
      setMergeResultMsg(`Merged — ${result.requirementsCopied} requirement(s) copied over, ${result.requirementsAlreadyPresent} already present. The duplicate pack is now soft-deleted.`);
      loadDetail(detail.slug);
      setListRefreshKey((k) => k + 1);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Merge failed.");
    } finally {
      setMergeBusy(false);
    }
  }

  return (
    <div>
      <h1 style={{ fontSize: 26, fontWeight: 800, color: "#fff", margin: "0 0 6px" }}>Catalogue</h1>
      <p style={{ color: T.muted, fontSize: 14.5, margin: "0 0 16px" }}>
        Packs awaiting review and sources that haven't been re-checked. Edit a pack's fields and roll back to a prior
        revision below — requirements editing and merging duplicates aren't built yet.
      </p>

      <div style={{ display: "flex", gap: 4, borderBottom: `1px solid ${T.border}`, marginBottom: 14 }}>
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

      {tab === "import" && <BulkImportPanel onImported={() => setListRefreshKey((k) => k + 1)} />}

      {tab !== "import" && (
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.3fr) minmax(300px,1fr)", gap: 14, alignItems: "start" }}>
        {tab === "review" && (
          <PackList
            fetcher={adminCatalogueApi.reviewQueue}
            emptyLabel="Nothing is waiting for review."
            ageColumn="Submitted"
            ageColor={T.gold}
            nullFallback="created"
            onCount={(n) => setCounts((c) => ({ ...c, review: n }))}
            selectedSlug={selectedSlug}
            onSelect={setSelectedSlug}
            refreshKey={listRefreshKey}
          />
        )}
        {tab === "stale" && (
          <PackList
            fetcher={adminCatalogueApi.staleSources}
            emptyLabel="Every source has been checked in the last 90 days."
            ageColumn="Last checked"
            ageColor={T.coral}
            nullFallback="never"
            onCount={(n) => setCounts((c) => ({ ...c, stale: n }))}
            selectedSlug={selectedSlug}
            onSelect={setSelectedSlug}
            refreshKey={listRefreshKey}
          />
        )}

        {selectedSlug && (
          <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 14, padding: 16 }}>
            {detailError && <p style={{ color: T.coral, fontSize: 13 }}>{detailError}</p>}
            {!detail && !detailError && <p style={{ color: T.muted, fontSize: 13 }}>Loading…</p>}
            {detail && !editMode && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <div>
                    <strong style={{ display: "block", color: "#fff", fontSize: 15 }}>{detail.title}</strong>
                    {detail.subtitle && <span style={{ color: T.muted, fontSize: 12.5 }}>{detail.subtitle}</span>}
                  </div>
                  <ActionButton onClick={startEdit}>Edit</ActionButton>
                </div>
                <div style={{ fontFamily: mono, fontSize: 10.5, color: T.faint, margin: "6px 0 14px" }}>{detail.slug}</div>

                <Label text="Source" />
                <Fact label="Status" value={detail.verificationStatus} />
                <Fact label="Category" value={detail.category} />
                <Fact label="Created by" value={detail.createdBy} />
                <Fact label="Source" value={detail.sourceName ?? detail.sourceType ?? "—"} />
                <Fact label="Last checked" value={detail.lastCheckedAt ? relativeAge(detail.lastCheckedAt) + " ago" : "never"} />
                <Fact label="Version" value={String(detail.version)} />

                <Label text={`Requirements (${detail.requirements.length})`} />
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {detail.requirements.map((r) => (
                    <div key={r.id} style={{ padding: "8px 10px", border: `1px solid ${T.border}`, borderRadius: 9, fontSize: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                        <b style={{ color: T.text }}>{r.title}</b>
                        {r.required && <span style={{ fontFamily: mono, fontSize: 9.5, color: T.coral }}>REQUIRED</span>}
                      </div>
                      {r.group && <span style={{ color: T.faint, fontSize: 11 }}>{r.group}</span>}
                    </div>
                  ))}
                  {detail.requirements.length === 0 && <p style={{ color: T.muted, fontSize: 12 }}>No active requirements.</p>}
                </div>
                <p style={{ color: T.faint, fontSize: 10.5, margin: "6px 0 0" }}>
                  Requirements are captured in every revision but aren't editable yet — only the pack's own fields are.
                </p>

                <Label text={`Revision history (${revisions?.length ?? 0})`} />
                {revisions === null && <p style={{ color: T.muted, fontSize: 12 }}>Loading…</p>}
                {revisions && revisions.length === 0 && <p style={{ color: T.muted, fontSize: 12 }}>No edits yet.</p>}
                {revisions && revisions.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {revisions.map((rev) => (
                      <div key={rev.id} style={{ padding: "8px 10px", border: `1px solid ${T.border}`, borderRadius: 9, fontSize: 11.5 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                          <span><span style={{ fontFamily: mono, color: T.gold }}>v{rev.version}</span> · {relativeAge(rev.createdAt)} ago</span>
                          {rollbackTargetId === rev.id ? null : (
                            <ActionButton danger onClick={() => openRollback(rev.id)}>Roll back to this</ActionButton>
                          )}
                        </div>
                        {rev.reason && <div style={{ color: T.muted, marginTop: 4 }}>{rev.reason}</div>}
                        {rollbackTargetId === rev.id && (
                          <div style={{ marginTop: 8, borderTop: `1px solid ${T.border}`, paddingTop: 8 }}>
                            <p style={{ fontSize: 11.5, margin: "0 0 6px", color: T.text }}>
                              Restore the pack's fields to this revision? A snapshot of the current state is kept, so this can be undone.
                            </p>
                            <input
                              value={rollbackReason}
                              onChange={(e) => setRollbackReason(e.target.value)}
                              placeholder="Reason (required, min 3 chars)…"
                              style={{ width: "100%", boxSizing: "border-box", background: T.raised, border: `1px solid ${T.border}`, borderRadius: 7, padding: "6px 9px", fontSize: 11.5, color: T.text, marginBottom: 6 }}
                            />
                            <div style={{ display: "flex", gap: 6 }}>
                              <button onClick={confirmRollback} disabled={rollbackBusy} style={{ ...goldBtn, flex: 1, padding: "6px 0", fontSize: 11.5, opacity: rollbackBusy ? 0.7 : 1 }}>
                                {rollbackBusy ? "Rolling back…" : "Confirm"}
                              </button>
                              <button onClick={() => setRollbackTargetId(null)} disabled={rollbackBusy} style={{ ...ghostBtn, flex: 1, padding: "6px 0", fontSize: 11.5 }}>
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <Label text="Merge a duplicate" />
                {mergeResultMsg && <p style={{ color: T.mint, fontSize: 11.5, margin: "0 0 8px" }}>✓ {mergeResultMsg}</p>}
                {!mergeFormOpen ? (
                  <ActionButton onClick={openMergeForm}>Merge another pack into this one</ActionButton>
                ) : (
                  <div style={{ border: `1px solid ${T.border}`, borderRadius: 9, padding: 10 }}>
                    <p style={{ fontSize: 11.5, margin: "0 0 8px", color: T.text }}>
                      Copies over any requirement the duplicate has that this pack doesn't, then soft-deletes the duplicate.
                      Refuses if any real user already has a document assignment against the duplicate's requirements.
                    </p>
                    <input
                      value={mergeDuplicateSlug}
                      onChange={(e) => setMergeDuplicateSlug(e.target.value)}
                      placeholder="Duplicate pack's slug…"
                      style={{ width: "100%", boxSizing: "border-box", background: T.raised, border: `1px solid ${T.border}`, borderRadius: 7, padding: "6px 9px", fontSize: 11.5, color: T.text, marginBottom: 6 }}
                    />
                    <input
                      value={mergeReason}
                      onChange={(e) => setMergeReason(e.target.value)}
                      placeholder="Reason (required, min 3 chars)…"
                      style={{ width: "100%", boxSizing: "border-box", background: T.raised, border: `1px solid ${T.border}`, borderRadius: 7, padding: "6px 9px", fontSize: 11.5, color: T.text, marginBottom: 8 }}
                    />
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={confirmMerge} disabled={mergeBusy} style={{ ...goldBtn, flex: 1, padding: "6px 0", fontSize: 11.5, opacity: mergeBusy ? 0.7 : 1 }}>
                        {mergeBusy ? "Merging…" : "Confirm"}
                      </button>
                      <button onClick={() => setMergeFormOpen(false)} disabled={mergeBusy} style={{ ...ghostBtn, flex: 1, padding: "6px 0", fontSize: 11.5 }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {editError && <p style={{ color: T.coral, fontSize: 11.5, marginTop: 10 }}>{editError}</p>}

                <p style={{ color: T.faint, fontSize: 11, marginTop: 14 }}>
                  Import history isn't tracked yet — there's no batch/import table in the schema.
                </p>
              </>
            )}

            {detail && editMode && editForm && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <strong style={{ color: "#fff", fontSize: 14.5 }}>Editing {detail.title}</strong>
                  <button onClick={() => setEditMode(false)} disabled={editBusy} style={{ ...ghostBtn, padding: "5px 10px", fontSize: 11.5 }}>Cancel</button>
                </div>
                <EditField label="Title" value={editForm.title} onChange={(v) => setEditForm({ ...editForm, title: v })} />
                <EditField label="Subtitle" value={editForm.subtitle} onChange={(v) => setEditForm({ ...editForm, subtitle: v })} />
                <EditField label="Category" value={editForm.category} onChange={(v) => setEditForm({ ...editForm, category: v })} />
                <EditField label="Description" value={editForm.description} onChange={(v) => setEditForm({ ...editForm, description: v })} textarea />
                <EditField label="Source type" value={editForm.sourceType} onChange={(v) => setEditForm({ ...editForm, sourceType: v })} />
                <EditField label="Source name" value={editForm.sourceName} onChange={(v) => setEditForm({ ...editForm, sourceName: v })} />
                <EditField label="Source title" value={editForm.sourceTitle} onChange={(v) => setEditForm({ ...editForm, sourceTitle: v })} />
                <EditField label="Source URL" value={editForm.sourceUrl} onChange={(v) => setEditForm({ ...editForm, sourceUrl: v })} />
                <EditField label="Verification status" value={editForm.verificationStatus} onChange={(v) => setEditForm({ ...editForm, verificationStatus: v })} />

                <Label text="Reason" />
                <input
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  placeholder="Why is this changing? (required, min 3 chars)…"
                  style={{ width: "100%", boxSizing: "border-box", background: T.raised, border: `1px solid ${T.border}`, borderRadius: 7, padding: "7px 9px", fontSize: 12, color: T.text, marginBottom: 10 }}
                />
                {editError && <p style={{ color: T.coral, fontSize: 11.5, marginBottom: 8 }}>{editError}</p>}
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={saveEdit} disabled={editBusy} style={{ ...goldBtn, flex: 1, opacity: editBusy ? 0.7 : 1 }}>
                    {editBusy ? "Saving…" : "Save"}
                  </button>
                  <button onClick={() => setEditMode(false)} disabled={editBusy} style={{ ...ghostBtn, flex: 1 }}>Cancel</button>
                </div>
                <p style={{ color: T.faint, fontSize: 10.5, margin: "8px 0 0" }}>
                  May prompt for a fresh passkey verification (step-up, 5-minute window). The current state is saved as a revision before your changes apply.
                </p>
              </>
            )}
          </div>
        )}
      </div>
      )}

      <BackfillJobCard />
    </div>
  );
}

const importFieldStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", background: T.raised, border: `1px solid ${T.border}`, borderRadius: 7,
  padding: "7px 9px", fontSize: 12.5, color: T.text,
};
const importGhostBtn: React.CSSProperties = {
  background: "transparent", border: `1px solid ${T.border}`, color: T.text, borderRadius: 8,
  padding: "7px 13px", fontSize: 12, fontWeight: 600, cursor: "pointer",
};
const importGoldBtn: React.CSSProperties = {
  background: T.gold, border: "none", color: "#10182A", borderRadius: 8,
  padding: "7px 13px", fontSize: 12, fontWeight: 700, cursor: "pointer",
};

function BulkImportPanel({ onImported }: { onImported: () => void }) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [csv, setCsv] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setPreview(null);
    setResult(null);
    setPreviewError(null);
    const reader = new FileReader();
    reader.onload = () => setCsv(String(reader.result ?? ""));
    reader.readAsText(file);
  }

  async function downloadTemplate() {
    const token = getToken();
    const res = await fetch(`${API_URL}/admin/v1/catalogue/import/template`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "catalogue-import-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function runPreview() {
    if (!csv) return;
    setPreviewing(true);
    setPreviewError(null);
    setResult(null);
    try {
      setPreview(await adminCatalogueApi.importPreview(csv));
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : "Preview failed.");
    } finally {
      setPreviewing(false);
    }
  }

  async function runImport() {
    if (!csv || !preview) return;
    if (reason.trim().length < 3) { setImportError("Reason must be at least 3 characters."); return; }
    setImporting(true);
    setImportError(null);
    try {
      const res = await withStepUp(() => adminCatalogueApi.import(csv, reason));
      setResult(res);
      setPreview(null);
      onImported();
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 14, padding: 16, maxWidth: 720 }}>
      <b style={{ display: "block", color: "#fff", fontSize: 14.5, marginBottom: 4 }}>Bulk import</b>
      <p style={{ color: T.muted, fontSize: 12.5, margin: "0 0 12px" }}>
        Upload a CSV, preview what it would create, then import. Duplicate slugs or titles are rejected automatically.
        Reuses the same CSV format as the existing <span style={{ fontFamily: mono }}>/coffee/packages</span> stopgap.
      </p>

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
        <button onClick={downloadTemplate} style={importGhostBtn}>Download CSV template</button>
        <label style={{ ...importGhostBtn, display: "inline-block" }}>
          {fileName ?? "Choose CSV file…"}
          <input type="file" accept=".csv,text/csv" onChange={onFileSelected} style={{ display: "none" }} />
        </label>
        {csv && (
          <button onClick={runPreview} disabled={previewing} style={{ ...importGoldBtn, opacity: previewing ? 0.7 : 1 }}>
            {previewing ? "Previewing…" : "Preview"}
          </button>
        )}
      </div>

      {previewError && <p style={{ color: T.coral, fontSize: 12, marginBottom: 10 }}>{previewError}</p>}

      {preview && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontFamily: mono, fontSize: 12, marginBottom: 8 }}>
            <span style={{ color: T.mint }}>{preview.summary.valid} valid</span>
            {" · "}
            <span style={{ color: preview.summary.invalid ? T.coral : T.muted }}>{preview.summary.invalid} invalid</span>
          </div>
          <div style={{ border: `1px solid ${T.border}`, borderRadius: 9, overflow: "auto", maxHeight: 260, marginBottom: 10 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr>
                  {["Row", "Title", "Slug", "Status"].map((h) => (
                    <th key={h} style={{ textAlign: "left", padding: "7px 10px", fontFamily: mono, fontSize: 10, letterSpacing: 0.5, color: T.muted, textTransform: "uppercase", borderBottom: `1px solid ${T.border}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row) => (
                  <tr key={row.rowNumber}>
                    <td style={{ padding: "6px 10px", borderBottom: `1px solid ${T.border}`, fontFamily: mono, color: T.muted }}>{row.rowNumber}</td>
                    <td style={{ padding: "6px 10px", borderBottom: `1px solid ${T.border}` }}>{row.title || "—"}</td>
                    <td style={{ padding: "6px 10px", borderBottom: `1px solid ${T.border}`, fontFamily: mono, color: T.muted }}>{row.slug}</td>
                    <td style={{ padding: "6px 10px", borderBottom: `1px solid ${T.border}` }}>
                      {row.errors.length === 0
                        ? <span style={{ color: T.mint }}>valid</span>
                        : <span style={{ color: T.coral, fontSize: 11 }}>{row.errors.join("; ")}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {preview.summary.valid > 0 && (
            <>
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason (required, min 3 chars)…"
                style={{ ...importFieldStyle, marginBottom: 8 }}
              />
              {importError && <p style={{ color: T.coral, fontSize: 12, marginBottom: 8 }}>{importError}</p>}
              <button onClick={runImport} disabled={importing} style={{ ...importGoldBtn, opacity: importing ? 0.7 : 1 }}>
                {importing ? "Importing…" : `Import ${preview.summary.valid} valid row${preview.summary.valid === 1 ? "" : "s"}`}
              </button>
              <p style={{ color: T.faint, fontSize: 10.5, margin: "8px 0 0" }}>Invalid rows are skipped. May prompt for a fresh passkey verification (step-up).</p>
            </>
          )}
        </div>
      )}

      {result && (
        <div style={{ border: `1px solid ${T.border}`, borderRadius: 9, padding: 12 }}>
          <div style={{ fontFamily: mono, fontSize: 12.5, marginBottom: 6 }}>
            <span style={{ color: T.mint }}>{result.successCount} created</span>
            {result.failedCount > 0 && <span style={{ color: T.coral }}> · {result.failedCount} failed</span>}
          </div>
          {result.results.filter((r) => r.status === "failed").map((r) => (
            <div key={r.rowNumber} style={{ fontSize: 11.5, color: T.coral }}>Row {r.rowNumber}: {r.errors.join("; ")}</div>
          ))}
        </div>
      )}
    </div>
  );
}

function BackfillJobCard() {
  const [job, setJob] = useState<Job | null | undefined>(undefined);
  const [preview, setPreview] = useState<{ totalCount: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    adminJobsApi.backfillCurrent().then((res) => setJob(res.job)).catch(() => setJob(null));
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
      setPreview(await adminJobsApi.backfillPreview());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preview failed.");
    }
  }

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const { job: started } = await withStepUp(() => adminJobsApi.backfillStart());
      setJob(started);
      setPreview(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the backfill.");
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
  const outcomes = ((job?.resultSummary as { outcomes?: BackfillOutcome[] } | null)?.outcomes) ?? [];

  return (
    <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 14, padding: 16, marginTop: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <b style={{ color: "#fff", fontSize: 14 }}>Source backfill</b>
        {job && <StatusPill status={job.status} />}
      </div>
      <p style={{ color: T.muted, fontSize: 12, margin: "0 0 12px" }}>
        Fills in missing source metadata for packs — organization, URL, last-checked date — via the AI provider. Dev runs against the mock provider, not a live/costly one.
      </p>

      {!job && (
        <>
          <button onClick={runPreview} style={ghostBtn}>Preview</button>
          {preview && (
            <p style={{ fontSize: 12.5, color: T.text, margin: "10px 0" }}>
              <b style={{ color: T.gold }}>{preview.totalCount.toLocaleString()}</b> pack(s) are missing source metadata.
            </p>
          )}
          <button onClick={start} disabled={busy} style={{ ...goldBtn, marginTop: 10, opacity: busy ? 0.7 : 1 }}>
            {busy ? "Starting…" : "Start backfill"}
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
            {job.processedCount.toLocaleString()} of {job.totalCount?.toLocaleString() ?? "?"} · {job.updatedCount.toLocaleString()} updated
            {job.failedCount > 0 && <span style={{ color: T.coral }}> · {job.failedCount.toLocaleString()} failed</span>}
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
            {job.status === "running" && <button onClick={pause} disabled={busy} style={ghostBtn}>Pause</button>}
            {job.status === "paused" && <button onClick={resume} disabled={busy} style={ghostBtn}>Resume</button>}
          </div>
        </>
      )}

      {job && job.status === "completed" && (
        <p style={{ color: T.mint, fontSize: 12.5, margin: "10px 0 0" }}>
          ✓ Complete — {job.updatedCount.toLocaleString()} pack(s) updated, {job.failedCount.toLocaleString()} failed ({job.processedCount.toLocaleString()} scanned).
        </p>
      )}

      {outcomes.length > 0 && (
        <div style={{ marginTop: 10, maxHeight: 180, overflow: "auto", border: `1px solid ${T.border}`, borderRadius: 9 }}>
          {outcomes.map((o, i) => (
            <div key={`${o.packId}-${i}`} style={{ padding: "7px 9px", borderBottom: i < outcomes.length - 1 ? `1px solid ${T.border}` : undefined, fontSize: 11 }}>
              <span style={{ fontFamily: mono, color: o.status === "updated" ? T.mint : o.status === "failed" ? T.coral : T.muted }}>{o.status}</span>
              <span style={{ color: T.faint }}> · </span>
              <span style={{ color: T.text }}>{o.slug}</span>
              {o.detail && <div style={{ color: T.faint, marginTop: 2 }}>{o.detail}</div>}
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

function PackList({
  fetcher, emptyLabel, ageColumn, ageColor, nullFallback, onCount, selectedSlug, onSelect, refreshKey,
}: {
  fetcher: (limit?: number) => Promise<{ total: number; items: PackSummary[] }>;
  emptyLabel: string;
  ageColumn: string;
  ageColor: string;
  nullFallback: "created" | "never";
  onCount: (n: number) => void;
  selectedSlug: string | null;
  onSelect: (slug: string) => void;
  refreshKey: number;
}) {
  const { data, error } = useFetch(() => fetcher(), [fetcher, refreshKey]);
  useEffect(() => { if (data) onCount(data.total); }, [data, onCount]);

  if (error) return <ErrorMsg message={error} />;
  if (!data) return null;
  if (data.total === 0) return <Empty label={emptyLabel} />;

  return (
    <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 14, overflow: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 480 }}>
        <thead>
          <tr>
            {["Pack", "Category", ageColumn].map((h) => (
              <th key={h} style={{ textAlign: "left", padding: "9px 12px", fontFamily: mono, fontSize: 10.5, letterSpacing: 0.6, color: T.muted, textTransform: "uppercase", borderBottom: `1px solid ${T.border}` }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.items.map((p) => (
            <tr key={p.id} onClick={() => onSelect(p.slug)} style={{ cursor: "pointer", background: p.slug === selectedSlug ? T.raised : "transparent" }}>
              <td style={{ padding: "10px 12px", borderBottom: `1px solid ${T.border}` }}>
                <div style={{ color: "#fff", fontWeight: 600 }}>{p.title}</div>
                <div style={{ color: T.faint, fontFamily: mono, fontSize: 11 }}>{p.slug}</div>
              </td>
              <td style={{ padding: "10px 12px", borderBottom: `1px solid ${T.border}`, color: T.muted }}>{p.category}</td>
              <td style={{ padding: "10px 12px", borderBottom: `1px solid ${T.border}` }}>
                <span style={{ color: ageColor, fontFamily: mono, fontSize: 12 }}>
                  {p.lastCheckedAt
                    ? relativeAge(p.lastCheckedAt) + " ago"
                    : nullFallback === "never" ? "never" : relativeAge(p.createdAt) + " ago"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 16, background: "rgba(232,115,106,.08)", border: `1px solid ${T.coral}55`, borderRadius: 14 }}>
      <span style={{ color: T.coral }}>⚠</span>
      <span style={{ fontSize: 13, color: T.text }}>{message}</span>
    </div>
  );
}
function Label({ text }: { text: string }) {
  return <span style={{ display: "block", fontFamily: mono, fontSize: 10.5, letterSpacing: 1, color: T.faint, textTransform: "uppercase", margin: "14px 0 6px" }}>{text}</span>;
}
function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "7px 0", borderBottom: `1px solid ${T.border}`, fontSize: 12.5 }}>
      <span style={{ color: T.muted }}>{label}</span>
      <span>{value}</span>
    </div>
  );
}
function ActionButton({ children, onClick, danger }: { children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      style={{
        border: `1px solid ${danger ? T.coral + "66" : T.border}`, background: T.raised, color: danger ? T.coral : T.text,
        borderRadius: 8, padding: "5px 10px", fontSize: 11.5, fontWeight: 600, cursor: "pointer", flexShrink: 0,
      }}
    >
      {children}
    </button>
  );
}
function EditField({ label, value, onChange, textarea }: { label: string; value: string; onChange: (v: string) => void; textarea?: boolean }) {
  const style: React.CSSProperties = {
    width: "100%", boxSizing: "border-box", background: T.raised, border: `1px solid ${T.border}`, borderRadius: 7,
    padding: "7px 9px", fontSize: 12.5, color: T.text, fontFamily: "inherit",
  };
  return (
    <div style={{ marginBottom: 10 }}>
      <span style={{ display: "block", fontFamily: mono, fontSize: 10, letterSpacing: 0.6, color: T.faint, textTransform: "uppercase", marginBottom: 4 }}>{label}</span>
      {textarea ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3} style={{ ...style, resize: "vertical" }} />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} style={style} />
      )}
    </div>
  );
}
