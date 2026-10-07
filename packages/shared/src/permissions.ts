export const workspaceRoles = ["OWNER", "ADMIN", "MANAGER", "EDITOR", "VIEWER"] as const;
export type WorkspaceRole = (typeof workspaceRoles)[number];

export const permissions = [
  "workspace:read",
  "workspace:manage",
  "members:manage",
  "accounts:read",
  "accounts:manage",
  "posts:read",
  "posts:create",
  "posts:edit",
  "posts:approve",
  "posts:schedule",
  "posts:publish",
  "audit:read",
] as const;
export type Permission = (typeof permissions)[number];

const grants: Record<WorkspaceRole, ReadonlySet<Permission>> = {
  OWNER: new Set(permissions),
  ADMIN: new Set(permissions.filter((permission) => permission !== "workspace:manage")),
  MANAGER: new Set([
    "workspace:read",
    "accounts:read",
    "posts:read",
    "posts:create",
    "posts:edit",
    "posts:approve",
    "posts:schedule",
    "posts:publish",
  ]),
  EDITOR: new Set(["workspace:read", "accounts:read", "posts:read", "posts:create", "posts:edit"]),
  VIEWER: new Set(["workspace:read", "accounts:read", "posts:read"]),
};

export function hasPermission(role: WorkspaceRole, permission: Permission): boolean {
  return grants[role].has(permission);
}
