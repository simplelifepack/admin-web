import { useEffect, useState } from "react";

import { T, mono } from "@/constants/theme";
import { adminAIApi, type AITaskDetail, type AITaskListItem, type AITestResult, type PromptConfig } from "@/lib/api";
import { relativeAge } from "@/lib/relativeTime";
import { useFetch } from "@/lib/useFetch";
import { withStepUp } from "@/lib/stepUp";

const TASK_LABEL: Record<string, string> = {
  document_classification: "Document classification",
  health_extraction: "Health extraction",
  package_intent: "Package intent & generation",
  research_refresh: "Research package refresh",
};

const fieldStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", background: "#171E2E", border: `1px solid ${T.border}`, borderRadius: 7,
  padding: "7px 9px", fontSize: 12.5, color: T.text,
};
const ghostBtn: React.CSSProperties = {
  background: "transparent", border: `1px solid ${T.border}`, color: T.text, borderRadius: 8,
  padding: "7px 13px", fontSize: 12, fontWeight: 600, cursor: "pointer",
};
const goldBtn: React.CSSProperties = {
  background: T.gold, border: "none", color: T.inkOnGold, borderRadius: 8,
  padding: "7px 13px", fontSize: 12, fontWeight: 700, cursor: "pointer",
};

function ErrorMsg({ message }: { message: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 16, background: "rgba(232,115,106,.08)", border: `1px solid ${T.coral}55`, borderRadius: 14, marginBottom: 12 }}>
      <span style={{ color: T.coral }}>⚠</span>
      <span style={{ fontSize: 13, color: T.text }}>{message}</span>
    </div>
  );
}

