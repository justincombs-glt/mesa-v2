# MESA v2 — Phase R: Sidebar Reorganization + Label Renames

**Status:** Ready to deploy
**No SQL migration required.** Pure UI labels and structure changes — no actions, no schema.

The admin sidebar is now organized into 4 collapsible groups: Administration, Goal Management, Performance Management, Training Library. "Goal Templates" → "Goals", "Composite Tests" → "Athletic Performance Assessments", "CPT Sessions" → "APA Sessions" everywhere users can see those labels.

The DB tables, route URLs, and code-internal identifiers stay as they are. Only what users see changes.

---

## What shipped

### Admin sidebar groups (collapsible)

```
Home
─────────────────────
Administration  ▾
  Seasons
  Add Users
  Users
─────────────────────
Goal Management  ▾
  Goals  (was "Goal Templates")
─────────────────────
Performance Management  ▾
  Performance Tests
  Athletic Performance Assessments  (was "Composite Tests")
  APA Sessions  (was "CPT Sessions")
─────────────────────
Training Library  ▾
  Drills
  Exercises
─────────────────────
Profile
```

Group headers are clickable — tap to collapse/expand. Behavior:
- **Default**: all groups expanded on first visit
- **Persisted**: collapse/expand state saved in browser localStorage so the trainer's preferences survive page navigation and tab close
- **Active group always expanded**: whichever group contains the current page, that group is always shown expanded on mount, regardless of stored state. So if I'm on the Goals page and the Goal Management group was collapsed last visit, it'll still open so I can see where I am.
- **Same on mobile drawer**: the hamburger drawer (Phase Ma) now uses the same grouped + collapsible layout. Mobile and desktop use independent storage keys so collapse states don't bleed across form factors.

### Labels renamed everywhere user-facing

| Old | New |
|---|---|
| Goal Templates | **Goals** |
| Composite Tests / Composite Performance Tests | **Athletic Performance Assessments** |
| CPT (in user copy) | **APA** or "assessment" |
| CPT Sessions | **APA Sessions** |

Renamed in:
- Admin sidebar labels
- Director / trainer sidebar labels (where "CPT Sessions" was used)
- Page kickers + titles + descriptions on every affected page
- Modal titles ("Start a CPT session" → "Start an assessment session")
- Error messages and helper text
- Confirmation dialogs ("All goals, composites, and reviews will be lost" → "All goals, assessments, and reviews will be lost")
- Form field labels ("Composite test" → "Assessment")
- Empty-state messages

### What did NOT change

- **Route URLs are unchanged**: `/dashboard/goal-templates`, `/dashboard/composite-performance-tests`, `/dashboard/cpt-sessions` — same paths. Bookmarks still work. SEO links still work. Any direct links from external sources (emails etc.) still work.
- **Database tables are unchanged**: `goal_templates`, `composite_performance_tests`, `cpt_sessions` keep their names. Migrations and SQL queries still work as written.
- **Code identifiers are unchanged**: TypeScript types (`CompositePerformanceTest`, `GoalTemplate`), variable names (`composites`, `attachedComposites`), function names (`attachCompositeToPlan`) all keep their existing names. Renaming code internals is a much bigger churn for no functional benefit.
- **Director, coach, trainer, student, parent sidebars**: minimally changed. The only edit to non-admin sidebars was renaming "CPT Sessions" → "APA Sessions" (since that label is shared across roles). No grouping added — only admin's sidebar got the collapsible groups (Q7 = "admin only").

---

## Files added/changed

**New:**
- components/layout/SidebarNav.tsx (the collapsible group rendering, used by both desktop sidebar and mobile drawer)
- PHASE-R-README.md

**Changed:**
- components/layout/AppShell.tsx — `NavLink[]` → `NavSection[]` data model. Admin role now has 4 groups; other roles have a single ungrouped section. Desktop sidebar uses new `<SidebarNav>` component.
- components/layout/MobileNavDrawer.tsx — accepts `NavSection[]` instead of flat `NavLink[]`; uses `<SidebarNav>` with `mobile` storage key + `onNavigate` callback to close the drawer
- app/dashboard/goal-templates/page.tsx — kicker + title rewritten to "Goals"
- app/dashboard/composite-performance-tests/page.tsx — kicker + title + description use "Athletic Performance Assessments"
- app/dashboard/cpt-sessions/page.tsx — kicker + title + description use "APA Sessions" / "assessment"
- app/dashboard/cpt-sessions/[id]/page.tsx — breadcrumb link text "APA Sessions"
- app/dashboard/cpt-sessions/[id]/CptSessionDetailClient.tsx — error copy uses "Athletic Performance Assessments"
- app/dashboard/cpt-sessions/CptSessionsClient.tsx — modal title, form labels, empty-state copy
- app/dashboard/composite-performance-tests/CompositeTestsClient.tsx — form helper text
- app/dashboard/goal-management/page.tsx — description uses "athletic performance assessments"
- app/dashboard/goal-management/[planId]/PlanDetailClient.tsx — composites section header, attach button label, attach modal title + description, dropdown placeholder, delete confirmation message

