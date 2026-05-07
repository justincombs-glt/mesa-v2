# MESA v2 — Phase Ma: Mobile Responsive Audit

**Status:** Ready to deploy
**No SQL migration required.** This is a pure frontend / CSS update — nothing in the database changes.

The site now works properly on phones. Sidebar collapses to a hamburger drawer, modals become bottom-sheets, tables become card-per-row, and numeric inputs ask for a number keyboard.

This is the first of two mobile phases. Phase Mb (next) adds a dedicated mobile workout logger optimized for trainers logging sets at the gym.

---

## What shipped

### Hamburger drawer (replaces horizontal-scroll mobile nav)
On phones (< 768px wide):
- Top bar with hamburger button + brand
- Tap hamburger → slide-in drawer from left with backdrop
- Drawer contains: Season selector, full nav links, user identity block, sign-out
- Closes on: hamburger tap, backdrop tap, Escape key, link click, viewport resize past 768px
- Body scroll locked while drawer is open

On tablets and desktops (≥ 768px), the original sidebar layout is unchanged.

### Modal sheet style on phones
Phase 6a/6b/7b modals (Add Child, Save Review, Add Goal, etc.):
- On phone: docked to bottom of screen with rounded top corners (bottom-sheet pattern)
- On phone: scrollable interior up to 92vh tall — long forms work
- On phone: larger 40px close button (was 32px) for thumb-friendly tap
- Smaller padding on phone (5px → 8px on desktop) so more content fits
- Title text sized down (text-xl phone vs text-2xl desktop)

### PageHeader tighter spacing on phones
- Smaller title size (text-2xl phone vs text-4xl desktop)
- Less vertical padding (mb-6 phone vs mb-10 desktop)
- Action buttons can wrap below title on narrow viewports

### Tables → cards on phone (Q8 = A)
Four tables now have a mobile cards version sitting alongside the desktop table. Both are in the source — Tailwind switches between them at the `md:` breakpoint.

1. **Insights test trends** (`InsightsView`): each test renders as a card with title, sparkline, and 4-up grid of Baseline/Latest/Δ/N
2. **Game stats — skater** (`GameDetailClient`): each player renders as a card with jersey + name, then 6-up grid of G/A/+−/Shots/PIM/TOI; tap to edit (mobile edit form is a 3-col grid instead of 6)
3. **Game stats — goalie**: card per goalie with 4-up grid Saves/SA/GA/SV%
4. **CPT bulk-entry grid** (`CptSessionDetailClient`): each student renders as a card with their name at top, then a stack of test-name + numeric input pairs. Tapping any input lets the trainer edit and save (same onBlur autosave behavior). Replaces the desktop's wide-grid sticky-column experience.
5. **Snapshot test trends** (review detail `ReviewDetailClient`): each test card with 4-up grid

### iOS auto-zoom prevention
Bumped `.input-base` font-size from 15px → 16px in `globals.css`. This single change prevents iOS Safari from zooming the page when an input is focused — a notorious phone footgun that makes forms feel broken.

### Numeric keyboard on every numeric input
Audited every `type="number"` in:
- All trainer pages (workouts, exercises, workout-plans, cpt-sessions)
- All coach pages (practices, activities/games)
- All admin/director pages (drills, goal-templates, performance-tests, etc.)
- Specifically the dynamic input cells in CPT grid and game stats edit rows

Every one now has `inputMode="decimal"` so iOS Safari shows the number keyboard instead of the alphabet keyboard.

### Form grids responsive
Modal forms with 3-column grids (e.g., Date/Time/Duration when scheduling a practice) now collapse to single-column on phones. Adapted across PracticesClient, PracticeDetailClient, ActivitiesClient.

### Touch targets
The base button classes (`.btn-primary`, `.btn-secondary`) were already 44px tall. Confirmed during audit — not changed.

---

## What is NOT in Phase Ma (deferred)

- **Dedicated mobile workout logger** at `/dashboard/workouts/[id]/mobile` with exercise-first workflow, hybrid keyboard, save-on-Next-set — that's Phase Mb (next)
- **PWA manifest / "Add to home screen" icon** — could be a small follow-up
- **Push notifications** — Phase 8 (notifications)
- **Native iOS/Android apps** — not on the roadmap
- **Audit of admin/director-only pages** — they were intentionally out of scope (Q1 = trainer + coach + student); admin/director tasks like creating goal plans, managing rosters, drill libraries remain desktop-leaning. They mostly still work on a phone (forms render, modals work) — they just aren't optimized.

---

## Files added/changed

**New:**
- components/layout/MobileNavDrawer.tsx
- PHASE-MA-README.md

