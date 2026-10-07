import { SetMetadata } from "@nestjs/common";
import type { Permission } from "@studio/shared";

export const WORKSPACE_PERMISSION_KEY = "studio:workspace-permission";
export const RequireWorkspacePermission = (permission: Permission) => SetMetadata(WORKSPACE_PERMISSION_KEY, permission);
