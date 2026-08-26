import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL!;
// max:1 keeps connections predictable in serverless + tests.
// prepare:false is required for Neon's pooled (pgbouncer) endpoint, which
// does not support the extended-protocol prepared statements postgres.js
// uses by default; harmless on direct connections too.
export const sql = postgres(connectionString, { max: 1, prepare: false });
export const db = drizzle(sql, { schema });