**Actions**: 86 total. **No new actions.** No schema changes. No migration.

---

## Database

**No migration required.** All changes are UI text and structure.

---

## Deploy steps

1. Unzip `mesa-v2-phase-r-clean.zip`
2. GitHub → `mesa-2` repo → Add file → Upload files → drag contents, replace conflicts
3. Commit: `Phase R: Sidebar reorganization + label renames`
4. Vercel auto-deploys ~90s
5. Hard refresh

---

## How to test

### 1. Admin sidebar groups (desktop)
1. Sign in as admin → land on dashboard
2. Sidebar shows: Home, [Administration ▾], [Goal Management ▾], [Performance Management ▾], [Training Library ▾], Profile
3. Tap "Administration" header → group collapses (caret rotates from down to right)
4. Tap again → expands
5. Reload page → collapse state persists
6. Navigate to Goals page → Goal Management group auto-opens even if it was collapsed
7. Navigate to Drills → Training Library group auto-opens

### 2. Admin sidebar groups (mobile)
1. On phone, tap hamburger → drawer slides in
2. Same grouped layout as desktop
3. Tap a group header → collapses; reopen drawer → state persists
4. Tap a nav link → drawer closes
5. Mobile + desktop have independent state (collapsing on one doesn't affect the other)

### 3. Renamed labels
1. Look at admin sidebar — should NOT see "Goal Templates", "Composite Tests", or "CPT Sessions" anywhere
2. Open `/dashboard/goal-templates` → page header reads "Admin · Goals"
3. Open `/dashboard/composite-performance-tests` → page header reads "Athletic Performance Assessments"
4. Open `/dashboard/cpt-sessions` → page header reads "Trainer · APA Sessions"
5. Click "+ Start" on APA Sessions → modal says "Start an assessment session" with a field labeled "Assessment"
6. As director, open a goal management plan → "Performance tests" section says "+ Attach assessment"; modal opens as "Attach an assessment"

### 4. Other roles unchanged
1. Sign in as director → flat sidebar (no groups), only label change is "APA Sessions"
2. Sign in as trainer → same — flat sidebar, "APA Sessions" label
3. Coach, student, parent — sidebars flat as before

### 5. URLs still work
1. From a previously-bookmarked admin link to `/dashboard/goal-templates` — still works (route is unchanged, only the page label is "Goals")
2. Same for `/dashboard/composite-performance-tests` and `/dashboard/cpt-sessions`

---

## Known limits / cosmetic notes

- **Route URLs not renamed**: bookmarks would have broken otherwise. The sidebar shows "Goals" but the URL bar says `/goal-templates`. That's intentional — renaming routes would have meant Next.js redirect rules + careful migration of any links elsewhere in the codebase, with little user-visible benefit.
- **Code identifiers not renamed**: variable and function names like `composites`, `attachedComposites`, `CompositePerformanceTest`, `attachCompositeToPlan`, `cpt_session_id` etc. remain. Renaming them would have required touching dozens of files for no functional gain. Engineers reading the code see "composite", users see "assessment" — that's fine.
- **Database tables not renamed**: `goal_templates`, `composite_performance_tests`, `cpt_sessions` are unchanged. SQL queries, RLS policies, and migrations all keep working. Renaming tables would have meant a multi-step migration with potential for downtime — way too much risk for cosmetic gain.
- **Slight inconsistency**: in places where the old short-form "CPT" appeared in copy, I replaced with "APA". So you'll see "APA Sessions" but the URL is `/cpt-sessions`. Nobody types URLs.
- **Director sidebar isn't grouped**: Q7 = "admin only", per your spec. If you want director's sidebar grouped too later, we can do that in a small follow-up.

---

## Next phase candidates

- **Apply same group structure to director sidebar** if you want consistency across admin/director
- **Phase 8 (notifications)**: still gated on Resend signup
- **Apple Health webhook**: separate scope conversation
