-- CreateTable
CREATE TABLE "profiles" (
    "id" TEXT NOT NULL,
    "username" VARCHAR(100) NOT NULL,
    "email" VARCHAR(255),
    "avatar_url" TEXT,
    "is_guest" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "last_login" TIMESTAMPTZ(6),

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_stats" (
    "profile_id" VARCHAR(255) NOT NULL,
    "games_played" INTEGER NOT NULL DEFAULT 0,
    "games_won" INTEGER NOT NULL DEFAULT 0,
    "total_playtime_minutes" INTEGER NOT NULL DEFAULT 0,
    "bunker_survival_rate" DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "user_stats_pkey" PRIMARY KEY ("profile_id")
);

-- CreateTable
CREATE TABLE "game_history" (
    "id" UUID NOT NULL,
    "room_id" VARCHAR(10) NOT NULL,
    "profile_id" VARCHAR(255),
    "player_name" VARCHAR(100) NOT NULL,
    "game_status" VARCHAR(20) NOT NULL,
    "was_exiled" BOOLEAN NOT NULL DEFAULT false,
    "survived" BOOLEAN NOT NULL DEFAULT false,
    "final_round" INTEGER,
    "players_count" INTEGER NOT NULL,
    "bunker_capacity" INTEGER NOT NULL,
    "catastrophe_id" VARCHAR(100),
    "played_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "duration_minutes" INTEGER,

    CONSTRAINT "game_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "profiles_username_key" ON "profiles"("username");

-- CreateIndex
CREATE INDEX "profiles_username_idx" ON "profiles"("username");

-- CreateIndex
CREATE INDEX "profiles_is_guest_idx" ON "profiles"("is_guest");

-- CreateIndex
CREATE INDEX "profiles_last_login_idx" ON "profiles"("last_login");

-- CreateIndex
CREATE INDEX "user_stats_profile_id_idx" ON "user_stats"("profile_id");

-- CreateIndex
CREATE INDEX "game_history_profile_id_idx" ON "game_history"("profile_id");

-- CreateIndex
CREATE INDEX "game_history_played_at_idx" ON "game_history"("played_at");

-- CreateIndex
CREATE INDEX "game_history_room_id_idx" ON "game_history"("room_id");

-- AddForeignKey
ALTER TABLE "user_stats" ADD CONSTRAINT "user_stats_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_history" ADD CONSTRAINT "game_history_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Note: Database was reset before migration, so no data migration SQL needed
