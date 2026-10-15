export const API_URL = import.meta.env.VITE_ADMIN_API_URL || "http://localhost:4000";
const TOKEN_KEY = "readiness-admin-token";

export function getToken() {
  return sessionStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string) {
  sessionStorage.setItem(TOKEN_KEY, token);
}
export function clearToken() {
  sessionStorage.removeItem(TOKEN_KEY);
}

// The admin access token is deliberately short-lived (15m). A 401 mid-session
// almost always means it expired, not that this one request was special —
// handling that per-call left pages (see Pipelines) failing silently blank
// instead of bouncing back to sign-in. Fire a single event App.tsx listens
// for, so every page gets the same "session expired, please sign in again"
// behavior for free instead of each page needing its own 401 handling.
const SESSION_EXPIRED_EVENT = "admin:session-expired";
export function onSessionExpired(handler: () => void) {
  window.addEventListener(SESSION_EXPIRED_EVENT, handler);
  return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handler);
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (!res.ok) {
    let message = `Request failed (${res.status}).`;
    let code: string | undefined;
    try {
      const body = await res.json();
      if (typeof body?.message === "string") message = body.message;
      if (typeof body?.code === "string") code = body.code;
    } catch {
      // non-JSON error body — keep the generic message
    }
    if (res.status === 401 && token) {
      clearToken();
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    }
    throw Object.assign(new Error(message), { status: res.status, code });
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export type AdminMe = {
  admin: { id: string; email: string; name: string; role: string };
  session: { id: string; stepUpAt: string | null };
};

export const adminApi = {
  // Dev-only bypass (skips Google + passkey). 403s in production — see
  // backend/src/services/adminAuth.service.ts#devLogin.
  devLogin: (role: string) =>
    request<{ token: string; admin: AdminMe["admin"]; session: AdminMe["session"] }>(
      "/admin/v1/auth/dev-login",
      { method: "POST", body: JSON.stringify({ role }) },
    ),
  googleLogin: (credential: string) =>
    request<{ status: "passkey_enrollment_required" | "passkey_required"; pendingToken: string; admin: { name: string; email: string } }>(
      "/admin/v1/auth/google",
      { method: "POST", body: JSON.stringify({ credential }) },
    ),
  enrollOptions: (pendingToken: string) =>
    request<PublicKeyCredentialCreationOptionsJSON>("/admin/v1/auth/passkey/enroll/options", {
      method: "POST", body: JSON.stringify({ pendingToken }),
    }),
  enrollVerify: (pendingToken: string, response: unknown, deviceLabel?: string) =>
    request<{ token: string; admin: AdminMe["admin"]; session: AdminMe["session"] }>(
      "/admin/v1/auth/passkey/enroll/verify",
      { method: "POST", body: JSON.stringify({ pendingToken, response, deviceLabel }) },
    ),
  loginOptions: (pendingToken: string) =>
    request<PublicKeyCredentialRequestOptionsJSON>("/admin/v1/auth/passkey/login/options", {
      method: "POST", body: JSON.stringify({ pendingToken }),
    }),
  loginVerify: (pendingToken: string, response: unknown) =>
    request<{ token: string; admin: AdminMe["admin"]; session: AdminMe["session"] }>(
      "/admin/v1/auth/passkey/login/verify",
      { method: "POST", body: JSON.stringify({ pendingToken, response }) },
    ),
  me: () => request<AdminMe>("/admin/v1/auth/me"),
  logout: () => request<void>("/admin/v1/auth/logout", { method: "POST" }),
  stepUpOptions: () => request<PublicKeyCredentialRequestOptionsJSON>("/admin/v1/auth/step-up/options", { method: "POST" }),
  stepUpVerify: (response: unknown) =>
    request<{ stepUpAt: string }>("/admin/v1/auth/step-up/verify", { method: "POST", body: JSON.stringify({ response }) }),
  auditList: (limit = 50) => request<{ items: Array<Record<string, unknown>> }>(`/admin/v1/audit?limit=${limit}`),
  auditVerifyChain: () => request<{ intact: boolean; brokenAt: string | null; checkedCount: number }>("/admin/v1/audit/verify-chain", { method: "POST" }),
};

export type OverviewStats = {
  totalUsers: number;
  newUsersThisWeek: number;
  totalDocuments: number;
  pendingClassification: number;
  aiActionsThisMonth: number;
  period: string;
  generatedAt: string;
};

export type ActionItem = { label: string; count: number; oldestAt: string | null; navTo: string };
export type ActionGroup = { key: string; label: string; items: ActionItem[] };
export type ActionCenter = { groups: ActionGroup[]; totalCount: number; generatedAt: string };

export type UserListItem = {
  id: string; name: string; email: string; accountTier: "free" | "paid";
  createdAt: string; signInMethods: string[]; pendingDeletion: boolean; suspended: boolean;
};
export type UserListResponse = { items: UserListItem[]; pagination: { page: number; limit: number; total: number; hasNextPage: boolean } };
export type UserDetail = {
  user: {
    id: string; name: string; email: string; accountTier: "free" | "paid"; createdAt: string;
    signInMethods: string[]; deletionRequestedAt: string | null; scheduledDeletionAt: string | null;
    suspendedAt: string | null; suspendedReason: string | null;
    aiProcessingEnabled: boolean; country: string | null;
  };
  usage: {
    storage: { usedBytes: number; limitBytes: number | null; unlimited: boolean };
    aiUsage: { used: number | null; limit: number | null; remaining: number | null; unlimited: boolean; period: string };
    override: { storageLimitBytes: number | null; aiActionLimit: number | null; reason: string; expiresAt: string } | null;
  } | null;
  sealed: { documentCount: number; healthMemberCount: number; trustMemberCount: number };
};
export type ExportJob = {
  id: string; status: string; fileName: string | null; sizeBytes: number | null; errorMessage: string | null;
  requestedAt: string; preparedAt: string | null; expiresAt: string | null; downloadedAt: string | null;
};
export type SignInEventRow = { id: string; method: string; ip: string | null; userAgent: string | null; at: string };
export type UsageOverride = {
  id: string; userId: string; storageLimitBytes: number | null; aiActionLimit: number | null;
  reason: string; grantedByAdminId: string | null; expiresAt: string; createdAt: string; revokedAt: string | null;
};

export const adminUsersApi = {
  list: (params: { search?: string; tier?: "free" | "paid"; page?: number; limit?: number } = {}) => {
    const qs = new URLSearchParams();
    if (params.search) qs.set("search", params.search);
    if (params.tier) qs.set("tier", params.tier);
    qs.set("page", String(params.page ?? 1));
    qs.set("limit", String(params.limit ?? 25));
    return request<UserListResponse>(`/admin/v1/users?${qs}`);
  },
  get: (id: string) => request<UserDetail>(`/admin/v1/users/${id}`),
  changeTier: (id: string, tier: "free" | "paid", reason: string) =>
    request<{ user: unknown }>(`/admin/v1/users/${id}/tier`, { method: "POST", body: JSON.stringify({ tier, reason }) }),
  suspend: (id: string, reason: string) =>
    request<{ user: unknown }>(`/admin/v1/users/${id}/suspend`, { method: "POST", body: JSON.stringify({ reason }) }),
  unsuspend: (id: string, reason: string) =>
    request<{ user: unknown }>(`/admin/v1/users/${id}/unsuspend`, { method: "POST", body: JSON.stringify({ reason }) }),
  forceSignOut: (id: string, reason?: string) =>
    request<{ user: unknown }>(`/admin/v1/users/${id}/signout`, { method: "POST", body: JSON.stringify({ reason }) }),
  cancelDeletion: (id: string, reason: string) =>
    request<{ user: { id: string; scheduledDeletionAt: string | null } }>(`/admin/v1/users/${id}/deletion/cancel`, {
      method: "POST", body: JSON.stringify({ reason }),
    }),
  exportJobs: (id: string) => request<{ jobs: ExportJob[] }>(`/admin/v1/users/${id}/export-jobs`),
  signInEvents: (id: string) => request<{ events: SignInEventRow[] }>(`/admin/v1/users/${id}/sign-in-events`),
  trustMembers: (id: string) => request<{ members: TrustMemberRow[] }>(`/admin/v1/users/${id}/trust-members`),
  revokeTrustMember: (id: string, memberId: string, reason: string) =>
    request<{ member: { id: string; status: string; revokedAt: string | null } }>(`/admin/v1/users/${id}/trust-members/${memberId}/revoke`, {
      method: "POST", body: JSON.stringify({ reason }),
    }),
  listOverrides: (id: string) => request<{ overrides: UsageOverride[] }>(`/admin/v1/users/${id}/usage-overrides`),
  grantOverride: (id: string, input: { storageLimitMb?: number; aiActionLimit?: number; expiresInDays: number; reason: string }) =>
    request<{ override: UsageOverride }>(`/admin/v1/users/${id}/usage-override`, { method: "POST", body: JSON.stringify(input) }),
  revokeOverride: (id: string, reason: string) =>
    request<{ override: UsageOverride }>(`/admin/v1/users/${id}/usage-override/revoke`, { method: "POST", body: JSON.stringify({ reason }) }),
};

export const adminStatsApi = {
  overview: () => request<OverviewStats>("/admin/v1/overview/stats"),
  actionCenter: () => request<ActionCenter>("/admin/v1/overview/action-center"),
};

export type StuckDocument = { id: string; ownerProfileId: string | null; documentType: string; mimeType: string; size: number; classificationStatus: string; createdAt: string };
export type FailedHealthExtraction = { id: string; userId: string; memberId: string | null; type: string; processingStatus: string; processingError: string; createdAt: string };
export type StorageCleanupItem = { storageKey: string; ownerUserId: string; sizeBytes: number; createdAt: string };
export type ExpiringUpload = { id: string; ownerProfileId: string; detectedMimeType: string; size: number; status: string; expiresAt: string; createdAt: string };

export const adminPipelinesApi = {
  stuckClassification: (limit = 50) => request<{ total: number; items: StuckDocument[] }>(`/admin/v1/pipelines/stuck-classification?limit=${limit}`),
  failedHealthExtractions: (limit = 50) => request<{ total: number; items: FailedHealthExtraction[] }>(`/admin/v1/pipelines/failed-health-extractions?limit=${limit}`),
  storageCleanup: (limit = 50) => request<{ total: number; items: StorageCleanupItem[] }>(`/admin/v1/pipelines/storage-cleanup?limit=${limit}`),
  expiringUploads: (limit = 50) => request<{ total: number; items: ExpiringUpload[] }>(`/admin/v1/pipelines/expiring-uploads?limit=${limit}`),
};

export type SecurityPosture = {
  activeKey: { keyId: string; keyVersion: number; algorithm: string } | null;
  keyDistribution: { keyId: string | null; keyVersion: number | null; count: number; isActive: boolean }[];
  encryptionType: { clientEnvelope: number; legacyServerEncrypted: number };
  totalDocuments: number;
  posture: { ok: boolean; label: string }[];
};

export const adminSecurityApi = {
  get: () => request<SecurityPosture>("/admin/v1/security"),
};

export type JobType = "key_rewrap" | "storage_audit" | "package_source_backfill";
export type JobStatus = "running" | "paused" | "completed" | "failed";
export type Job = {
  id: string; type: JobType; status: JobStatus;
  cursor: string | null; totalCount: number | null;
  processedCount: number; updatedCount: number; failedCount: number;
  lastError: string | null; params: unknown; resultSummary: unknown;
  startedByAdminId: string | null; approvedByAdminId: string | null;
  createdAt: string; updatedAt: string; completedAt: string | null;
};
export type RewrapPreview = { activeKeyId: string; activeKeyVersion: number; documentsToRewrap: number };
export type StorageAuditPreview = { totalCount: number };
export type StorageAuditFinding = { documentId: string; label: string; storageKey: string | null; error?: string };
export type BackfillPreview = { totalCount: number };
export type BackfillOutcome = { packId: string; slug: string; status: "updated" | "skipped" | "failed"; detail?: string };

export const adminJobsApi = {
  rewrapPreview: () => request<RewrapPreview>("/admin/v1/jobs/rewrap/preview", { method: "POST" }),
  rewrapCurrent: () => request<{ job: Job | null }>("/admin/v1/jobs/rewrap/current"),
  rewrapStart: () => request<{ job: Job }>("/admin/v1/jobs/rewrap/start", { method: "POST" }),
  storageAuditPreview: () => request<StorageAuditPreview>("/admin/v1/jobs/storage-audit/preview", { method: "POST" }),
  storageAuditCurrent: () => request<{ job: Job | null }>("/admin/v1/jobs/storage-audit/current"),
  storageAuditStart: () => request<{ job: Job }>("/admin/v1/jobs/storage-audit/start", { method: "POST" }),
  backfillPreview: () => request<BackfillPreview>("/admin/v1/jobs/backfill/preview", { method: "POST" }),
  backfillCurrent: () => request<{ job: Job | null }>("/admin/v1/jobs/backfill/current"),
  backfillStart: () => request<{ job: Job }>("/admin/v1/jobs/backfill/start", { method: "POST" }),
  tick: (id: string) => request<{ job: Job }>(`/admin/v1/jobs/${id}/tick`, { method: "POST" }),
  pause: (id: string) => request<{ job: Job }>(`/admin/v1/jobs/${id}/pause`, { method: "POST" }),
  resume: (id: string) => request<{ job: Job }>(`/admin/v1/jobs/${id}/resume`, { method: "POST" }),
};

export type PackSummary = {
  id: string; slug: string; title: string; category: string; createdBy: string;
  verificationStatus: string; lastCheckedAt: string | null; createdAt: string; updatedAt: string;
};
export type PackRequirement = {
  id: string; title: string; description: string | null; required: boolean;
  group: string | null; documentType: string | null; owner: string | null; acceptedDocumentTypes: string[];
};
export type PackDetail = {
  id: string; slug: string; title: string; subtitle: string | null; category: string; description: string | null;
  sourceType: string | null; sourceName: string | null; sourceTitle: string | null; sourceUrl: string | null;
  lastCheckedAt: string | null; verificationSources: unknown; lastVerifiedAt: string | null; verificationStatus: string;
  createdBy: string; version: number; createdAt: string; updatedAt: string;
  requirements: PackRequirement[];
};

export type PackEditInput = {
  title?: string; category?: string; description?: string; sourceType?: string; verificationStatus?: string;
  subtitle?: string | null; sourceName?: string | null; sourceTitle?: string | null; sourceUrl?: string | null;
};
export type PackRevision = {
  id: string; packId: string; version: number; snapshot: unknown;
  editedBy: string | null; reason: string | null; createdAt: string;
};

export const adminCatalogueApi = {
  reviewQueue: (limit = 50) => request<{ total: number; items: PackSummary[] }>(`/admin/v1/catalogue/review-queue?limit=${limit}`),
  staleSources: (limit = 50) => request<{ total: number; items: PackSummary[] }>(`/admin/v1/catalogue/stale-sources?limit=${limit}`),
  detail: (slug: string) => request<{ pack: PackDetail }>(`/admin/v1/catalogue/${encodeURIComponent(slug)}`),
  edit: (slug: string, updates: PackEditInput, reason: string) =>
    request<{ pack: PackDetail }>(`/admin/v1/catalogue/${encodeURIComponent(slug)}`, {
      method: "PATCH", body: JSON.stringify({ ...updates, reason }),
    }),
  revisions: (slug: string) => request<{ revisions: PackRevision[] }>(`/admin/v1/catalogue/${encodeURIComponent(slug)}/revisions`),
  rollback: (slug: string, revisionId: string, reason: string) =>
    request<{ pack: PackDetail }>(`/admin/v1/catalogue/${encodeURIComponent(slug)}/rollback/${encodeURIComponent(revisionId)}`, {
      method: "POST", body: JSON.stringify({ reason }),
    }),
  merge: (slug: string, duplicateSlug: string, reason: string) =>
    request<{ result: { primaryPackId: string; duplicatePackId: string; requirementsCopied: number; requirementsAlreadyPresent: number } }>(
      `/admin/v1/catalogue/${encodeURIComponent(slug)}/merge`, { method: "POST", body: JSON.stringify({ duplicateSlug, reason }) },
    ),
  importPreview: (csv: string) => request<ImportPreview>("/admin/v1/catalogue/import/preview", { method: "POST", body: JSON.stringify({ csv }) }),
  import: (csv: string, reason: string) => request<ImportResult>("/admin/v1/catalogue/import", { method: "POST", body: JSON.stringify({ csv, reason }) }),
};

export type ImportPreviewRow = { rowNumber: number; slug: string; title: string; errors: string[] };
export type ImportPreview = { rows: ImportPreviewRow[]; summary: { valid: number; invalid: number }; errors: string[] };
export type ImportResultRow = { rowNumber: number; status: "created" | "failed"; errors: string[] };
export type ImportResult = { results: ImportResultRow[]; successCount: number; failedCount: number };

export type AuditLogEntry = {
  id: string; at: string; adminId: string | null; actorEmail: string; action: string;
  targetType: string | null; targetId: string | null; reason: string | null;
  diff: unknown; prevHash: string | null; hash: string;
};
export type ChainVerification = { intact: boolean; brokenAt: string | null; checkedCount: number };
export type ChainVerifyJob = {
  id: string; status: "running" | "paused" | "completed" | "failed";
  totalCount: number | null; processedCount: number; lastError: string | null;
  resultSummary: ChainVerification | null; createdAt: string; completedAt: string | null;
};

export type RetentionStatus = {
  floorDays: number;
  adminAuditLog: { count: number; oldestAt: string | null; oldestAgeDays: number | null };
  signInEvent: { count: number; oldestAt: string | null; oldestAgeDays: number | null };
  structuralGuarantee: string;
};

export const adminAuditApi = {
  list: (opts: { limit?: number; action?: string } = {}) => {
    const params = new URLSearchParams();
    params.set("limit", String(opts.limit ?? 100));
    if (opts.action) params.set("action", opts.action);
    return request<{ items: AuditLogEntry[] }>(`/admin/v1/audit?${params.toString()}`);
  },
  verifyChain: () => request<ChainVerification>("/admin/v1/audit/verify-chain", { method: "POST" }),
  retention: () => request<RetentionStatus>("/admin/v1/audit/retention"),
  chainVerifyHistory: () => request<{ jobs: ChainVerifyJob[] }>("/admin/v1/audit/chain-verify/history"),
  runChainVerify: () => request<{ job: ChainVerifyJob }>("/admin/v1/audit/chain-verify/run", { method: "POST" }),
};

export type AlertChannel = {
  id: string; type: "email" | "webhook"; name: string; target: string; enabled: boolean; createdAt: string; updatedAt: string;
};
export type AlertRule = {
  id: string; name: string; sourceModule: string; condition: "job_failed";
  jobType: JobType | null; channelId: string; channel: AlertChannel;
  cooldownMinutes: number; enabled: boolean; lastTriggeredAt: string | null; createdAt: string; updatedAt: string;
};

export const adminAlertsApi = {
  listChannels: () => request<{ channels: AlertChannel[] }>("/admin/v1/alerts/channels"),
  createChannel: (input: { type: "email" | "webhook"; name: string; target: string }) =>
    request<{ channel: AlertChannel }>("/admin/v1/alerts/channels", { method: "POST", body: JSON.stringify(input) }),
  setChannelEnabled: (id: string, enabled: boolean) =>
    request<{ channel: AlertChannel }>(`/admin/v1/alerts/channels/${id}/${enabled ? "enable" : "disable"}`, { method: "POST" }),
  deleteChannel: (id: string) => request<{ ok: true }>(`/admin/v1/alerts/channels/${id}`, { method: "DELETE" }),
  listRules: () => request<{ rules: AlertRule[] }>("/admin/v1/alerts/rules"),
  createRule: (input: { name: string; sourceModule: string; condition: "job_failed"; jobType?: JobType | null; channelId: string; cooldownMinutes?: number }) =>
    request<{ rule: AlertRule }>("/admin/v1/alerts/rules", { method: "POST", body: JSON.stringify(input) }),
  setRuleEnabled: (id: string, enabled: boolean) =>
    request<{ rule: AlertRule }>(`/admin/v1/alerts/rules/${id}/${enabled ? "enable" : "disable"}`, { method: "POST" }),
  deleteRule: (id: string) => request<{ ok: true }>(`/admin/v1/alerts/rules/${id}`, { method: "DELETE" }),
};

export type EmailLogEntry = {
  id: string; template: string; recipient: string; recipientId: string | null;
  status: "sent" | "failed"; errorCode: string | null; createdAt: string;
};
export type EmailPreview = { subject: string; html: string; text: string };

export const adminCommsApi = {
  emailLog: (opts: { limit?: number; template?: string; status?: "sent" | "failed" } = {}) => {
    const qs = new URLSearchParams();
    qs.set("limit", String(opts.limit ?? 50));
    if (opts.template) qs.set("template", opts.template);
    if (opts.status) qs.set("status", opts.status);
    return request<{ total: number; sentCount: number; failedCount: number; items: EmailLogEntry[] }>(`/admin/v1/comms/email-log?${qs}`);
  },
  templates: () => request<{ templates: string[] }>("/admin/v1/comms/templates"),
  preview: (name: string) => request<EmailPreview>(`/admin/v1/comms/templates/${encodeURIComponent(name)}/preview`),
};

export type AnnouncementValue = { text: string; severity: "info" | "warning" | "critical"; active: boolean };
export type FeatureFlagsValue = Record<string, boolean>;
export type MinSupportedVersionValue = { ios: string | null; android: string | null; web: string | null };
export type MaintenanceModeValue = { active: boolean; message: string };
export type SystemSetting = { key: string; value: unknown; updatedByAdminId: string | null; updatedAt: string; createdAt: string };

export const adminSystemSettingsApi = {
  list: () => request<{ settings: SystemSetting[]; knownKeys: string[] }>("/admin/v1/system-settings"),
  set: (key: string, value: unknown, reason: string) =>
    request<{ setting: SystemSetting }>(`/admin/v1/system-settings/${encodeURIComponent(key)}`, {
      method: "PUT", body: JSON.stringify({ value, reason }),
    }),
};

// Document-type registry: a hardcoded code constant (60+ entries), not
// DB-backed — see backend/src/routes/admin/forms.routes.ts. View-only,
// matching the design doc's own phasing.
export type DocumentTypeDefinition = {
  normalizedType: string; displayName: string; category: string; uniqueIdentifierField: string;
  requiredFields: string[]; optionalFields: string[]; validationRules: Record<string, string | null>;
  supportedReadinessCapabilities: string[];
};

// Wealth form catalogue: DB-backed (ReadinessFormCategory/Subtype/Field),
// self-seeded on first customer read from a hardcoded fallback — editing
// these rows genuinely affects live wealth-record form rendering once seeded.
export type WealthFormField = {
  id: string; subtypeId: string; fieldId: string; label: string; inputType: string; required: boolean;
  placeholder: string | null; defaultValue: unknown; options: unknown; validation: unknown;
  group: string | null; visibility: unknown; sortOrder: number; isActive: boolean;
  createdAt: string; updatedAt: string;
};
export type WealthFormSubtype = {
  id: string; categoryId: string; code: string; label: string; description: string | null;
  sortOrder: number; isActive: boolean; createdAt: string; updatedAt: string;
  fields?: WealthFormField[];
};
export type WealthFormCategory = {
  id: string; module: string; code: string; label: string; description: string | null;
  sortOrder: number; isActive: boolean; wealthRecordType: string | null; createdAt: string; updatedAt: string;
  subtypes: Array<{ id: string; isActive: boolean; _count: { fields: number } }>;
};
export type WealthFormCategoryTree = Omit<WealthFormCategory, "subtypes"> & { subtypes: WealthFormSubtype[] };

export const adminFormsApi = {
  documentTypes: () => request<{ items: DocumentTypeDefinition[] }>("/admin/v1/forms/document-types"),
  documentType: (type: string) => request<{ item: DocumentTypeDefinition }>(`/admin/v1/forms/document-types/${encodeURIComponent(type)}`),

  wealthCategories: () => request<{ categories: WealthFormCategory[] }>("/admin/v1/forms/wealth/categories"),
  wealthCategoryTree: (id: string) => request<{ category: WealthFormCategoryTree }>(`/admin/v1/forms/wealth/categories/${encodeURIComponent(id)}`),
  updateWealthCategory: (id: string, updates: { label?: string; description?: string | null; sortOrder?: number; isActive?: boolean; wealthRecordType?: string | null }, reason: string) =>
    request<{ category: WealthFormCategoryTree }>(`/admin/v1/forms/wealth/categories/${encodeURIComponent(id)}`, {
      method: "PATCH", body: JSON.stringify({ ...updates, reason }),
    }),
  createWealthSubtype: (categoryId: string, input: { label: string; description?: string | null; sortOrder?: number }, reason: string) =>
    request<{ subtype: WealthFormSubtype }>(`/admin/v1/forms/wealth/categories/${encodeURIComponent(categoryId)}/subtypes`, {
      method: "POST", body: JSON.stringify({ ...input, reason }),
    }),
  updateWealthSubtype: (id: string, updates: { label?: string; description?: string | null; sortOrder?: number; isActive?: boolean }, reason: string) =>
    request<{ subtype: WealthFormSubtype }>(`/admin/v1/forms/wealth/subtypes/${encodeURIComponent(id)}`, {
      method: "PATCH", body: JSON.stringify({ ...updates, reason }),
    }),
  createWealthField: (subtypeId: string, input: { fieldId: string; label: string; inputType: string; required?: boolean; placeholder?: string | null; group?: string | null; sortOrder?: number }, reason: string) =>
    request<{ field: WealthFormField }>(`/admin/v1/forms/wealth/subtypes/${encodeURIComponent(subtypeId)}/fields`, {
      method: "POST", body: JSON.stringify({ ...input, reason }),
    }),
  updateWealthField: (id: string, updates: { label?: string; inputType?: string; required?: boolean; placeholder?: string | null; group?: string | null; sortOrder?: number; isActive?: boolean }, reason: string) =>
    request<{ field: WealthFormField }>(`/admin/v1/forms/wealth/fields/${encodeURIComponent(id)}`, {
      method: "PATCH", body: JSON.stringify({ ...updates, reason }),
    }),
};

export type ConnectionIssue = {
  id: string; userId: string; provider: string; providerEmail: string; status: string;
  grantedScopes: string[]; lastScannedAt: string | null; lastSuccessfulSync: string | null;
  scanStartedAt: string | null; scanPhase: string | null; scanProcessed: number; scanTotal: number;
  indexedCount: number; lastScanError: string | null; createdAt: string; updatedAt: string;
};

export const adminIntegrationsApi = {
  disconnected: (limit = 50) => request<{ total: number; items: ConnectionIssue[] }>(`/admin/v1/integrations/disconnected?limit=${limit}`),
  scanErrors: (limit = 50) => request<{ total: number; items: ConnectionIssue[] }>(`/admin/v1/integrations/scan-errors?limit=${limit}`),
  stuckScans: (limit = 50) => request<{ total: number; items: ConnectionIssue[] }>(`/admin/v1/integrations/stuck-scans?limit=${limit}`),
  disconnect: (id: string, reason: string) =>
    request<{ id: string; provider: string }>(`/admin/v1/integrations/${id}/disconnect`, { method: "POST", body: JSON.stringify({ reason }) }),
};

export type TrustStats = {
  byStatus: { INVITED: number; ACTIVE: number; REVOKED: number; REJECTED: number };
  currentlyLocked: number; pendingInvites: number; expiredInvites: number;
};
export type TrustMemberRow = {
  id: string; name: string; email: string; relation: string; customRelation: string | null;
  accessType: string; status: string; invitedAt: string; acceptedAt: string | null; revokedAt: string | null;
  pinAttemptCount: number; pinLockedUntil: string | null;
};

export const adminTrustApi = {
  stats: () => request<TrustStats>("/admin/v1/trust/stats"),
};

export type BillingStats = { free: number; paid: number; total: number };
export type TierChangeEntry = {
  id: string; at: string; actorEmail: string; targetId: string | null;
  reason: string | null; diff: { from?: string; to?: string } | null;
};

export type FeedbackStatus = "open" | "in_progress" | "resolved" | "dismissed";
export type FeedbackCategory = "bug" | "idea" | "other";
export type FeedbackListItem = {
  id: string; email: string; platform: string; category: FeedbackCategory; message: string; status: FeedbackStatus;
  assignedToAdminId: string | null; assignedToAdmin: { name: string; email: string } | null;
  resolutionNote: string | null; resolvedAt: string | null; createdAt: string;
};
export type FeedbackDetail = FeedbackListItem & { userId: string | null; updatedAt: string };

export const adminFeedbackApi = {
  list: (opts: { status?: FeedbackStatus; category?: FeedbackCategory; limit?: number } = {}) => {
    const params = new URLSearchParams();
    if (opts.status) params.set("status", opts.status);
    if (opts.category) params.set("category", opts.category);
    params.set("limit", String(opts.limit ?? 50));
    return request<{ total: number; items: FeedbackListItem[] }>(`/admin/v1/feedback?${params.toString()}`);
  },
  get: (id: string) => request<{ item: FeedbackDetail }>(`/admin/v1/feedback/${id}`),
  setStatus: (id: string, status: FeedbackStatus, note?: string) =>
    request<{ item: FeedbackDetail }>(`/admin/v1/feedback/${id}/status`, { method: "POST", body: JSON.stringify({ status, note }) }),
  assign: (id: string, adminId: string | null) =>
    request<{ item: FeedbackDetail }>(`/admin/v1/feedback/${id}/assign`, { method: "POST", body: JSON.stringify({ adminId }) }),
};

export type PromptConfig =
  | { kind: "string"; text: string }
  | { kind: "array"; items: string[] }
  | { kind: "multi"; parts: Record<string, string> };
export type AITaskListItem = {
  taskKey: string; configured: boolean; primaryModel: string | null; fallbackModel: string | null;
  version: number; updatedAt: string | null; monthToDateUsd: number; monthlyCapUsd: number | null;
};
export type AITaskConfigRow = {
  id: string; taskKey: string; primaryModel: string; fallbackModel: string | null; promptConfig: PromptConfig;
  version: number; updatedAt: string; createdAt: string;
};
export type PromptRevisionRow = {
  id: string; version: number; primaryModel: string; fallbackModel: string | null; promptConfig: PromptConfig;
  testResult: unknown; publishedBy: { name: string; email: string } | null; createdAt: string;
};
export type AIRequestLogRow = {
  id: string; model: string; success: boolean; errorCode: string | null; tokensIn: number | null; tokensOut: number | null;
  costUsd: string | null; durationMs: number | null; createdAt: string;
};
export type AITaskDetail = {
  config: AITaskConfigRow; revisions: PromptRevisionRow[];
  budget: { monthlyCapUsd: string } | null; recentLogs: AIRequestLogRow[]; monthToDateUsd: number;
};
export type AITestResult =
  | { success: true; durationMs: number; sampleQuery: string; output: Record<string, unknown> }
  | { success: false; durationMs: number; sampleQuery: string; error: string };

export const adminAIApi = {
  listTasks: () => request<{ tasks: AITaskListItem[] }>("/admin/v1/ai/tasks"),
  getTask: (taskKey: string) => request<AITaskDetail>(`/admin/v1/ai/tasks/${encodeURIComponent(taskKey)}`),
  publish: (taskKey: string, input: { primaryModel: string; fallbackModel?: string | null; promptConfig: PromptConfig; testResult?: unknown }, reason: string) =>
    request<{ config: AITaskConfigRow }>(`/admin/v1/ai/tasks/${encodeURIComponent(taskKey)}/publish`, {
      method: "POST", body: JSON.stringify({ ...input, reason }),
    }),
  test: (taskKey: string, draft: { primaryModel: string; promptConfig: PromptConfig }) =>
    request<AITestResult>(`/admin/v1/ai/tasks/${encodeURIComponent(taskKey)}/test`, { method: "POST", body: JSON.stringify(draft) }),
  setBudget: (taskKey: string, monthlyCapUsd: number, reason: string) =>
    request<{ budget: { monthlyCapUsd: string } }>(`/admin/v1/ai/tasks/${encodeURIComponent(taskKey)}/budget`, {
      method: "POST", body: JSON.stringify({ monthlyCapUsd, reason }),
    }),
};

export const adminBillingApi = {
  stats: () => request<BillingStats>("/admin/v1/billing/stats"),
  tierChanges: (limit = 50) => request<{ items: TierChangeEntry[] }>(`/admin/v1/billing/tier-changes?limit=${limit}`),
};

export type AdminRoleName = "support" | "catalogue" | "ops_security" | "owner";
export type AdminListItem = {
  id: string; email: string; name: string; role: AdminRoleName; disabledAt: string | null;
  lastLoginAt: string | null; createdAt: string; passkeyCount: number; activeSessionCount: number;
};
export type AdminSessionRow = {
  id: string; ip: string | null; userAgent: string | null; createdAt: string; revokedAt: string | null; stepUpAt: string | null;
};
export type AdminPasskeyRow = { id: string; deviceLabel: string | null; createdAt: string; lastUsedAt: string | null; transports: string[] };
export type AdminDetail = {
  id: string; email: string; name: string; role: AdminRoleName; disabledAt: string | null;
  lastLoginAt: string | null; createdAt: string; passkeys: AdminPasskeyRow[]; sessions: AdminSessionRow[];
};

export type AccessReviewStatus = {
  cadenceDays: number; lastReviewedAt: string | null; lastReviewedBy: string | null;
  lastReviewNote: string | null; dueAt: string | null; overdue: boolean;
};

export const adminAdminsApi = {
  list: () => request<{ admins: AdminListItem[] }>("/admin/v1/admins"),
  accessReview: () => request<AccessReviewStatus>("/admin/v1/admins/access-review"),
  recordAccessReview: (reason: string) =>
    request<AccessReviewStatus>("/admin/v1/admins/access-review", { method: "POST", body: JSON.stringify({ reason }) }),
  get: (id: string) => request<{ admin: AdminDetail }>(`/admin/v1/admins/${id}`),
  invite: (input: { email: string; name: string; role: AdminRoleName }, reason: string) =>
    request<{ admin: { id: string; email: string; name: string; role: AdminRoleName } }>("/admin/v1/admins", {
      method: "POST", body: JSON.stringify({ ...input, reason }),
    }),
  changeRole: (id: string, role: AdminRoleName, reason: string) =>
    request<{ admin: { id: string; role: AdminRoleName } }>(`/admin/v1/admins/${id}/role`, {
      method: "POST", body: JSON.stringify({ role, reason }),
    }),
  disable: (id: string, reason: string) =>
    request<{ admin: { id: string; disabledAt: string | null } }>(`/admin/v1/admins/${id}/disable`, {
      method: "POST", body: JSON.stringify({ reason }),
    }),
  enable: (id: string, reason: string) =>
    request<{ admin: { id: string; disabledAt: string | null } }>(`/admin/v1/admins/${id}/enable`, {
      method: "POST", body: JSON.stringify({ reason }),
    }),
  revokeSession: (id: string, sessionId: string, reason?: string) =>
    request<{ session: { id: string; revokedAt: string | null } }>(`/admin/v1/admins/${id}/sessions/${sessionId}/revoke`, {
      method: "POST", body: JSON.stringify({ reason }),
    }),
};

// Minimal structural types so we don't need @simplewebauthn/server's types on
// the frontend just for this — @simplewebauthn/browser accepts these directly.
type PublicKeyCredentialCreationOptionsJSON = Parameters<typeof import("@simplewebauthn/browser").startRegistration>[0]["optionsJSON"];
type PublicKeyCredentialRequestOptionsJSON = Parameters<typeof import("@simplewebauthn/browser").startAuthentication>[0]["optionsJSON"];
