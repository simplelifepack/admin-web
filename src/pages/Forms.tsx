import { useEffect, useState } from "react";

import { T, mono } from "@/constants/theme";
import {
  adminFormsApi,
  type DocumentTypeDefinition, type WealthFormCategory, type WealthFormCategoryTree,
  type WealthFormField, type WealthFormSubtype,
} from "@/lib/api";
import { useFetch } from "@/lib/useFetch";
import { withStepUp } from "@/lib/stepUp";

const fieldStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", background: "#171E2E", border: `1px solid ${T.border}`, borderRadius: 7,
  padding: "7px 9px", fontSize: 12.5, color: T.text,
};
const ghostBtn: React.CSSProperties = {
  background: "transparent", border: `1px solid ${T.border}`, color: T.text, borderRadius: 8,
  padding: "6px 12px", fontSize: 11.5, fontWeight: 600, cursor: "pointer",
};
const goldBtn: React.CSSProperties = {
  background: T.gold, border: "none", color: T.inkOnGold, borderRadius: 8,
  padding: "7px 13px", fontSize: 12, fontWeight: 700, cursor: "pointer",
};

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

type Tab = "wealth" | "registry";

export default function Forms() {
  const [tab, setTab] = useState<Tab>("wealth");

  return (
    <div>
      <h1 style={{ fontSize: 26, fontWeight: 800, color: "#fff", margin: "0 0 6px" }}>Forms &amp; document types</h1>
      <p style={{ color: T.muted, fontSize: 14.5, margin: "0 0 16px" }}>
        The wealth-record intake form's categories, subtypes and fields (DB-backed, editable here) and the
        document-identification registry used during document upload (hardcoded in the ingestion service, view-only
        for now — see note below).
      </p>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {([["wealth", "Wealth form catalogue"], ["registry", "Document-type registry"]] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            style={{
              border: `1px solid ${tab === id ? T.gold + "88" : T.border}`,
              background: tab === id ? T.raised : T.panel, color: tab === id ? "#fff" : T.muted,
              borderRadius: 999, padding: "7px 15px", fontSize: 12.5, fontWeight: 600, cursor: "pointer",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "wealth" ? <WealthCatalogue /> : <DocumentTypeRegistry />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Wealth form catalogue
// ---------------------------------------------------------------------------

function WealthCatalogue() {
  const { data, error } = useFetch(() => adminFormsApi.wealthCategories(), []);
  const [refreshKey, setRefreshKey] = useState(0);
  const [categories, setCategories] = useState<WealthFormCategory[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => { if (data) setCategories(data.categories); }, [data]);

  function reloadCategories() {
    adminFormsApi.wealthCategories().then((res) => setCategories(res.categories)).catch(() => {});
  }

  if (error) return <ErrorMsg message={error} />;
  if (!categories) return <Empty label="Loading…" />;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "260px minmax(0,1fr)", gap: 14, alignItems: "start" }}>
      <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 14, overflow: "hidden" }}>
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => setSelectedId(c.id)}
            style={{
              display: "block", width: "100%", textAlign: "left", padding: "11px 14px", cursor: "pointer",
              background: selectedId === c.id ? T.raised : "transparent", border: "none",
              borderBottom: `1px solid ${T.border}`, color: c.isActive ? T.text : T.faint,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 600 }}>{c.label}{!c.isActive && " (inactive)"}</div>
            <div style={{ fontSize: 11, color: T.muted, fontFamily: mono, marginTop: 2 }}>
              {c.code} · {c.subtypes.length} subtype{c.subtypes.length === 1 ? "" : "s"}
            </div>
          </button>
        ))}
      </div>

      {selectedId ? (
        <CategoryDetail key={`${selectedId}-${refreshKey}`} categoryId={selectedId} onChanged={() => { reloadCategories(); setRefreshKey((k) => k + 1); }} />
      ) : (
        <Empty label="Select a category on the left to view and edit its subtypes and fields." />
      )}
    </div>
  );
}

