import { startAuthentication } from "@simplewebauthn/browser";

import { adminApi } from "@/lib/api";

/** Runs `fn`; if it fails because the session's step-up window lapsed
 * (`requireStepUp` on the backend, decision D2), prompts for a fresh passkey
 * verification and retries `fn` once. Every privileged write capability in
 * the RBAC matrix resolves to "step_up" or "approval" for at least one role
 * (adminRbac.ts), and `requireStepUp` treats both the same today — so any
 * write action can hit this, not just the ones a specific role sees as
 * step_up. Callers don't need to know which grant their own role has. */
export async function withStepUp<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    const code = err && typeof err === "object" && "code" in err ? (err as { code?: string }).code : undefined;
    if (code !== "STEP_UP_REQUIRED") throw err;
    const options = await adminApi.stepUpOptions();
    const response = await startAuthentication({ optionsJSON: options });
    await adminApi.stepUpVerify(response);
    return fn();
  }
}
