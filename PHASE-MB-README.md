# MESA v2 — Phase Mb: Mobile Workout Logger

**Status:** Ready to deploy
**No SQL migration required.** Pure frontend addition — uses existing `upsertWorkoutSet` / `deleteWorkoutSet` actions.

A dedicated mobile-first workflow at `/dashboard/workouts/[id]/mobile` for trainers logging sets at the gym. Optimized for thumb-driven entry: chip pickers for reps and RPE, decimal keyboard for weight, save-on-Next-set, and persistent set history with a "Repeat last" shortcut.

This phase builds on Phase Ma's responsive foundation — without that, the modals and inputs would be cramped on phone.

---

## What shipped

### New route
`/dashboard/workouts/[id]/mobile` — accessible to admin / director / trainer.

### Entry point (Q1 = D)
The desktop workout detail page (`/dashboard/workouts/[id]`) gets a "Mobile mode →" button in its page header (with a phone icon). Trainer taps it to switch into the focused logger. The desktop page is unchanged otherwise; both modes coexist.

Trainers can also bookmark the `/mobile` URL directly on their phone home screen.

### Layout
1. **Top bar**: ← back arrow exits to desktop view + workout title + date/time. Not sticky (avoids stacking with AppShell hamburger top bar on phone).
2. **Exercise pills (sticky)**: scrollable horizontal row of all exercises in the workout, with index "1/4" prefix. Tap to jump. Active exercise highlighted with ink fill.
3. **Athletes header**: "Athletes · 6/6" plus a "Hide absent" checkbox toggle (Q2 = C).
4. **Athlete cards**: vertical stack (Q4 = A). Each shows jersey + name + set count summary. Tap to expand the set-entry form.
5. **Footer button (sticky)**: "Next exercise →" button at bottom, advancing through the exercises sequentially (Q3 = C complements the pills above).

### Athlete card behavior
- **Set history** (Q7 + Q8 = D): always visible if any sets logged. Each row shows "Set N · 185 lb · 8 reps · RPE 7" with a small trash button on the right. Tap trash → confirm → set deleted. No inline editing — for that, trainer goes back to desktop.
- **Expand to log**: tap card header → form appears.
- **Form** (Q5 = A, three rows stacked):
  - **Weight (lb)**: `inputmode="decimal"`, step 0.5, large 12px-tall input
  - **Reps**: chips for 3, 5, 8, 10, 12, 15 + "Other…" button. Tapping "Other…" replaces the chips with a numeric input + "Use chips" link to switch back. (Q6 = A strength preset)
  - **RPE**: chips for 1-10 (compact)
- **Repeat last** (Q7 = C): if the athlete has at least one prior set, a "↻ Repeat last" button appears in the form header. Tap to pre-fill weight + reps + RPE from the most recent set. Useful for "same again" sets.
- **Mark absent**: button in form header that flags this athlete as absent — they get faded and hide if "Hide absent" toggle is on. Local state only (not persisted to attendance, since this workout's mobile mode doesn't currently double as attendance).
- **Next set →** (Q9 = B): primary button. Saves the set, clears the form fields, keeps the card expanded so the trainer can immediately log the next set. No auto-advance to the next athlete.
- **Clear**: secondary button to reset the form without saving.

### Validation
- Empty form → "Enter at least one value" error
- Invalid Other-reps (negative or NaN) → error
- Weight, reps, RPE are all individually optional — partial sets are allowed (e.g. RPE-only "warm-up" set)

### Read-only / archived seasons (Q10 = A)
If the season is archived, the form does not render. Set history still shows, athlete cards still expand to show the history, but no new sets can be logged and no deletes are allowed. "Next exercise" navigation still works.

### Empty states
- No athletes on roster → empty card "Set it up on desktop first" with a link to the desktop view
- No exercises planned → same empty state
- All athletes hidden by "Hide absent" toggle → "No athletes to show. Toggle off Hide absent…"

### Other notes
- Each card refresh uses Next.js `router.refresh()` after save/delete so the set history updates immediately (no full reload)
- Footer "Next exercise" button disables when on the last exercise
- Smooth scroll-to-top on exercise switch

---

## Files added/changed

**New:**
- app/dashboard/workouts/[id]/mobile/page.tsx (server)
- app/dashboard/workouts/[id]/mobile/MobileWorkoutLogger.tsx (client)
- PHASE-MB-README.md

**Changed:**
- app/dashboard/workouts/[id]/page.tsx — added "Mobile mode →" button in PageHeader actions
- app/globals.css — appended `.scrollbar-hide` utility class for the exercise pills row

**Actions:** 86 total. **No new actions.** Reuses `upsertWorkoutSet` and `deleteWorkoutSet` from prior phases.

---

## Database

**No migration.** Pure frontend.

---

## Deploy steps

1. Unzip `mesa-v2-phase-mb-clean.zip`
2. GitHub → `mesa-2` repo → Add file → Upload files → drag contents, replace conflicts
3. Commit: `Phase Mb: Mobile workout logger`
4. Vercel redeploys in ~90s
5. Hard refresh on phone

---

## How to test on a real phone