function CategoryDetail({ categoryId, onChanged }: { categoryId: string; onChanged: () => void }) {
  const { data, error } = useFetch(() => adminFormsApi.wealthCategoryTree(categoryId), [categoryId]);
  const [category, setCategory] = useState<WealthFormCategoryTree | null>(null);
  const [expandedSubtype, setExpandedSubtype] = useState<string | null>(null);

  useEffect(() => { if (data) setCategory(data.category); }, [data]);

  function reload() {
    adminFormsApi.wealthCategoryTree(categoryId).then((res) => setCategory(res.category)).catch(() => {});
    onChanged();
  }

  if (error) return <ErrorMsg message={error} />;
  if (!category) return <Empty label="Loading…" />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <CategoryEditCard category={category} onSaved={reload} />

      <div>
        <b style={{ display: "block", color: "#fff", fontSize: 14, marginBottom: 8 }}>Subtypes</b>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {category.subtypes.map((st) => (
            <SubtypeCard
              key={st.id}
              subtype={st}
              expanded={expandedSubtype === st.id}
              onToggle={() => setExpandedSubtype(expandedSubtype === st.id ? null : st.id)}
              onSaved={reload}
            />
          ))}
          <NewSubtypeCard categoryId={category.id} onCreated={reload} />
        </div>
      </div>
    </div>
  );
}

function CategoryEditCard({ category, onSaved }: { category: WealthFormCategoryTree; onSaved: () => void }) {
  const [label, setLabel] = useState(category.label);
  const [description, setDescription] = useState(category.description ?? "");
  const [isActive, setIsActive] = useState(category.isActive);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLabel(category.label); setDescription(category.description ?? ""); setIsActive(category.isActive);
  }, [category]);

  const dirty = label !== category.label || description !== (category.description ?? "") || isActive !== category.isActive;

  async function save() {
    if (reason.trim().length < 3) { setError("Reason must be at least 3 characters."); return; }
    setBusy(true); setError(null);
    try {
      await withStepUp(() => adminFormsApi.updateWealthCategory(category.id, {
        label, description: description.trim() || null, isActive,
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
    <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 14, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
        <b style={{ color: "#fff", fontSize: 15 }}>Category</b>
        <span style={{ fontFamily: mono, fontSize: 11, color: T.faint }}>
          {category.code} · {category.wealthRecordType ?? "no record type"}
        </span>
      </div>
      <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label" style={{ ...fieldStyle, marginBottom: 8 }} />
      <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Description (optional)" style={{ ...fieldStyle, resize: "vertical", marginBottom: 8 }} />
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: T.text, cursor: "pointer", marginBottom: 8 }}>
        <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} /> Active (shown to users)
      </label>
      {dirty && (
        <>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (required, min 3 chars)…"
            style={{ ...fieldStyle, marginBottom: 8 }}
          />
          {error && <p style={{ color: T.coral, fontSize: 11.5, margin: "0 0 8px" }}>{error}</p>}
          <button onClick={save} disabled={busy} style={{ ...goldBtn, width: "100%", opacity: busy ? 0.7 : 1 }}>
            {busy ? "Saving…" : "Save category"}
          </button>
        </>
      )}
    </div>
  );
}

