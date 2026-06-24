import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  unique,
} from "drizzle-orm/pg-core"

// --- Better Auth required tables -------------------------------------------
// Column names are camelCase to match Better Auth's defaults. Do not rename.

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("emailVerified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expiresAt").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
})

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  accessTokenExpiresAt: timestamp("accessTokenExpiresAt"),
  refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow(),
})

// --- App data ---------------------------------------------------------------
// Prep Masters (staff), Clients, and Bookings are stored in Airtable, which
// acts as the backend of record. See lib/airtable.ts for those operations.

// Tracks which emails have been invited to join as prep masters (staff).
// Anyone who signs in with an email present here is treated as a prep master.
export const prepMasterInvite = pgTable("prep_master_invite", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  invitedBy: text("invitedBy").notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  acceptedAt: timestamp("acceptedAt"),
})

// A prep master's weekly recurring availability. One row per (email, weekday).
// Keyed by the prep master's email, which is both their login email and their
// Workers-table email, so dancers can look up availability when booking.
export const prepMasterAvailability = pgTable(
  "prep_master_availability",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    dayOfWeek: integer("dayOfWeek").notNull(), // 0 = Sunday … 6 = Saturday
    startTime: text("startTime").notNull(), // "HH:MM" 24h
    endTime: text("endTime").notNull(), // "HH:MM" 24h
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (t) => ({
    emailDayUnique: unique("prep_master_availability_email_day_unique").on(
      t.email,
      t.dayOfWeek,
    ),
  }),
)
