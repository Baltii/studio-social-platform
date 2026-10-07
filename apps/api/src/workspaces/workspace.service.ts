import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { auditLogs, workspaceMembers, workspaces } from "@studio/database";
import { eq } from "drizzle-orm";

import { DatabaseService } from "../database.service";
import type { CreateWorkspaceInput, UpdateWorkspaceInput } from "./workspace.schemas";
import { WorkspaceAccessService } from "./workspace-access.service";

function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }
  if ("code" in error && error.code === "23505") {
    return true;
  }
  return "cause" in error && error.cause !== error && isUniqueViolation(error.cause);
}

@Injectable()
export class WorkspaceService {
  @Inject(DatabaseService)
  private readonly database!: DatabaseService;

  @Inject(WorkspaceAccessService)
  private readonly access!: WorkspaceAccessService;

  async list(userId: string) {
    return this.database.db
      .select({
        id: workspaces.id,
        name: workspaces.name,
        slug: workspaces.slug,
        timezone: workspaces.timezone,
        role: workspaceMembers.role,
      })
      .from(workspaceMembers)
      .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
      .where(eq(workspaceMembers.userId, userId))
      .orderBy(workspaces.createdAt);
  }

  async get(userId: string, workspaceId: string) {
    await this.access.require(userId, workspaceId, "workspace:read");
    const [workspace] = await this.database.db
      .select({
        id: workspaces.id,
        name: workspaces.name,
        slug: workspaces.slug,
        timezone: workspaces.timezone,
      })
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .limit(1);
    if (!workspace) {
      throw new NotFoundException("Workspace not found");
    }
    return workspace;
  }

  async create(userId: string, input: CreateWorkspaceInput) {
    try {
      return await this.database.db.transaction(async (transaction) => {
        const [workspace] = await transaction
          .insert(workspaces)
          .values({ name: input.name, slug: input.slug, timezone: input.timezone, ownerUserId: userId })
          .returning({
            id: workspaces.id,
            name: workspaces.name,
            slug: workspaces.slug,
            timezone: workspaces.timezone,
          });
        await transaction.insert(workspaceMembers).values({ workspaceId: workspace.id, userId, role: "OWNER" });
        await transaction.insert(auditLogs).values({
          workspaceId: workspace.id,
          actorUserId: userId,
          action: "workspace.created",
          resource: "workspace",
          resourceId: workspace.id,
        });
        return { ...workspace, role: "OWNER" as const };
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException("Workspace slug is already in use");
      }
      throw error;
    }
  }

  async update(userId: string, workspaceId: string, input: UpdateWorkspaceInput) {
    await this.access.require(userId, workspaceId, "workspace:manage");
    return this.database.db.transaction(async (transaction) => {
      const [workspace] = await transaction
        .update(workspaces)
        .set({ ...input, updatedAt: new Date() })
        .where(eq(workspaces.id, workspaceId))
        .returning({ id: workspaces.id, name: workspaces.name, slug: workspaces.slug, timezone: workspaces.timezone });
      if (!workspace) {
        throw new NotFoundException("Workspace not found");
      }
      await transaction.insert(auditLogs).values({
        workspaceId,
        actorUserId: userId,
        action: "workspace.updated",
        resource: "workspace",
        resourceId: workspaceId,
        metadata: { fields: Object.keys(input) },
      });
      return workspace;
    });
  }
}