function SubtypeCard({ subtype, expanded, onToggle, onSaved }: {
  subtype: WealthFormSubtype; expanded: boolean; onToggle: () => void; onSaved: () => void;
}) {
  const [label, setLabel] = useState(subtype.label);
  const [description, setDescription] = useState(subtype.description ?? "");
  const [isActive, setIsActive] = useState(subtype.isActive);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLabel(subtype.label); setDescription(subtype.description ?? ""); setIsActive(subtype.isActive);
  }, [subtype]);

  const dirty = label !== subtype.label || description !== (subtype.description ?? "") || isActive !== subtype.isActive;

  async function save() {
    if (reason.trim().length < 3) { setError("Reason must be at least 3 characters."); return; }
    setBusy(true); setError(null);
    try {
      await withStepUp(() => adminFormsApi.updateWealthSubtype(subtype.id, {
        label, description: description.trim() || null, isActive,
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
    <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 14, overflow: "hidden" }}>
      <button
        onClick={onToggle}
        style={{
          display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%",
          padding: "11px 14px", background: "transparent", border: "none", cursor: "pointer",
          color: subtype.isActive ? T.text : T.faint,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600 }}>{subtype.label}{!subtype.isActive && " (inactive)"}</span>
        <span style={{ fontFamily: mono, fontSize: 11, color: T.muted }}>
          {subtype.code} · {subtype.fields?.length ?? 0} field{(subtype.fields?.length ?? 0) === 1 ? "" : "s"} {expanded ? "▲" : "▼"}
        </span>
      </button>

      {expanded && (
        <div style={{ padding: "0 14px 14px", borderTop: `1px solid ${T.border}` }}>
          <div style={{ marginTop: 12, marginBottom: 14 }}>
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label" style={{ ...fieldStyle, marginBottom: 8 }} />
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Description (optional)" style={{ ...fieldStyle, resize: "vertical", marginBottom: 8 }} />
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: T.text, cursor: "pointer", marginBottom: 8 }}>
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} /> Active (shown to users)
            </label>
            {dirty && (
              <>
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Reason (required, min 3 chars)…"
                  style={{ ...fieldStyle, marginBottom: 8 }}
                />
                {error && <p style={{ color: T.coral, fontSize: 11.5, margin: "0 0 8px" }}>{error}</p>}
                <button onClick={save} disabled={busy} style={{ ...goldBtn, opacity: busy ? 0.7 : 1 }}>
                  {busy ? "Saving…" : "Save subtype"}
                </button>
              </>
            )}
          </div>

          <b style={{ display: "block", color: "#fff", fontSize: 12.5, marginBottom: 8 }}>Fields</b>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {(subtype.fields ?? []).map((f) => (
              <FieldRow key={f.id} field={f} onSaved={onSaved} />
            ))}
            <NewFieldRow subtypeId={subtype.id} onCreated={onSaved} />
          </div>
        </div>
      )}
    </div>
  );
}

const INPUT_TYPES = ["text", "number", "date", "select", "textarea", "checkbox", "currency", "file"];

