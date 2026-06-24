import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import * as schema from "./schema"

// Use unpooled URL to avoid PgBouncer channel_binding incompatibility that
// causes TCP connections to hang indefinitely in serverless environments.
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL,
  connectionTimeoutMillis: 5000,
  max: 3,
})

export const db = drizzle(pool, { schema })
