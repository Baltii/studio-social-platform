import { Injectable, type OnModuleDestroy, ServiceUnavailableException } from "@nestjs/common";
import { createDatabase } from "@studio/database";

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly connection = process.env.DATABASE_URL ? createDatabase(process.env.DATABASE_URL) : null;

  get db() {
    if (!this.connection) {
      throw new ServiceUnavailableException("Database is not configured");
    }
    return this.connection.db;
  }

  async isReady(): Promise<boolean> {
    if (!this.connection) {
      return false;
    }
    try {
      await this.connection.db.execute("select 1");
      return true;
    } catch {
      return false;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.connection?.pool.end();
  }
}