function FieldRow({ field, onSaved }: { field: WealthFormField; onSaved: () => void }) {
  const [label, setLabel] = useState(field.label);
  const [inputType, setInputType] = useState(field.inputType);
  const [required, setRequired] = useState(field.required);
  const [isActive, setIsActive] = useState(field.isActive);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setLabel(field.label); setInputType(field.inputType); setRequired(field.required); setIsActive(field.isActive);
  }, [field]);

  const dirty = label !== field.label || inputType !== field.inputType || required !== field.required || isActive !== field.isActive;

  async function save() {
    if (reason.trim().length < 3) { setError("Reason must be at least 3 characters."); return; }
    setBusy(true); setError(null);
    try {
      await withStepUp(() => adminFormsApi.updateWealthField(field.id, { label, inputType, required, isActive }, reason));
      setReason("");
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ background: T.raised, border: `1px solid ${T.border}`, borderRadius: 9, padding: "9px 11px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, cursor: "pointer" }} onClick={() => setOpen(!open)}>
        <span style={{ fontSize: 12.5, color: isActive ? T.text : T.faint }}>
          {field.label}{!isActive && " (inactive)"}{field.required && <span style={{ color: T.coral }}> *</span>}
        </span>
        <span style={{ fontFamily: mono, fontSize: 10.5, color: T.muted }}>{field.fieldId} · {field.inputType} {open ? "▲" : "▼"}</span>
      </div>
      {open && (
        <div style={{ marginTop: 10 }}>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label" style={{ ...fieldStyle, marginBottom: 6 }} />
          <select value={inputType} onChange={(e) => setInputType(e.target.value)} style={{ ...fieldStyle, marginBottom: 6 }}>
            {INPUT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <div style={{ display: "flex", gap: 14, marginBottom: 6 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: T.text, cursor: "pointer" }}>
              <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} /> Required
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: T.text, cursor: "pointer" }}>
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} /> Active
            </label>
          </div>
          {dirty && (
            <>
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason (required, min 3 chars)…"
                style={{ ...fieldStyle, marginBottom: 6 }}
              />
              {error && <p style={{ color: T.coral, fontSize: 11, margin: "0 0 6px" }}>{error}</p>}
              <button onClick={save} disabled={busy} style={{ ...goldBtn, opacity: busy ? 0.7 : 1 }}>
                {busy ? "Saving…" : "Save field"}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function NewSubtypeCard({ categoryId, onCreated }: { categoryId: string; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    if (!label.trim()) { setError("Label is required."); return; }
    if (reason.trim().length < 3) { setError("Reason must be at least 3 characters."); return; }
    setBusy(true); setError(null);
    try {
      await withStepUp(() => adminFormsApi.createWealthSubtype(categoryId, { label: label.trim() }, reason));
      setLabel(""); setReason(""); setOpen(false);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={{ ...ghostBtn, alignSelf: "flex-start" }}>+ New subtype</button>
    );
  }

  return (
    <div style={{ background: T.panel, border: `1px dashed ${T.border}`, borderRadius: 14, padding: 14 }}>
      <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Subtype label (e.g. Mutual fund)" style={{ ...fieldStyle, marginBottom: 8 }} />
      <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (required, min 3 chars)…" style={{ ...fieldStyle, marginBottom: 8 }} />
      {error && <p style={{ color: T.coral, fontSize: 11.5, margin: "0 0 8px" }}>{error}</p>}
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={create} disabled={busy} style={{ ...goldBtn, opacity: busy ? 0.7 : 1 }}>{busy ? "Creating…" : "Create subtype"}</button>
        <button onClick={() => { setOpen(false); setError(null); }} style={ghostBtn}>Cancel</button>
      </div>
    </div>
  );
}

function NewFieldRow({ subtypeId, onCreated }: { subtypeId: string; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [fieldId, setFieldId] = useState("");
  const [label, setLabel] = useState("");
  const [inputType, setInputType] = useState("text");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    if (!/^[a-zA-Z][a-zA-Z0-9]*$/.test(fieldId.trim())) { setError("Field ID must start with a letter and contain only letters/numbers."); return; }
    if (!label.trim()) { setError("Label is required."); return; }
    if (reason.trim().length < 3) { setError("Reason must be at least 3 characters."); return; }
    setBusy(true); setError(null);
    try {
      await withStepUp(() => adminFormsApi.createWealthField(subtypeId, { fieldId: fieldId.trim(), label: label.trim(), inputType }, reason));
      setFieldId(""); setLabel(""); setInputType("text"); setReason(""); setOpen(false);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return <button onClick={() => setOpen(true)} style={{ ...ghostBtn, alignSelf: "flex-start" }}>+ New field</button>;
  }

  return (
    <div style={{ background: T.raised, border: `1px dashed ${T.border}`, borderRadius: 9, padding: 11 }}>
      <input value={fieldId} onChange={(e) => setFieldId(e.target.value)} placeholder="fieldId (camelCase, e.g. purchaseDate)" style={{ ...fieldStyle, marginBottom: 6, fontFamily: mono }} />
      <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label" style={{ ...fieldStyle, marginBottom: 6 }} />
      <select value={inputType} onChange={(e) => setInputType(e.target.value)} style={{ ...fieldStyle, marginBottom: 6 }}>
        {INPUT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
      </select>
      <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (required, min 3 chars)…" style={{ ...fieldStyle, marginBottom: 6 }} />
      {error && <p style={{ color: T.coral, fontSize: 11, margin: "0 0 6px" }}>{error}</p>}
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={create} disabled={busy} style={{ ...goldBtn, opacity: busy ? 0.7 : 1 }}>{busy ? "Creating…" : "Create field"}</button>
        <button onClick={() => { setOpen(false); setError(null); }} style={ghostBtn}>Cancel</button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Document-type registry (read-only)
// ---------------------------------------------------------------------------

function DocumentTypeRegistry() {
  const { data, error } = useFetch(() => adminFormsApi.documentTypes(), []);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<DocumentTypeDefinition | null>(null);

  if (error) return <ErrorMsg message={error} />;
  if (!data) return <Empty label="Loading…" />;

  const filtered = data.items.filter((d) =>
    !search.trim() ||
    d.displayName.toLowerCase().includes(search.toLowerCase()) ||
    d.normalizedType.toLowerCase().includes(search.toLowerCase()) ||
    d.category.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div>
      <p style={{ color: T.faint, fontSize: 11.5, margin: "0 0 12px" }}>
        Hardcoded in <span style={{ fontFamily: mono }}>documentDefinitions.registry.ts</span> — not DB-backed.
        The design doc itself phases an editable registry as a later, optional step, so this is a browser only.
      </p>
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name, type or category…"
        style={{ ...fieldStyle, maxWidth: 360, marginBottom: 12 }}
      />
      <div style={{ display: "grid", gridTemplateColumns: "320px minmax(0,1fr)", gap: 14, alignItems: "start" }}>
        <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 14, overflow: "auto", maxHeight: 560 }}>
          {filtered.map((d) => (
            <button
              key={d.normalizedType}
              onClick={() => setSelected(d)}
              style={{
                display: "block", width: "100%", textAlign: "left", padding: "9px 14px", cursor: "pointer",
                background: selected?.normalizedType === d.normalizedType ? T.raised : "transparent",
                border: "none", borderBottom: `1px solid ${T.border}`, color: T.text,
              }}
            >
              <div style={{ fontSize: 12.5, fontWeight: 600 }}>{d.displayName}</div>
              <div style={{ fontSize: 10.5, color: T.muted, fontFamily: mono, marginTop: 1 }}>{d.normalizedType} · {d.category}</div>
            </button>
          ))}
          {filtered.length === 0 && <div style={{ padding: 14, color: T.muted, fontSize: 12.5 }}>No matches.</div>}
        </div>

        {selected ? (
          <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 14, padding: 16 }}>
            <b style={{ display: "block", color: "#fff", fontSize: 15, marginBottom: 2 }}>{selected.displayName}</b>
            <span style={{ fontFamily: mono, fontSize: 11, color: T.faint }}>{selected.normalizedType} · {selected.category}</span>

            <div style={{ marginTop: 14 }}>
              <DefRow label="Unique identifier field" value={selected.uniqueIdentifierField} mono />
              <DefList label="Required fields" items={selected.requiredFields} color={T.coral} />
              <DefList label="Optional fields" items={selected.optionalFields} color={T.muted} />
              <DefList label="Readiness capabilities" items={selected.supportedReadinessCapabilities} color={T.mint} />
              {Object.keys(selected.validationRules).length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 10.5, letterSpacing: 0.6, color: T.muted, textTransform: "uppercase", marginBottom: 6 }}>Validation rules</div>
                  {Object.entries(selected.validationRules).map(([key, rule]) => (
                    <div key={key} style={{ fontFamily: mono, fontSize: 11.5, color: T.text, marginBottom: 3 }}>
                      <span style={{ color: T.muted }}>{key}:</span> {rule ?? "—"}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <Empty label="Select a document type on the left to view its field requirements and validation rules." />
        )}
      </div>
    </div>
  );
}

function DefRow({ label, value, mono: useMono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 10.5, letterSpacing: 0.6, color: T.muted, textTransform: "uppercase", marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 12.5, color: T.text, fontFamily: useMono ? mono : undefined }}>{value}</div>
    </div>
  );
}
function DefList({ label, items, color }: { label: string; items: string[]; color: string }) {
  if (items.length === 0) return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 10.5, letterSpacing: 0.6, color: T.muted, textTransform: "uppercase", marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 12, color: T.faint }}>None</div>
    </div>
  );
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 10.5, letterSpacing: 0.6, color: T.muted, textTransform: "uppercase", marginBottom: 5 }}>{label}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {items.map((item) => (
          <span key={item} style={{ fontFamily: mono, fontSize: 11, padding: "3px 9px", borderRadius: 999, background: "rgba(255,255,255,.04)", border: `1px solid ${T.border}`, color }}>{item}</span>
        ))}
      </div>
    </div>
  );
}