### Prerequisites
- A workout exists in the current season with at least 2 exercises and at least 2 athletes on the roster
- Sign in as admin / director / trainer

### 1. Find the entry point
1. On phone, open the deployed URL → sign in
2. Navigate to Off-Ice Workouts (sidebar via hamburger drawer from Phase Ma)
3. Open any workout
4. PageHeader on desktop view shows "Mobile mode →" button on the right side
5. Tap it → routes to `/mobile`
6. New compact view loads with workout title at top + back arrow

### 2. Exercise pills
1. Pills row is visible and horizontally scrollable
2. First pill is highlighted (filled with ink color)
3. Tap a pill in the middle of the list → that exercise becomes active
4. Athletes below update to show that exercise's history

### 3. Log a first set
1. Tap any athlete card (the whole header row)
2. Card expands to show form
3. Tap Weight input → number keyboard appears (NOT alphabet)
4. Type 185 → focus next field
5. Tap "8" reps chip → highlighted
6. Tap "7" RPE chip → highlighted
7. Tap "Next set →" → form clears, history above shows "Set 1 · 185 lb · 8 reps · RPE 7"
8. Card still expanded — type 195 weight, tap 6 reps, tap 8 RPE, Next set → second set appears in history

### 4. Repeat last
1. With at least one set in history, "↻ Repeat last" button shows in form header
2. Tap → form auto-fills with the previous set's values
3. Tap "Next set →" without changing anything → that set duplicates

### 5. Other reps
1. Open a fresh card form
2. Tap "Other…" → chips disappear, numeric input + "Use chips" link
3. Type 7 → tap "Use chips" to switch back if needed
4. Save → "7" reps preserved correctly

### 6. Delete a set
1. In any athlete's set history, tap the trash icon on a set row
2. Confirm dialog → tap OK → set disappears from history
3. Set numbering: existing sets' set_number stays the same (gaps possible). This is intentional — set numbers are immutable identifiers.

### 7. Next exercise
1. Tap "Next exercise →" in footer → advances to exercise 2
2. Pills update, "1/N" → "2/N"
3. Athlete cards now show set history for exercise 2 (likely empty if you haven't logged any yet)
4. On the last exercise, "Next exercise" button is disabled

### 8. Hide absent
1. On any athlete card form, tap "Mark absent" in the header
2. That athlete gets visually dimmed
3. Toggle "Hide absent" checkbox at top → that athlete disappears from the list
4. Toggle off → they reappear

Note: "absent" is a local-state flag only. It doesn't write attendance to the database. You'd still record actual attendance via the desktop workflow if needed.

### 9. Back to desktop
1. Tap the ← back arrow in the top bar
2. Returns to `/dashboard/workouts/[id]` (desktop view)
3. The same set data is visible in the desktop's per-set grid

### 10. Archived season
1. Switch to an archived season (via season picker)
2. Open any workout → tap "Mobile mode →"
3. Cards expand on tap but show history only — no form, no delete, no "Next exercise"

---

## iOS-specific gotchas

- **Keyboard pushing content up**: when you tap weight input, iOS Safari may scroll the page to keep the input visible. The form is designed to handle this — chips for reps/RPE remain reachable above the keyboard.
- **Tap delays**: the chip buttons use `active:` Tailwind states, which on iOS may have a ~300ms tap delay. If it feels sluggish, double-tap-zoom is the iOS culprit. Most users won't notice.
- **Pull-to-refresh**: iOS Safari's pull-to-refresh at the top of the page might trigger if the trainer pulls down hard. Doesn't conflict with anything.
- **Scroll bounce**: the sticky exercise pills will momentarily detach during overscroll bounce. Visual hiccup only; layout settles.
- **"Add to Home Screen"**: if a trainer adds the URL to their home screen, the bookmarked URL is what they'll launch. Make sure they bookmark `/dashboard/workouts/[specific-id]/mobile` for the right workout, OR `/dashboard/workouts` to get to the list.

---

## Known limits

- **No auto-attendance**: marking an athlete absent in mobile mode is local-only. If you want it to write to `attendance` records, that's a follow-up.
- **No editing previous sets**: only delete + re-add. Editing requires switching to desktop (Q8 = D was the choice).
- **No notes per set**: trainer can't add a free-text note to a set on mobile (set history shows summary only). Notes can be added on desktop.
- **No bulk-clone all athletes**: trainer can't say "everyone log the same set." Each athlete is logged individually.
- **No undo on delete**: trash button asks for confirmation but no undo after — set is gone, must be re-added.
- **No keyboard shortcuts**: phone-only flow, no Tab key or Enter shortcuts.

---

## What's next (potential)

This wraps up the explicit Mobile work (Phases Ma + Mb). Possible follow-ups:

- **Phase 8**: Notifications / Resend (still gated on you signing up at Resend)
- **PWA layer**: app manifest + service worker for "Add to Home Screen" feeling more app-like on iOS/Android
- **Mobile attendance flow**: marking attendance on phone for practices and games, with the same chip-style UI
- **Mobile CPT session entry**: similar workflow but for performance test sessions