export default function AIOperations() {
  const { data, error } = useFetch(() => adminAIApi.listTasks(), []);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);

  return (
    <div>
      <h1 style={{ fontSize: 26, fontWeight: 800, color: "#fff", margin: "0 0 6px" }}>AI operations &amp; prompts</h1>
      <p style={{ color: T.muted, fontSize: 14.5, margin: "0 0 16px" }}>
        Per-task model and prompt, with a version history and spend tracking. A task shows "not configured yet" until
        it runs for real at least once — nothing here is built with placeholder content.
      </p>

      {error && <ErrorMsg message={error} />}

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(360px,1.2fr)", gap: 14, alignItems: "start" }}>
        <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 14, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                {["Task", "Model", "Version", "Spend (mtd)"].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: "9px 12px", fontFamily: mono, fontSize: 10.5, letterSpacing: 0.6, color: T.muted, textTransform: "uppercase", borderBottom: `1px solid ${T.border}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(data?.tasks ?? []).map((t) => (
                <TaskRow key={t.taskKey} task={t} selected={t.taskKey === selectedKey} onSelect={() => setSelectedKey(t.taskKey)} />
              ))}
            </tbody>
          </table>
        </div>

        {selectedKey && (
          <TaskDetailPanel key={`${selectedKey}-${refreshNonce}`} taskKey={selectedKey} onChanged={() => setRefreshNonce((n) => n + 1)} />
        )}
      </div>
    </div>
  );
}

function TaskRow({ task, selected, onSelect }: { task: AITaskListItem; selected: boolean; onSelect: () => void }) {
  return (
    <tr onClick={onSelect} style={{ cursor: "pointer", background: selected ? T.raised : "transparent" }}>
      <td style={{ padding: "10px 12px", borderBottom: `1px solid ${T.border}` }}>
        <div style={{ color: "#fff", fontWeight: 600 }}>{TASK_LABEL[task.taskKey] ?? task.taskKey}</div>
        {!task.configured && <div style={{ color: T.faint, fontSize: 11 }}>not configured yet</div>}
      </td>
      <td style={{ padding: "10px 12px", borderBottom: `1px solid ${T.border}`, fontFamily: mono, fontSize: 12, color: T.text }}>{task.primaryModel ?? "—"}</td>
      <td style={{ padding: "10px 12px", borderBottom: `1px solid ${T.border}`, color: T.muted, fontFamily: mono, fontSize: 12 }}>v{task.version}</td>
      <td style={{ padding: "10px 12px", borderBottom: `1px solid ${T.border}` }}>
        <span style={{ fontFamily: mono, fontSize: 12, color: task.monthlyCapUsd && task.monthToDateUsd > task.monthlyCapUsd ? T.coral : T.text }}>
          ${task.monthToDateUsd.toFixed(4)}{task.monthlyCapUsd ? ` / $${task.monthlyCapUsd.toFixed(2)}` : ""}
        </span>
      </td>
    </tr>
  );
}

function TaskDetailPanel({ taskKey, onChanged }: { taskKey: string; onChanged: () => void }) {
  const [detail, setDetail] = useState<AITaskDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"edit" | "history" | "log">("edit");

  useEffect(() => {
    adminAIApi.getTask(taskKey).then(setDetail).catch((err) => setError(err instanceof Error ? err.message : "Failed to load task."));
  }, [taskKey]);

  if (error) return <ErrorMsg message={error} />;
  if (!detail) return null;

  return (
    <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 14, padding: 16 }}>
      <b style={{ display: "block", color: "#fff", fontSize: 15, marginBottom: 4 }}>{TASK_LABEL[taskKey] ?? taskKey}</b>
      <span style={{ fontFamily: mono, fontSize: 10.5, color: T.faint }}>{taskKey} · v{detail.config.version}</span>

      <div style={{ display: "flex", gap: 4, borderBottom: `1px solid ${T.border}`, margin: "12px 0" }}>
        {([["edit", "Model & prompt"], ["history", "Revisions"], ["log", "Request log"]] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            style={{
              background: "none", border: 0, borderBottom: `2px solid ${tab === id ? T.gold : "transparent"}`,
              color: tab === id ? "#fff" : T.muted, padding: "7px 10px", fontWeight: 600, fontSize: 12, cursor: "pointer", marginBottom: -1,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "edit" && <EditTab taskKey={taskKey} detail={detail} onChanged={() => { onChanged(); adminAIApi.getTask(taskKey).then(setDetail); }} />}
      {tab === "history" && <HistoryTab revisions={detail.revisions} />}
      {tab === "log" && <LogTab logs={detail.recentLogs} />}
    </div>
  );
}

function EditTab({ taskKey, detail, onChanged }: { taskKey: string; detail: AITaskDetail; onChanged: () => void }) {
  const [model, setModel] = useState(detail.config.primaryModel);
  const [fallbackModel, setFallbackModel] = useState(detail.config.fallbackModel ?? "");
  const [promptConfig, setPromptConfig] = useState<PromptConfig>(detail.config.promptConfig);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<AITestResult | null>(null);
  const [testing, setTesting] = useState(false);

  const [budgetInput, setBudgetInput] = useState(detail.budget ? String(detail.budget.monthlyCapUsd) : "");
  const [budgetReason, setBudgetReason] = useState("");
  const [budgetBusy, setBudgetBusy] = useState(false);
  const [budgetError, setBudgetError] = useState<string | null>(null);

  async function runTest() {
    setTesting(true); setError(null); setTestResult(null);
    try {
      setTestResult(await adminAIApi.test(taskKey, { primaryModel: model, promptConfig }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Test failed.");
    } finally {
      setTesting(false);
    }
  }

  async function publish() {
    if (reason.trim().length < 3) { setError("Reason must be at least 3 characters."); return; }
    setBusy(true); setError(null);
    try {
      await withStepUp(() => adminAIApi.publish(taskKey, { primaryModel: model, fallbackModel: fallbackModel || null, promptConfig, testResult: testResult ?? undefined }, reason));
      setReason(""); setTestResult(null);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Publish failed.");
    } finally {
      setBusy(false);
    }
  }

  async function saveBudget() {
    const cap = Number(budgetInput);
    if (!cap || cap <= 0) { setBudgetError("Enter a positive monthly cap."); return; }
    if (budgetReason.trim().length < 3) { setBudgetError("Reason must be at least 3 characters."); return; }
    setBudgetBusy(true); setBudgetError(null);
    try {
      await withStepUp(() => adminAIApi.setBudget(taskKey, cap, budgetReason));
      setBudgetReason("");
      onChanged();
    } catch (err) {
      setBudgetError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setBudgetBusy(false);
    }
  }

  return (
    <div>
      <Label text="Primary model" />
      <input value={model} onChange={(e) => setModel(e.target.value)} style={{ ...fieldStyle, marginBottom: 8, fontFamily: mono }} />
      <Label text="Fallback model (optional)" />
      <input value={fallbackModel} onChange={(e) => setFallbackModel(e.target.value)} placeholder="None" style={{ ...fieldStyle, marginBottom: 12, fontFamily: mono }} />

      <Label text="Prompt" />
      <PromptEditor promptConfig={promptConfig} onChange={setPromptConfig} />

      {taskKey === "package_intent" ? (
        <div style={{ marginTop: 10 }}>
          <button onClick={runTest} disabled={testing} style={{ ...ghostBtn, opacity: testing ? 0.7 : 1 }}>
            {testing ? "Testing…" : "Test before publish"}
          </button>
          {testResult && (
            <div style={{ marginTop: 8, padding: 10, border: `1px solid ${T.border}`, borderRadius: 9, background: "rgba(11,18,32,.5)" }}>
              {testResult.success ? (
                <>
                  <div style={{ color: T.mint, fontSize: 11.5, fontWeight: 700, marginBottom: 4 }}>✓ Test succeeded ({testResult.durationMs}ms)</div>
                  <pre style={{ margin: 0, fontSize: 11, color: T.text, whiteSpace: "pre-wrap", maxHeight: 200, overflow: "auto" }}>{JSON.stringify(testResult.output, null, 2)}</pre>
                </>
              ) : (
                <div style={{ color: T.coral, fontSize: 11.5 }}>✗ {testResult.error}</div>
              )}
            </div>
          )}
        </div>
      ) : (
        <p style={{ color: T.faint, fontSize: 10.5, margin: "8px 0 0" }}>
          Test-before-publish is only available for Package intent (text-only input) — this task publishes directly.
        </p>
      )}

      <div style={{ marginTop: 12 }}>
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for this change (required, min 3 chars)…" style={{ ...fieldStyle, marginBottom: 8 }} />
        {error && <p style={{ color: T.coral, fontSize: 11.5, margin: "0 0 8px" }}>{error}</p>}
        <button onClick={publish} disabled={busy} style={{ ...goldBtn, width: "100%", opacity: busy ? 0.7 : 1 }}>
          {busy ? "Publishing…" : "Publish"}
        </button>
        <p style={{ color: T.faint, fontSize: 10.5, margin: "8px 0 0" }}>Needs a fresh passkey verification (step-up). The previous version is saved as a revision.</p>
      </div>

      <Label text="Monthly budget" />
      <p style={{ color: T.faint, fontSize: 11, margin: "0 0 8px" }}>Alert-only — crossing this never blocks a live AI call, it just notifies.</p>
      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
        <input value={budgetInput} onChange={(e) => setBudgetInput(e.target.value)} placeholder="e.g. 50" inputMode="decimal" style={{ ...fieldStyle, flex: 1 }} />
        <span style={{ alignSelf: "center", color: T.muted, fontSize: 12 }}>USD / month</span>
      </div>
      <input value={budgetReason} onChange={(e) => setBudgetReason(e.target.value)} placeholder="Reason (required, min 3 chars)…" style={{ ...fieldStyle, marginBottom: 8 }} />
      {budgetError && <p style={{ color: T.coral, fontSize: 11.5, margin: "0 0 8px" }}>{budgetError}</p>}
      <button onClick={saveBudget} disabled={budgetBusy} style={{ ...ghostBtn, opacity: budgetBusy ? 0.7 : 1 }}>
        {budgetBusy ? "Saving…" : "Save budget"}
      </button>
    </div>
  );
}

function PromptEditor({ promptConfig, onChange }: { promptConfig: PromptConfig; onChange: (p: PromptConfig) => void }) {
  if (promptConfig.kind === "string") {
    return (
      <textarea
        value={promptConfig.text}
        onChange={(e) => onChange({ kind: "string", text: e.target.value })}
        rows={10}
        style={{ ...fieldStyle, resize: "vertical", fontFamily: mono, fontSize: 11.5, lineHeight: 1.5 }}
      />
    );
  }
  if (promptConfig.kind === "array") {
    return (
      <div>
        {promptConfig.items.map((item, i) => (
          <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
            <textarea
              value={item}
              onChange={(e) => {
                const items = [...promptConfig.items];
                items[i] = e.target.value;
                onChange({ kind: "array", items });
              }}
              rows={2}
              style={{ ...fieldStyle, resize: "vertical", fontSize: 11.5, flex: 1 }}
            />
            <button
              onClick={() => onChange({ kind: "array", items: promptConfig.items.filter((_, idx) => idx !== i) })}
              style={{ ...ghostBtn, padding: "4px 9px", color: T.coral, alignSelf: "flex-start" }}
            >
              ✕
            </button>
          </div>
        ))}
        <button onClick={() => onChange({ kind: "array", items: [...promptConfig.items, ""] })} style={ghostBtn}>+ Add line</button>
      </div>
    );
  }
  // kind === "multi"
  return (
    <div>
      {Object.entries(promptConfig.parts).map(([key, value]) => (
        <div key={key} style={{ marginBottom: 10 }}>
          <span style={{ display: "block", fontFamily: mono, fontSize: 10.5, color: T.faint, marginBottom: 4 }}>{key}</span>
          <textarea
            value={value}
            onChange={(e) => onChange({ kind: "multi", parts: { ...promptConfig.parts, [key]: e.target.value } })}
            rows={4}
            style={{ ...fieldStyle, resize: "vertical", fontSize: 11.5 }}
          />
        </div>
      ))}
      <p style={{ color: T.faint, fontSize: 10.5, margin: 0 }}>
        Some parts of this task's prompt aren't listed here — they're code-only, tightly coupled to validation logic
        elsewhere, and deliberately not admin-editable.
      </p>
    </div>
  );
}

function HistoryTab({ revisions }: { revisions: AITaskDetail["revisions"] }) {
  if (revisions.length === 0) return <p style={{ color: T.muted, fontSize: 12.5 }}>No published revisions yet — still on the auto-seeded default.</p>;
  return (
    <div>
      {revisions.map((r) => (
        <div key={r.id} style={{ padding: "9px 0", borderBottom: `1px solid ${T.border}`, fontSize: 12.5 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontFamily: mono, color: T.gold }}>v{r.version}</span>
            <span style={{ color: T.faint, fontSize: 10.5, fontFamily: mono }}>{new Date(r.createdAt).toLocaleString()}</span>
          </div>
          <div style={{ color: T.muted, fontSize: 11.5 }}>{r.publishedBy?.name ?? "unknown"} · {r.primaryModel}</div>
        </div>
      ))}
    </div>
  );
}

function LogTab({ logs }: { logs: AITaskDetail["recentLogs"] }) {
  if (logs.length === 0) return <p style={{ color: T.muted, fontSize: 12.5 }}>No requests logged yet.</p>;
  return (
    <div>
      {logs.map((l) => (
        <div key={l.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderBottom: `1px solid ${T.border}`, fontSize: 12 }}>
          <span>
            <span style={{ fontFamily: mono, fontSize: 10.5, fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: l.success ? "rgba(79,203,149,.14)" : "rgba(232,115,106,.14)", color: l.success ? T.mint : T.coral, marginRight: 8 }}>
              {l.success ? "ok" : (l.errorCode ?? "failed")}
            </span>
            <span style={{ color: T.muted, fontFamily: mono, fontSize: 11 }}>{l.costUsd ? `$${Number(l.costUsd).toFixed(6)}` : "—"}</span>
          </span>
          <span style={{ color: T.faint, fontSize: 10.5, fontFamily: mono }}>{relativeAge(l.createdAt)} ago</span>
        </div>
      ))}
    </div>
  );
}

function Label({ text }: { text: string }) {
  return <span style={{ display: "block", fontFamily: mono, fontSize: 10.5, letterSpacing: 1, color: T.faint, textTransform: "uppercase", margin: "0 0 6px" }}>{text}</span>;
}
