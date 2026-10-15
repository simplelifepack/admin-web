// Ported from readiness-admin-console.html's design-language section. Kept
// dark-only and hardcoded (not frontend-web's new light/dark CSS-variable
// system) — this is an internal ops tool, and the in-app dark tokens it's
// based on (navy/gold) are unchanged in the live product's `.dark` class.
export const T = {
  navy: "#0B1220",
  panel: "#131C2E",
  raised: "#1B2740",
  border: "#27324A",
  hover: "#202D46",
  menu: "#182235",
  gold: "#D9B86A",
  goldBright: "#ECCB82",
  mint: "#4FCB95",
  coral: "#E8736A",
  text: "#E6EBF5",
  muted: "#8A97AE",
  faint: "#5C6B80",
  white: "#FFFFFF",
  inkOnGold: "#10182A",
} as const;

export const mono = '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace';
export const sans = "Inter, system-ui, -apple-system, 'Segoe UI', sans-serif";
