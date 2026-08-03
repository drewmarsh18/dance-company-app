CREATE TABLE "push_token" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"token" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "push_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "google_calendar_token" ALTER COLUMN "refreshToken" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "status" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "push_token" ADD CONSTRAINT "push_token_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "push_token_user_idx" ON "push_token" USING btree ("userId");