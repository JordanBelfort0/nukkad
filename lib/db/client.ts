import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL!;
// max:1 keeps connections predictable in serverless + tests
export const sql = postgres(connectionString, { max: 1 });
export const db = drizzle(sql, { schema });
