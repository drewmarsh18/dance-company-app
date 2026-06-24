import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import * as schema from "./schema"

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 5000,  // fail fast if can't get a connection
  statement_timeout: 5000,         // kill queries that run > 5s
  max: 3,                          // keep pool small for serverless
})

export const db = drizzle(pool, { schema })
