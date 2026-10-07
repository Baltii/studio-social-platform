import {
  BadRequestException,
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Permission } from "@studio/shared";
import { z } from "zod";

import type { AuthenticatedRequest } from "../auth/authenticated-request";
import { WorkspaceAccessService } from "./workspace-access.service";
import { WORKSPACE_PERMISSION_KEY } from "./workspace-permission.decorator";

@Injectable()
export class WorkspacePermissionGuard implements CanActivate {
  @Inject(Reflector)
  private readonly reflector!: Reflector;

  @Inject(WorkspaceAccessService)
  private readonly access!: WorkspaceAccessService;

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const permission = this.reflector.getAllAndOverride<Permission>(WORKSPACE_PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!permission) {
      return true;
    }
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.actor) {
      throw new UnauthorizedException();
    }
    const workspaceId = z.uuid().safeParse(request.params.workspaceId);
    if (!workspaceId.success) {
      throw new BadRequestException("Invalid workspace ID");
    }
    await this.access.require(request.actor.userId, workspaceId.data, permission);
    return true;
  }
}
