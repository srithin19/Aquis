/**
 * Local database schema — Product Bible 13.
 *
 * Migrations are an ordered, append-only list. Each entry runs exactly once and
 * `user_version` records how far we've got, so an app update never re-runs a
 * step or loses a user's history.
 *
 * Tables for later phases (notification_event, achievement, streak) are created
 * now so Phase 3/4 can fill them without a migration that touches live data.
 */

export interface Migration {
  readonly id: number;
  readonly statements: readonly string[];
}

export const MIGRATIONS: readonly Migration[] = [
  {
    id: 1,
    statements: [
      `CREATE TABLE IF NOT EXISTS user_profile (
         id            TEXT PRIMARY KEY NOT NULL,
         display_name  TEXT,
         email         TEXT,
         provider      TEXT NOT NULL,
         created_at    INTEGER NOT NULL
       );`,

      `CREATE TABLE IF NOT EXISTS goal (
         id                     TEXT PRIMARY KEY NOT NULL,
         daily_goal_ml          INTEGER NOT NULL,
         start_date             TEXT NOT NULL,
         end_date               TEXT NOT NULL,
         duration_days          INTEGER NOT NULL,
         status                 TEXT NOT NULL,
         created_at             INTEGER NOT NULL,
         recommendation_source  TEXT
       );`,
      `CREATE INDEX IF NOT EXISTS idx_goal_status ON goal (status);`,

      // goal_ml is frozen per day: the historical integrity rule in section 11.
      `CREATE TABLE IF NOT EXISTS daily_hydration (
         date                TEXT PRIMARY KEY NOT NULL,
         goal_id             TEXT,
         goal_ml             INTEGER NOT NULL,
         consumed_ml         INTEGER NOT NULL DEFAULT 0,
         completed           INTEGER NOT NULL DEFAULT 0,
         completion_percent  INTEGER NOT NULL DEFAULT 0,
         entry_count         INTEGER NOT NULL DEFAULT 0,
         first_entry_at      INTEGER,
         last_entry_at       INTEGER,
         FOREIGN KEY (goal_id) REFERENCES goal (id)
       );`,

      `CREATE TABLE IF NOT EXISTS water_entry (
         id          TEXT PRIMARY KEY NOT NULL,
         date        TEXT NOT NULL,
         amount_ml   INTEGER NOT NULL,
         logged_at   INTEGER NOT NULL,
         source      TEXT NOT NULL,
         created_at  INTEGER NOT NULL
       );`,
      `CREATE INDEX IF NOT EXISTS idx_water_entry_date ON water_entry (date, logged_at);`,

      `CREATE TABLE IF NOT EXISTS container_preset (
         id         TEXT PRIMARY KEY NOT NULL,
         name       TEXT NOT NULL,
         volume_ml  INTEGER NOT NULL,
         enabled    INTEGER NOT NULL DEFAULT 1
       );`,

      // Single-row settings table; the CHECK keeps it that way.
      `CREATE TABLE IF NOT EXISTS app_settings (
         id                          INTEGER PRIMARY KEY CHECK (id = 1),
         notifications_enabled       INTEGER NOT NULL DEFAULT 1,
         quiet_start                 TEXT NOT NULL DEFAULT '22:00',
         quiet_end                   TEXT NOT NULL DEFAULT '07:00',
         reduce_motion               INTEGER NOT NULL DEFAULT 0,
         haptics_enabled             INTEGER NOT NULL DEFAULT 1,
         quick_add_ml                TEXT NOT NULL DEFAULT '150,250,500',
         post_goal_reminders_enabled INTEGER NOT NULL DEFAULT 0,
         onboarding_completed        INTEGER NOT NULL DEFAULT 0
       );`,

      `CREATE TABLE IF NOT EXISTS notification_event (
         id            TEXT PRIMARY KEY NOT NULL,
         scheduled_at  INTEGER NOT NULL,
         shown_at      INTEGER,
         action        TEXT,
         related_date  TEXT,
         reason        TEXT
       );`,

      `CREATE TABLE IF NOT EXISTS streak_state (
         id                    INTEGER PRIMARY KEY CHECK (id = 1),
         current               INTEGER NOT NULL DEFAULT 0,
         longest               INTEGER NOT NULL DEFAULT 0,
         last_successful_date  TEXT
       );`,
      `CREATE TABLE IF NOT EXISTS user_achievement (
         achievement_id  TEXT PRIMARY KEY NOT NULL,
         earned_at       INTEGER NOT NULL
       );`,
    ],
  },
  {
    // Goal-end flow (04): a closed goal period shows its summary exactly once.
    // Existing closed goals are marked seen so upgrading never replays old ones.
    id: 2,
    statements: [
      `ALTER TABLE goal ADD COLUMN summary_seen INTEGER NOT NULL DEFAULT 0;`,
      `UPDATE goal SET summary_seen = 1 WHERE status != 'active';`,
      // Before this version every elapsed period was stored as 'completed'.
      // Only a period where every day hit 100% earns that status (and the Goal
      // Crusher badge); the rest were periods that simply ended.
      `UPDATE goal SET status = 'ended'
         WHERE status = 'completed'
           AND (SELECT COUNT(*) FROM daily_hydration d
                 WHERE d.goal_id = goal.id AND d.completed = 1) < goal.duration_days;`,
      `CREATE INDEX IF NOT EXISTS idx_notification_event_date ON notification_event (related_date, scheduled_at);`,
    ],
  },
  {
    // Sound effects on by default; users can switch them off in Profile.
    id: 3,
    statements: [`ALTER TABLE app_settings ADD COLUMN sounds_enabled INTEGER NOT NULL DEFAULT 1;`],
  },
];

export const LATEST_SCHEMA_VERSION = MIGRATIONS[MIGRATIONS.length - 1].id;