**Changed:**
- components/layout/AppShell.tsx — replaced horizontal-scroll mobile nav with `MobileNavDrawer`. Desktop sidebar is now in a `hidden md:flex` block.
- components/ui/Modal.tsx — bottom-sheet on mobile, scrollable, larger close target, smaller padding
- components/ui/PageHeader.tsx — tighter mobile spacing, smaller title on phone, action wrap
- app/globals.css — `.input-base` font 15px → 16px (iOS zoom fix)
- components/insights/InsightsView.tsx — cards-on-mobile for test trends section
- app/dashboard/activities/[id]/GameDetailClient.tsx — `StatCard` and `StatEditCard` for mobile; desktop table preserved
- app/dashboard/cpt-sessions/[id]/CptSessionDetailClient.tsx — student-card layout on mobile; `ResultCellInput` accepts `mobile` prop to render `<div>` instead of `<td>`
- app/dashboard/students/[id]/insights/reviews/[reviewId]/ReviewDetailClient.tsx — snapshot trends cards on mobile
- ~13 files: `inputMode="decimal"` added to every numeric input that didn't have it

**No actions changed.** No migration needed. 86 actions, 0 duplicates, no schema changes. Pure frontend work.

---

## Database

**No migration.** This phase is frontend-only.

---

## Deploy steps

### Just upload the source files
1. Unzip `mesa-v2-phase-ma-clean.zip`
2. GitHub → `mesa-2` repo → Add file → Upload files → drag contents, replace conflicts
3. Commit: `Phase Ma: Mobile responsive audit`
4. Vercel redeploys in ~90s
5. Hard refresh (or open Incognito on your phone)

---

## How to test on a real phone (recommended)

You said you'd test on a real phone. Here's what to look for. Open the deployed URL on your iPhone or Android in Safari/Chrome.

### 1. Hamburger drawer
1. Land on `/dashboard` — top bar should show a hamburger icon (☰) + the MESA brand
2. Tap the hamburger → drawer slides in from left with darkened backdrop behind it
3. Tap any nav link → drawer auto-closes and you navigate
4. Open it again, tap the backdrop → closes
5. Open it, press hardware back button (Android) → closes (or iOS swipe-to-dismiss)
6. Rotate phone to landscape — if width >768px, drawer auto-closes and full sidebar appears

### 2. Modals as bottom sheets
1. Sign in as parent → land on family page or home
2. Tap "+ Add child" → modal docks to bottom of screen with rounded top corners
3. Form is single-column, scrollable
4. Date input opens iOS native date picker
5. Tap the close X (top right) — easy to hit with thumb (40px target)
6. Try Save Review on insights page — same modal behavior

### 3. iOS zoom check
1. Open any page with form inputs (e.g., Add Child modal)
2. Tap a text input — page should NOT zoom in
3. Tap a number input — number keyboard appears (not alphabet)
4. Tap a date input — native date roller opens

### 4. Tables → cards
1. As trainer, open a CPT session that has students + tests
2. Each student appears as a card; tests stack within
3. Tap a value → number keyboard
4. Type a value → blur → green border flashes (saved)

5. As coach, open a game with skaters/goalies
6. Each player is a card; G/A/+−/Shots/PIM/TOI in a 6-col grid
7. Tap card → in-place edit form appears with input fields
8. Save → returns to card display with new values

### 5. Insights page
1. Any staff role: navigate to a student's insights page
2. Test trends section: each test is a card with sparkline + 4-up stats grid
3. Past reviews timeline: tappable rows
4. Tap a review → review detail page scrolls cleanly on phone

### 6. Long-form readability
- Page headers fit; no horizontal scroll
- Body text is readable at default zoom
- Buttons are large enough to tap reliably (44px is iOS guidance; primary/secondary buttons match)

---

## iOS-specific gotchas to watch for

A few things that only behave correctly on real iOS Safari (not in Chrome DevTools emulator):

- **Bottom nav obscuring content**: iOS Safari has a bottom URL bar that auto-hides on scroll. We don't add bottom-fixed elements, so no overlap.
- **100vh issue**: iOS Safari counts the URL bar as part of viewport, so `100vh` is actually larger than visible. The drawer uses `min-h-screen` only on the `aside` itself which doesn't have this issue. Modal max-height uses `92vh` which intentionally leaves a margin.
- **Date picker spinner**: iOS uses a wheel picker for `<input type="date">` — different from Android's calendar grid. Both work; just looks different.
- **Pull-to-refresh**: iOS fires this when scrolling at the top of the page. Doesn't conflict with anything.

---

## Known limits / things you might notice

- **Per-set workout logging on phone**: still uses the desktop grid (responsive) until Phase Mb ships the dedicated mobile logger. Trainer can use the existing UI on phone but it's not optimized for gym-floor use.
- **Goal-management plan detail**: editing goals works but the AddGoalModal has many fields; on phone it's a tall form. Functional but not great. Director task — accepted per Q1 = trainer/coach/student.
- **Some director-only pages** (drills, goal-templates, performance-tests) are not optimized. They render but assume desk use.
- **Sidebar tooltips** on hover — not applicable on phone (no hover). This is fine; the drawer shows full labels.

---

## Next phase (Mb)

- Dedicated mobile workout logger at `/dashboard/workouts/[id]/mobile` for trainers
- Exercise-first workflow (Q3 = A): pick exercise → log all athletes
- Hybrid keyboard (Q4 = D): chips for RPE + reps, decimal keyboard for weight
- Save on "Next set" button (Q5 = B)
- No offline support (Q6 = A)
