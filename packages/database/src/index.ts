import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema";

export * from "./schema";

export function createDatabase(connectionString: string) {
  const pool = new Pool({ connectionString, max: 10 });
  const db = drizzle({ client: pool, schema });
  return { db, pool };
}
