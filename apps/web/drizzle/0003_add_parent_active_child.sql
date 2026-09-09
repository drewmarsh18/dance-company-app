CREATE TABLE "parent_active_child" (
	"parentUserId" text PRIMARY KEY NOT NULL,
	"childUserId" text NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "parent_active_child" ADD CONSTRAINT "parent_active_child_parentUserId_user_id_fk" FOREIGN KEY ("parentUserId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;