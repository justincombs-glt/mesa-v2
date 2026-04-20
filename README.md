# MESA v2 — Phase 2 + 2.5: Admin Module + Composite Tests

This zip contains everything from Phase 2 (Admin module) PLUS Phase 2.5 (Composite Performance Tests). Ship them together.

---

## What's in this zip

### Phase 2 features (unchanged from previous delivery)
- **Users** — list, search, filter by role, change role, invite users, revoke invites
- **Drills** — on-ice drill library with CRUD
- **Exercises** — off-ice exercise library with CRUD (new in v2)
- **Goal Templates** — goal template library with CRUD
- **Performance Tests** — individual test definitions with unit + direction

### Phase 2.5 NEW: Composite Performance Tests
- New sidebar item for admin: **Composite Tests** (`/dashboard/composite-performance-tests`)
- A composite performance test (CPT) is a named, ordered bundle of individual tests
- Examples: "Fall Baseline", "Pro Day", "Mid-Season Check"
- CPT editor:
  - Title + description
  - Add individual tests from your existing repository
  - Reorder with up/down arrows
  - Remove with × button
- Trainer workflow to actually *run* a CPT (record values for multiple students) comes in Phase 5 — this batch just sets up the definitions

---

## Deployment — migration runs first

### If you already deployed Phase 2

The migration is additive (CREATE TABLE IF NOT EXISTS + ALTER TABLE ADD COLUMN IF NOT EXISTS). Safe to run against a Phase 2 database.

### If you haven't deployed Phase 2 yet

You still only run the ONE migration. It piggybacks on Phase 1's schema.

### Step 1 — Run the CPT migration

1. Unzip `mesa-v2-phase2.5-clean.zip` on your Mac
2. Supabase → SQL Editor → New query
3. Open `supabase/migrations/0007_composite_performance_tests.sql`
4. Copy all contents → paste → Run
5. Expected: "Success. No rows returned." (some "already exists" notices are fine — idempotent)

Verify:
```
select
  (select count(*) from public.composite_performance_tests) as cpt_count,
  (select count(*) from information_schema.columns
   where table_name = 'performance_test_results' and column_name = 'cpt_session_id') as new_column_exists;
```

Expected: `cpt_count = 0`, `new_column_exists = 1`.

### Step 2 — Upload code

GitHub → `mesa-2` repo → Add file → Upload files → drag contents of unzipped `mesa/` folder → commit "Phase 2 + 2.5"

---

## Testing the full delivery

### Test 1 — Performance Test Library (Phase 2)

As admin, sidebar **Performance Tests** → **Add test**:

1. Title: `40-yard dash`, Domain: Off-Ice, Unit: `sec`, Direction: Lower is better
2. Title: `1RM back squat`, Domain: Off-Ice, Unit: `lb`, Direction: Higher is better
3. Title: `Vertical jump`, Domain: Off-Ice, Unit: `in`, Direction: Higher is better

Three tests created. Now you're ready for a composite.

### Test 2 — Create a Composite

As admin, sidebar **Composite Tests** → **Add composite**:

1. Title: `Fall Baseline`
2. Description: `Pre-season testing across speed, strength, and power.`
3. Add test from dropdown: 40-yard dash → appears as item 1
4. Add test: 1RM back squat → item 2
5. Add test: Vertical jump → item 3
6. Use ↑/↓ arrows to reorder them however makes sense
7. Click Create composite

The CPT appears as a card on the Composite Tests page showing its 3 sub-tests.

### Test 3 — Edit a Composite

Click the card → modal opens in edit mode → reorder, add another test, remove one → Save. Changes persist.

### Test 4 — Try to add a composite with no sub-tests

You can't — the Create button is disabled until at least one test is selected. Error message shows if somehow bypassed.

### Test 5 — Delete a Composite

Edit a CPT → Delete button (bottom left) → confirms → gone from list. Individual sub-tests are NOT deleted (they remain in the Performance Tests library).

---

## Permissions at Phase 2 + 2.5

| Action | Admin | Director | Coach | Trainer |
|--------|-------|----------|-------|---------|
| View composite tests | ✓ | ✓ | ✓ | ✓ |
| Create / edit / delete composites | ✓ | ✓ | — | — |
| Administer a CPT session (record values) | ✓ | ✓ | — | ✓ |

(Last row: session-recording UI lands in Phase 5 when we build the trainer workflow. Schema and permissions are in place; the UI just isn't built yet.)

---

## Schema added in Phase 2.5

Three new tables:

- `composite_performance_tests` — the CPT definition (title, description, etc.)
- `composite_performance_test_items` — the ordered list of individual tests in each CPT
- `cpt_sessions` — a recorded instance of running a CPT on a specific date (used by Phase 5 trainer UI)

Plus one column:

- `performance_test_results.cpt_session_id` — optional FK linking a result to a session. Null = ad-hoc. Set = recorded as part of a CPT session.

---

## What to report back

- **"Both pages work, created tests and a composite"** → Phase 3 begins
- **"Migration error: [paste]"** → we fix SQL
- **"Build error: [paste]"** → we debug
- **"[Something] not working: [describe]"** → feedback

---

## What's next — Phase 3 (Director module)

- Student directory + enrollment
- Parent-linking workflow
- Practice Plans (templates from drills + free-text skills)
- Goal Management (plans, 1-3 goals per plan, linked tests, reviews)
- Performance Management (read-only shell for now — cross-cutting activity view)

Likely split into 3a + 3b because it's bigger than Phase 2.
