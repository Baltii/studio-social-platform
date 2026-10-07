import { sql } from "drizzle-orm";
import {
  boolean,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const workspaceRole = pgEnum("workspace_role", ["OWNER", "ADMIN", "MANAGER", "EDITOR", "VIEWER"]);
export const integrationState = pgEnum("integration_state", [
  "NOT_CONFIGURED",
  "CONFIGURED",
  "DEVELOPMENT",
  "REVIEW_REQUIRED",
  "ACTIVE",
  "RESTRICTED",
]);
export const accountStatus = pgEnum("social_account_status", [
  "CONNECTED",
  "EXPIRED",
  "REAUTH_REQUIRED",
  "DISCONNECTED",
]);
export const postStatus = pgEnum("post_status", [
  "DRAFT",
  "READY",
  "PENDING_APPROVAL",
  "APPROVED",
  "SCHEDULED",
  "PROCESSING",
  "PARTIALLY_PUBLISHED",
  "PUBLISHED",
  "FAILED",
  "CANCELLED",
  "ARCHIVED",
]);
export const targetStatus = pgEnum("post_target_status", [
  "DRAFT",
  "SCHEDULED",
  "QUEUED",
  "UPLOADING_MEDIA",
  "PUBLISHING",
  "PUBLISHED",
  "FAILED",
  "RETRYING",
  "CANCELLED",
]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
};

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    oidcSubject: varchar("oidc_subject", { length: 255 }).notNull(),
    email: varchar("email", { length: 320 }).notNull(),
    displayName: varchar("display_name", { length: 160 }),
    ...timestamps,
  },
  (table) => [uniqueIndex("users_oidc_subject_unique").on(table.oidcSubject), index("users_email_idx").on(table.email)],
);

export const workspaces = pgTable(
  "workspaces",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 160 }).notNull(),
    slug: varchar("slug", { length: 100 }).notNull(),
    timezone: varchar("timezone", { length: 100 }).notNull().default("UTC"),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => users.id),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("workspaces_slug_unique").on(table.slug),
    index("workspaces_owner_idx").on(table.ownerUserId),
  ],
);

export const workspaceMembers = pgTable(
  "workspace_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    role: workspaceRole("role").notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("workspace_members_workspace_user_unique").on(table.workspaceId, table.userId),
    index("workspace_members_user_idx").on(table.userId),
  ],
);

export const socialProviders = pgTable(
  "social_providers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    key: varchar("key", { length: 40 }).notNull(),
    displayName: varchar("display_name", { length: 80 }).notNull(),
    state: integrationState("state").notNull().default("NOT_CONFIGURED"),
    ...timestamps,
  },
  (table) => [uniqueIndex("social_providers_key_unique").on(table.key)],
);

export const socialAccounts = pgTable(
  "social_accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    providerId: uuid("provider_id")
      .notNull()
      .references(() => socialProviders.id),
    externalAccountId: varchar("external_account_id", { length: 255 }).notNull(),
    username: varchar("username", { length: 255 }),
    displayName: varchar("display_name", { length: 255 }).notNull(),
    avatarUrl: text("avatar_url"),
    status: accountStatus("status").notNull().default("CONNECTED"),
    scopes: text("scopes").array(),
    tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("social_accounts_workspace_provider_external_unique").on(
      table.workspaceId,
      table.providerId,
      table.externalAccountId,
    ),
    uniqueIndex("social_accounts_workspace_id_unique").on(table.workspaceId, table.id),
    index("social_accounts_workspace_status_idx").on(table.workspaceId, table.status),
  ],
);

export const socialCredentials = pgTable(
  "social_credentials",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    socialAccountId: uuid("social_account_id").notNull(),
    ciphertext: text("ciphertext").notNull(),
    nonce: text("nonce").notNull(),
    authTag: text("auth_tag").notNull(),
    keyVersion: integer("key_version").notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("social_credentials_account_unique").on(table.socialAccountId),
    foreignKey({
      name: "social_credentials_workspace_account_fk",
      columns: [table.workspaceId, table.socialAccountId],
      foreignColumns: [socialAccounts.workspaceId, socialAccounts.id],
    }),
  ],
);

export const oauthStates = pgTable(
  "oauth_states",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    providerId: uuid("provider_id")
      .notNull()
      .references(() => socialProviders.id),
    stateHash: varchar("state_hash", { length: 128 }).notNull(),
    codeVerifierCiphertext: text("code_verifier_ciphertext"),
    codeVerifierNonce: text("code_verifier_nonce"),
    codeVerifierAuthTag: text("code_verifier_auth_tag"),
    keyVersion: integer("key_version"),
    redirectUri: text("redirect_uri").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("oauth_states_hash_unique").on(table.stateHash),
    index("oauth_states_expiry_idx").on(table.expiresAt),
    index("oauth_states_workspace_idx").on(table.workspaceId),
  ],
);

