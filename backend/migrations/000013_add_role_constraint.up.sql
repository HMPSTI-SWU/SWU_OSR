-- Add CHECK constraint to enforce valid role values.
-- This validates any future INSERT/UPDATE against the known role set.
-- Using DO $$ ... $$ block to safely add constraint only if it doesn't exist yet.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_users_role' AND conrelid = 'users'::regclass
    ) THEN
        ALTER TABLE users
            ADD CONSTRAINT chk_users_role
            CHECK (role IN ('student', 'faculty', 'lpt_officer', 'super_admin'));
    END IF;
END $$;
