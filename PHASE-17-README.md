# MESA v2 — Phase 17: Coach's Corner

**Status:** Ready to deploy
**SQL migration required:** `0022_phase17_coachs_corner.sql` — **run this BEFORE deploying code.**

A new module where coaches and directors post video links organized by date. Players and parents watch in-app. Players can mark videos as watched (honor system); coaches see who has.

---

## How it works

### Coach / director / admin perspective
1. Click **Coach's Corner** in the sidebar (new top-level item)
2. See all videos grouped by date, most recent first
3. Click **+ Post video** → modal with date picker (defaults to today), title, URL, optional description
4. Paste a YouTube, Vimeo, or Hudl URL → save → it appears in the list
5. On any existing video: **Edit** or **Delete** buttons inline
6. Click any video to open the detail page → see embedded player + a sidebar showing **who watched / who hasn't** out of your active athletes

### Player perspective
1. Click **Coach's Corner** in the sidebar
2. Browse by date — most recent at top
3. **"Jump to date"** picker at the top to navigate to specific days
4. Click any video → opens detail page with embedded player
5. Below the player: **Mark as watched** button → toggles your watched state
6. Watched videos show a sage **"Watched"** badge on the list view

### Parent perspective
- Same browsing experience as players
- **Per Q7 = A: parents do NOT see watched/unwatched status** for their child. They see videos like everyone else but no per-child tracking display.

### Unread badge on the sidebar
- When new videos are posted that you haven't seen, the **Coach's Corner** sidebar item shows a small red count badge
- Opening the page resets your "last seen" timestamp, clearing the badge until new videos arrive

---

## What's NOT in this phase

- **No auto-detect viewing** (Q2 = A confirmed). Honor system only — player clicks "Mark as watched". No iframe API hooks, no playback time tracking.
- **No comments / discussion** (Q10 = A). Coach's Corner is one-way broadcast.
- **No per-team scoping** (Q5 = A). Every signed-in user sees every video. If your academy grows past one team and wants U14/U16/etc. segmentation, that's a future addition.
- **No notifications when videos posted** (Q11 = C compromise). Sidebar badge only — no email or push. Phase 8 / Resend is still deferred.
- **No file uploads** (Q1 = C). Only URL-based: YouTube, Vimeo, Hudl. No video hosting in MESA itself.
- **No "Released" gating like workouts.** Videos appear immediately when posted; coach can pre-date by setting a past for_date, or future-date by setting a future for_date (no auto-hide of future-dated videos in this phase — they appear in the list with the future date label).

---

## Supported video sources (Q1 = C)

| Source | URL patterns accepted | Embed reliability |
|---|---|---|
| **YouTube** | `youtube.com/watch?v=ID`, `youtu.be/ID`, `youtube.com/embed/ID`, `youtube.com/shorts/ID` | Public videos: always works |
| **Vimeo** | `vimeo.com/ID`, `player.vimeo.com/video/ID` | Public videos: always works; password-gated: won't embed |
| **Hudl** | `hudl.com/video/ID`, `hudl.com/v/ID`, `hudl.com/video/3/<TEAM>/ID` | **Only public-shared videos embed.** Private team-account videos won't render in the iframe — UI shows an "Open in Hudl" fallback link |

Strict validation (Q12 = B): any URL outside these patterns is rejected at submit time with an error.

---

## Files added/changed

### New
- `supabase/migrations/0022_phase17_coachs_corner.sql`
- `lib/video-url.ts` — URL parser/validator, embed-URL builder
- `lib/coachs-corner.ts` — server-side data loaders
- `app/dashboard/coachs-corner/page.tsx` — list route
- `app/dashboard/coachs-corner/CoachsCornerListClient.tsx` — list UI (post / edit / delete modal, "jump to date" picker)
- `app/dashboard/coachs-corner/[id]/page.tsx` — detail route
- `app/dashboard/coachs-corner/[id]/VideoPlayerWithWatch.tsx` — embedded iframe player + mark-watched toggle
- `PHASE-17-README.md`

