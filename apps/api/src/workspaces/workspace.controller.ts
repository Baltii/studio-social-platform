import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Req,
  UnauthorizedException,
} from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from "@nestjs/swagger";

import type { AuthenticatedRequest } from "../auth/authenticated-request";
import { createWorkspaceSchema, updateWorkspaceSchema } from "./workspace.schemas";
import { WorkspaceService } from "./workspace.service";
import { RequireWorkspacePermission } from "./workspace-permission.decorator";

@ApiTags("workspaces")
@ApiBearerAuth()
@Controller("workspaces")
export class WorkspaceController {
  constructor(@Inject(WorkspaceService) private readonly workspaces: WorkspaceService) {}

  private actor(request: AuthenticatedRequest) {
    if (!request.actor) {
      throw new UnauthorizedException();
    }
    return request.actor;
  }

  @Get()
  @ApiOperation({ summary: "List the current user's workspaces" })
  list(@Req() request: AuthenticatedRequest) {
    return this.workspaces.list(this.actor(request).userId);
  }

  @Post()
  @ApiOperation({ summary: "Create a workspace and owner membership" })
  @ApiBody({
    schema: {
      type: "object",
      required: ["name", "slug"],
      properties: { name: { type: "string" }, slug: { type: "string" }, timezone: { type: "string" } },
    },
  })
  @ApiResponse({ status: 201, description: "Workspace created" })
  create(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    const result = createWorkspaceSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(
        result.error.issues.map((issue) => ({ field: issue.path.join("."), message: issue.message })),
      );
    }
    return this.workspaces.create(this.actor(request).userId, result.data);
  }

  @Get(":workspaceId")
  @RequireWorkspacePermission("workspace:read")
  @ApiOperation({ summary: "Read a workspace" })
  @ApiParam({ name: "workspaceId", format: "uuid" })
  get(@Req() request: AuthenticatedRequest, @Param("workspaceId") workspaceId: string) {
    return this.workspaces.get(this.actor(request).userId, workspaceId);
  }

  @Patch(":workspaceId")
  @RequireWorkspacePermission("workspace:manage")
  @ApiOperation({ summary: "Update workspace name or timezone" })
  @ApiParam({ name: "workspaceId", format: "uuid" })
  @ApiBody({ schema: { type: "object", properties: { name: { type: "string" }, timezone: { type: "string" } } } })
  update(@Req() request: AuthenticatedRequest, @Param("workspaceId") workspaceId: string, @Body() body: unknown) {
    const result = updateWorkspaceSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(
        result.error.issues.map((issue) => ({ field: issue.path.join("."), message: issue.message })),
      );
    }
    return this.workspaces.update(this.actor(request).userId, workspaceId, result.data);
  }
}
