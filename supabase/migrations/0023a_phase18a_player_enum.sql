-- ============================================================================
-- Phase 18a — Step 1 of 2: Add the 'player' enum value
--
-- IMPORTANT: This file MUST be run alone, BEFORE 0023b, and the transaction
-- MUST commit before 0023b runs. Postgres requires new enum values to be
-- committed before they can be referenced (the error you'll see otherwise:
-- 'unsafe use of new value "player" of enum type app_role').
--
-- In Supabase SQL Editor, each "Run" click executes as its own transaction,
-- so simply: Run this file → then Run 0023b. Don't paste them together.
--
-- This file is intentionally tiny so it's obvious why it exists.
-- Idempotent. Safe to re-run.
-- ============================================================================

do $$
begin
  if not exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'app_role' and e.enumlabel = 'player'
  ) then
    alter type public.app_role add value 'player';
  end if;
end$$;