### Modified
- `lib/supabase/types.ts` — `Profile.last_seen_coachs_corner_at`, `CoachsCornerVideo`, `CoachsCornerView`, `CoachsCornerProvider` types
- `app/actions.ts` — 5 new server actions (98 → 103)
- `app/dashboard/layout.tsx` — computes Coach's Corner unread count, passes to AppShell
- `components/layout/AppShell.tsx` — accepts `coachsCornerUnread`, adds Coach's Corner item to all 6 roles' sidebars, new `video` icon
- `components/layout/SidebarNav.tsx` — `NavItem` accepts optional `badge` prop and renders a small crimson count pill

### Files to delete from GitHub: none

### Action count: 98 → 103 (+5)
- `createCoachsCornerVideo` — staff posts a new video, validates URL
- `updateCoachsCornerVideo` — staff edits any field, re-validates URL
- `deleteCoachsCornerVideo` — staff deletes (cascades to watch records)
- `markCoachsCornerWatched` — student toggles their own watched state
- `touchCoachsCornerLastSeen` — bumps profile timestamp when user opens the page (clears unread badge)

---

## Deploy

### Step 1: Run migration 0022 in Supabase SQL Editor (FIRST)
1. Supabase Studio → SQL Editor
2. Open `supabase/migrations/0022_phase17_coachs_corner.sql`
3. Paste into a new query, Run
4. Creates 2 tables (`coachs_corner_videos`, `coachs_corner_views`), 1 column (`profiles.last_seen_coachs_corner_at`), 5 RLS policies, 4 indexes. Idempotent.

### Step 2: Push code to GitHub
1. Unzip `mesa-v2-phase-17-clean.zip`
2. Upload contents to GitHub via Add file → Upload files (replace conflicts)
3. Commit: "Phase 17: Coach's Corner"
4. Vercel auto-deploys ~90s

### Step 3: Verify

**As coach / director:**
1. Sidebar now has **Coach's Corner** with the camera/video icon
2. Click → land on the list (empty if first time)
3. Click **+ Post video** → modal opens
4. Try pasting a random URL (e.g. `https://example.com`) → see error "URL must be a YouTube, Vimeo, or Hudl link"
5. Paste a real YouTube link (e.g. `https://www.youtube.com/watch?v=dQw4w9WgXcQ`) → save → appears in list
6. Click the video → detail page opens with embedded YouTube player
7. Sidebar on right shows **"Watched · 0 of N"** where N is your active student count, with a "Not yet watched" list

**As student:**
1. Sidebar shows **Coach's Corner** with a **(1)** badge (since a video was just posted that you haven't seen)
2. Click → badge clears (last-seen bumped)
3. Click the video → detail page opens, embedded player works
4. Below the player: **"When you've watched, tap below to let your coach know."** + **Mark as watched** button
5. Click → button flips to **Unmark**, sage check appears
6. Go back to the list → video shows green **"Watched"** badge

**As parent:**
1. Same browsing experience as student
2. **No "Mark as watched" button** appears on the detail page
3. No watched/unwatched indicators anywhere

**As coach (after student marks watched):**
1. Reopen the detail page
2. Sidebar now shows **"Watched · 1 of N"** with the student's name + date

