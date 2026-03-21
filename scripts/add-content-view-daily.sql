CREATE TABLE IF NOT EXISTS "public"."content_view_daily" (
  "content_id" INTEGER NOT NULL,
  "view_date" TIMESTAMP(3) NOT NULL,
  "view_count" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "content_view_daily_pkey" PRIMARY KEY ("content_id", "view_date"),
  CONSTRAINT "content_view_daily_content_id_fkey" FOREIGN KEY ("content_id") REFERENCES "public"."contents" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "content_view_daily_view_date_idx"
  ON "public"."content_view_daily" ("view_date");

CREATE INDEX IF NOT EXISTS "content_view_daily_view_date_view_count_idx"
  ON "public"."content_view_daily" ("view_date", "view_count");
