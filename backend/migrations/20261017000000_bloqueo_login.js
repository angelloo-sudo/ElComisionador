export const up = (pgm) => {
  pgm.sql(`
    ALTER TABLE usuarios
      ADD COLUMN IF NOT EXISTS login_failed_attempts INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS login_lock_level INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS login_locked_until TIMESTAMPTZ;
  `)
}

export const down = (pgm) => {
  pgm.sql(`
    ALTER TABLE usuarios
      DROP COLUMN IF EXISTS login_locked_until,
      DROP COLUMN IF EXISTS login_lock_level,
      DROP COLUMN IF EXISTS login_failed_attempts;
  `)
}
