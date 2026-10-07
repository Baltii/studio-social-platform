import { ForbiddenException, Inject, Injectable } from "@nestjs/common";
import { workspaceMembers } from "@studio/database";
import { hasPermission, type Permission, type WorkspaceRole } from "@studio/shared";
import { and, eq } from "drizzle-orm";

import { DatabaseService } from "../database.service";

@Injectable()
export class WorkspaceAccessService {
  @Inject(DatabaseService)
  private readonly database!: DatabaseService;

  async require(userId: string, workspaceId: string, permission: Permission): Promise<WorkspaceRole> {
    const [membership] = await this.database.db
      .select({ role: workspaceMembers.role })
      .from(workspaceMembers)
      .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)))
      .limit(1);
    if (!membership || !hasPermission(membership.role, permission)) {
      throw new ForbiddenException("Workspace access denied");
    }
    return membership.role;
  }
}