export const posts = pgTable(
  "posts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    authorUserId: uuid("author_user_id")
      .notNull()
      .references(() => users.id),
    title: varchar("title", { length: 255 }),
    universalCaption: text("universal_caption").notNull().default(""),
    linkUrl: text("link_url"),
    status: postStatus("status").notNull().default("DRAFT"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("posts_workspace_id_unique").on(table.workspaceId, table.id),
    index("posts_workspace_status_created_idx").on(table.workspaceId, table.status, table.createdAt),
    index("posts_workspace_author_idx").on(table.workspaceId, table.authorUserId),
  ],
);

export const postVersions = pgTable(
  "post_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    postId: uuid("post_id").notNull(),
    versionNumber: integer("version_number").notNull(),
    caption: text("caption").notNull(),
    linkUrl: text("link_url"),
    editedByUserId: uuid("edited_by_user_id")
      .notNull()
      .references(() => users.id),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("post_versions_post_number_unique").on(table.postId, table.versionNumber),
    foreignKey({
      name: "post_versions_workspace_post_fk",
      columns: [table.workspaceId, table.postId],
      foreignColumns: [posts.workspaceId, posts.id],
    }),
  ],
);

export const postTargets = pgTable(
  "post_targets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    postId: uuid("post_id").notNull(),
    socialAccountId: uuid("social_account_id").notNull(),
    captionOverride: text("caption_override"),
    linkOverride: text("link_override"),
    status: targetStatus("status").notNull().default("DRAFT"),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    idempotencyKey: uuid("idempotency_key").defaultRandom().notNull(),
    leaseUntil: timestamp("lease_until", { withTimezone: true }),
    externalPostId: varchar("external_post_id", { length: 255 }),
    externalPostUrl: text("external_post_url"),
    lastErrorCode: varchar("last_error_code", { length: 100 }),
    lastErrorMessage: text("last_error_message"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("post_targets_idempotency_unique").on(table.idempotencyKey),
    uniqueIndex("post_targets_post_account_unique").on(table.postId, table.socialAccountId),
    uniqueIndex("post_targets_workspace_id_unique").on(table.workspaceId, table.id),
    index("post_targets_workspace_schedule_idx").on(table.workspaceId, table.status, table.scheduledAt),
    index("post_targets_account_status_idx").on(table.socialAccountId, table.status),
    foreignKey({
      name: "post_targets_workspace_post_fk",
      columns: [table.workspaceId, table.postId],
      foreignColumns: [posts.workspaceId, posts.id],
    }),
    foreignKey({
      name: "post_targets_workspace_account_fk",
      columns: [table.workspaceId, table.socialAccountId],
      foreignColumns: [socialAccounts.workspaceId, socialAccounts.id],
    }),
  ],
);

export const schedules = pgTable(
  "schedules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    postTargetId: uuid("post_target_id").notNull(),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
    timezone: varchar("timezone", { length: 100 }).notNull(),
    active: boolean("active").notNull().default(true),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("schedules_one_active_per_target_unique").on(table.postTargetId).where(sql`${table.active} = true`),
    index("schedules_workspace_active_time_idx").on(table.workspaceId, table.active, table.scheduledAt),
    foreignKey({
      name: "schedules_workspace_target_fk",
      columns: [table.workspaceId, table.postTargetId],
      foreignColumns: [postTargets.workspaceId, postTargets.id],
    }),
  ],
);

export const publishAttempts = pgTable(
  "publish_attempts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    postTargetId: uuid("post_target_id").notNull(),
    attemptNumber: integer("attempt_number").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    requestMetadata: jsonb("request_metadata"),
    responseMetadata: jsonb("response_metadata"),
    httpStatus: integer("http_status"),
    errorCode: varchar("error_code", { length: 100 }),
    errorMessage: text("error_message"),
    retryable: boolean("retryable"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("publish_attempts_target_number_unique").on(table.postTargetId, table.attemptNumber),
    index("publish_attempts_workspace_started_idx").on(table.workspaceId, table.startedAt),
    foreignKey({
      name: "publish_attempts_workspace_target_fk",
      columns: [table.workspaceId, table.postTargetId],
      foreignColumns: [postTargets.workspaceId, postTargets.id],
    }),
  ],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    actorUserId: uuid("actor_user_id").references(() => users.id),
    action: varchar("action", { length: 120 }).notNull(),
    resource: varchar("resource", { length: 120 }).notNull(),
    resourceId: uuid("resource_id"),
    metadata: jsonb("metadata"),
    ipAddress: varchar("ip_address", { length: 45 }),
    ...timestamps,
  },
  (table) => [index("audit_logs_workspace_created_idx").on(table.workspaceId, table.createdAt)],
);
