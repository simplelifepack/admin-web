// Mirrors NAV/MODULES in readiness-admin-console.html exactly — keep in sync
// by hand (no generator yet). `built: true` means a real route exists; the
// rest render the Stub page pointing at TRACKER.md.
export type NavItem = { id: string; label: string; built: boolean };
export type NavGroup = { label: string; items: NavItem[] };

export const NAV: NavGroup[] = [
  {
    label: "Operate",
    items: [
      { id: "overview", label: "Overview", built: true },
      { id: "users", label: "Users & accounts", built: true },
      { id: "usage", label: "Usage & plans", built: false },
      { id: "pipelines", label: "Pipelines", built: true },
      { id: "trust", label: "Trust & sharing", built: true },
      { id: "feedback", label: "Feedback & support", built: true },
    ],
  },
  {
    label: "Content",
    items: [
      { id: "catalogue", label: "Catalogue", built: true },
      { id: "forms", label: "Forms & types", built: true },
    ],
  },
  { label: "Finance", items: [{ id: "billing", label: "Billing & revenue", built: true }] },
  {
    label: "Platform",
    items: [
      { id: "ai", label: "AI operations & prompts", built: true },
      { id: "integrations", label: "Integrations", built: true },
      { id: "security", label: "Security & keys", built: true },
      { id: "comms", label: "Comms & system", built: true },
    ],
  },
  {
    label: "Govern",
    items: [
      { id: "audit", label: "Audit log", built: true },
      { id: "admins", label: "Admins & roles", built: true },
    ],
  },
];

export const ALL_ITEMS = NAV.flatMap((g) => g.items);
