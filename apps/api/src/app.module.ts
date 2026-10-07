import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";

import { OidcAuthGuard } from "./auth/oidc-auth.guard";
import { DatabaseService } from "./database.service";
import { HealthController } from "./health.controller";
import { WorkspaceController } from "./workspaces/workspace.controller";
import { WorkspaceService } from "./workspaces/workspace.service";
import { WorkspaceAccessService } from "./workspaces/workspace-access.service";
import { WorkspacePermissionGuard } from "./workspaces/workspace-permission.guard";

@Module({
  controllers: [HealthController, WorkspaceController],
  providers: [
    DatabaseService,
    WorkspaceAccessService,
    WorkspaceService,
    { provide: APP_GUARD, useClass: OidcAuthGuard },
    { provide: APP_GUARD, useClass: WorkspacePermissionGuard },
  ],
})
export class AppModule {}
