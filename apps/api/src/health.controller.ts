import { Controller, Get, Inject, ServiceUnavailableException } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";

import { Public } from "./auth/public.decorator";
import { DatabaseService } from "./database.service";

@ApiTags("health")
@Public()
@Controller("health")
export class HealthController {
  @Inject(DatabaseService)
  private readonly database!: DatabaseService;

  @Get("live")
  @ApiOperation({ summary: "Process liveness" })
  @ApiResponse({ status: 200, description: "The API process is running" })
  live() {
    return { status: "ok" };
  }

  @Get("ready")
  @ApiOperation({ summary: "Database readiness" })
  @ApiResponse({ status: 200, description: "The database is reachable" })
  @ApiResponse({ status: 503, description: "The database is unavailable" })
  async ready() {
    if (!(await this.database.isReady())) {
      throw new ServiceUnavailableException("Database is unavailable");
    }
    return { status: "ok" };
  }
}