**URL parser edge cases to try:**
- `youtu.be/dQw4w9WgXcQ` → works
- `https://vimeo.com/123456789` → works
- `https://www.hudl.com/video/abc123` → works (but if it's a private team video, the iframe will be blank; the "Open in Hudl" fallback link below the player handles that)
- `https://example.com/video.mp4` → rejected
- `youtube.com/watch?v=` (missing ID) → rejected
- Plain text "youtube" → rejected (no protocol)

---

## Security model

| Action | Page guard | RLS |
|---|---|---|
| Anyone signed-in reads videos | `requireProfile` | "CCVideos: signed-in read" allows `auth.uid() is not null` |
| Staff (admin/director/coach) creates/updates/deletes videos | `requireRole('admin','director','coach')` | "CCVideos: staff writes" |
| Trainer/student/parent attempts to create | Action's `requireRole` rejects | RLS rejects (not in role list) |
| Student reads their own watch records | `requireProfile` | "CCViews: student reads own" via `is_self_student` |
| Coach/director/admin reads all watch records | (just queries `buildVideoWatchersData`) | "CCViews: staff reads all" |
| Parent attempts to read watch records | (no UI path) | RLS rejects (parent isn't student-self or staff with role in list) |
| Trainer attempts to read watch records | (no UI path) | RLS rejects (trainer not in staff list for this table) |
| Student writes their own watch record | `requireRole('student')` | "CCViews: student writes own" via `is_self_student` |

Trainer is intentionally excluded from watch-records visibility per the Q1 scope. They see videos (they're signed in) but not the per-player watch state. If you want to extend trainer visibility later, add `trainer` to the `staff reads all` policy — one-line change.

---

## Known limits / cosmetic notes

- **Hudl embeds depend on video privacy.** Private team videos won't render in the iframe. Users see a "sign in to Hudl" message + a fallback link to open externally. If your academy uses Hudl heavily with private team content, the embed feature is degraded.
- **No file size, upload, or transcoding.** This is a URL-aggregator, not a video host. If you want to host videos in MESA itself, that's a much bigger feature (Supabase Storage, signed URLs, bandwidth costs).
- **No comments or reactions.** One-way broadcast.
- **Watched status is honor-based** — players can mark watched without actually watching. Coach has to ask in practice if accountability matters.
- **The unread badge counts ALL videos posted since you last visited the page**, even if you've already watched some individually. The badge is a "new posts" indicator, not a "videos you haven't watched" indicator.
- **The unread badge caps at 99 for display sanity.** If 100+ videos are posted between your visits, you'll see "99" not "100".
- **No way to bulk-mark as watched.** Player watches videos individually.
- **No way to filter by poster.** All videos from all coaches in one list.
- **No video preview thumbnails in the list view.** Just title + provider + description. Could add provider-API thumbnail fetching later but adds external calls.
- **`for_date` is stored as `date` (no time component).** Multiple videos on the same date sort by `created_at` (most recently posted first within the day).
- **Editing a video's URL re-validates** but doesn't change `embed_id` history. Once a player has watched, their watch record stays even if the coach later changes the URL.
- **Deleting a video cascades to watch records.** No undo. The confirm prompt is the only safety.
- **No academy-wide "broadcast" notification when video posted** — coaches typically mention it in practice or via separate channels. Resend integration could add this later.
- **The "Jump to date" picker uses HTML5 `<datalist>`** to suggest dates that have content. Browser support is universal but the UX differs slightly (Chrome shows a dropdown, Safari is more subtle).
- **Trainer's existing "Athletes → Nutrition" sidebar group is unaffected.** Coach's Corner sits separately as a top-level item.

---

## Suggested next steps

- **Per-team scoping** — tag videos with a team label so U14/U16 don't see each other's content
- **Notifications via Resend** (Phase 8 dependency) — "New video posted in Coach's Corner"
- **Auto-detect playback** via YouTube/Vimeo iframe APIs — postMessage hooks to record actual viewing
- **Comments / Q&A** — players ask questions per video; coach responds
- **File uploads** to Supabase Storage — host videos directly in MESA
- **Video preview thumbnails** — fetch from YouTube/Vimeo APIs for richer list view
- **Bulk import** from a YouTube playlist
- **Search / tag system** — find old videos about specific topics ("backcheck", "powerplay")
- **Required-viewing flag** — coach marks a video as required, dashboard shows it prominently to players who haven't watched
- **Phase 8 notifications via Resend** — still gated on signup
