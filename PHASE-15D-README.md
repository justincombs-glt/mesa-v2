# MESA v2 — Phase 15d: Autocomplete Suggestions for Food Logging

**Status:** Ready to deploy
**No SQL migration required.** All work is server-action + frontend.

This phase adds a suggestion dropdown to the "What was it?" field in the nutrition log modal. As the player types, MESA shows their recently-logged foods that match — and tapping a suggestion fills both the name AND calorie count in one tap. When the player types something they've never logged before, an opt-in "Search Open Food Facts" footer offers a one-tap fallback.

---

## How it works (player's perspective)

1. Tap "+ Log" → log modal opens
2. **Tap the name field** — dropdown immediately shows your 5 most recently-logged items (Q7 = A)
3. **Start typing** — list filters to items whose words start with what you typed
   - "ba" → "Banana — 100 kcal", "Bagel — 280 kcal"
4. **Tap any suggestion** → name + calorie fields fill instantly (Q8 = A)
5. Adjust if needed (everything is still editable)
6. Tap "Log entry" to save

### When history doesn't match

7. Type something you've never logged — say "kombucha"
8. History dropdown is empty for that query
9. **A "Search Open Food Facts for 'kombucha'" link appears** below the input
10. Tap it → MESA hits OFF's search API, shows up to 5 branded matches with calorie data
11. Tap one → fills the form

---

## How it works (under the hood)

### History fetch
- New server action `getNutritionHistory(student_id)` returns the last 30 days of entries, deduplicated by name with the most recent calorie value per name (Q4 = B)
- Called once when the log modal opens (Q11 = A)
- Filtering happens entirely client-side
- Modal close → cache is discarded; next open re-fetches

### Filtering
- **Word-prefix match** (Q3 = B): the query matches an item if any whitespace-separated word in the item's name starts with the query (case-insensitive)
- `"ba"` matches `"Banana"`, `"Banana bread"`, `"Tyler's homemade banana smoothie"`
- Doesn't match `"Bourbon glazed chicken"` (no word starts with "ba")
- Top 5 results shown (Q6 = B)

### OFF fallback
- Triggers only when the player **explicitly taps** "Search Open Food Facts for '<query>'" — never automatically on keystroke (Q1 = D — opt-in)
- Endpoint: `https://world.openfoodfacts.org/cgi/search.pl?search_terms=<q>&json=1&page_size=5`
- Same User-Agent + in-memory cache treatment as the barcode scanner's lookup
- Filters out OFF results with no calorie data
- Per-100g results labeled `"per 100g — adjust for portion"`
- Network failures show "No matches in Open Food Facts" — never breaks the flow

### Access (unchanged)
- Same household-only scope as the rest of nutrition writes
- RLS enforces; `can_view_student` RPC check in the action is defense-in-depth
- Parents see their child's history (Q10 = A) — same as before for any nutrition operation

---

## Files added/changed

### New
- `components/nutrition/FoodAutocomplete.tsx` — controlled combobox with keyboard nav, history filtering, and OFF fallback button
- `PHASE-15D-README.md`

### Modified
- `lib/openfoodfacts.ts` — added `searchByText()` and `OffSearchResult` type
- `app/actions.ts` — added `getNutritionHistory` server action
- `components/nutrition/NutritionTracker.tsx` — log modal now fetches history on open, the name input is replaced with `<FoodAutocomplete>`

### Files to delete from GitHub: none

### Action count
96 → 97.

---

## Deploy

### Step 1: Push code to GitHub
1. Unzip `mesa-v2-phase-15d-clean.zip`
2. Upload contents to GitHub via Add file → Upload files (replace conflicts)
3. Commit: "Phase 15d: autocomplete suggestions for food logging"

### Step 2: Vercel auto-deploys
~90 seconds. No new dependencies. No migration needed.

### Step 3: Verify

**Best test (after logging some entries):**
1. Sign in as a student or as a parent viewing a child
2. Make sure the student has at least 3-5 entries logged in the past month (use Phase 15a manual entry or Phase 15c scanner)
3. Open the log modal
4. **Tap the name field** without typing → see "Recently logged" with up to 5 items
5. Type a letter or two → dropdown filters in real time
6. Tap a suggestion → both name and calorie fields fill
7. Adjust the calorie count if needed → save

**Fallback test:**
1. Open the log modal
2. Type something you've never logged — try "kombucha" or "kefir"
3. History section is empty
4. See "Search Open Food Facts for 'kombucha'" link
5. Tap → see OFF results (or "No matches")
6. Tap an OFF result → fills the form

**Keyboard test (desktop):**
1. Tap name field → dropdown opens
2. Press ↓ arrow → highlights first row
3. ↓ again → next row
4. Enter → selects highlighted row, dropdown closes, fields populated
5. Esc → closes dropdown without selecting

**Compatibility tests:**
1. With Phase 15c scanner: scan a barcode → form pre-fills → click into name field → autocomplete still works → can tap a suggestion to replace the scanner data (Q9 = A)
2. As parent on `/dashboard/family/[studentId]/nutrition`: same flow — sees their child's history (Q10 = A)
3. As trainer: irrelevant — trainers don't see the log modal at all (read-only)

---

## What did NOT change

- **No SQL changes.** Reads the existing `nutrition_entries` table.
- **No new dependencies.** Pure React + existing OFF integration.
- **Phase 15c barcode scanner** still works exactly the same — the autocomplete runs in parallel and either can populate the form.
- **Phase 15b trainer view** — trainer doesn't have the log modal, so autocomplete is moot for them.
- **All safeguards from Phase 15a/15b still in force.**

---

## Known limits / cosmetic notes

- **First-week emptiness.** New users have no history, so the dropdown is empty on focus and only shows the OFF fallback option once they start typing. By week 2-3 of logging, suggestions become useful.
- **30-day window means rare foods drop off.** If you ate quinoa once 45 days ago, it won't appear in suggestions. Easy to log it again (becomes recent), or use OFF search.
- **No fuzzy matching.** Typo "bnana" won't match "Banana" — the user gets an empty result and the OFF fallback button. By design (Q3 = B).
- **No frequency weighting.** A food eaten 10 times shows the same as one eaten once, in newest-first order. If you want "your favorites first" behavior, that's a future addition.
- **History is fetched per modal-open**, not cached at the page level. Opening the modal twice in a session fetches twice. Not a performance issue at MESA's scale (the result set is tiny), but worth noting.
- **OFF fallback uses the full-text search API**, which is reportedly less reliable than the barcode endpoint. Results can be hit-or-miss for niche items. Falls back gracefully to "no matches" when nothing comes back.
- **The "OFF search" footer is per-query.** Each new query resets the OFF state; the user has to tap "Search OFF" again for each new term they want to search. By design — avoids accidentally racking up network calls on every keystroke.
- **Suggestions show calorie value, not the original portion size context.** If the student logged "Banana - 2 medium - 200 kcal" once, it'll show up as "Banana - 2 medium — 200 kcal" since the name field captures whatever the player typed. Players can put context in the name.
- **Mobile keyboard interaction**: when the dropdown is open and the player scrolls, the dropdown stays positioned relative to the input. Generally works well on phones; if you find weird edge cases, the `position: absolute` on the dropdown is the place to look.

---

## Privacy note

The OFF fallback search ships the query text to a third-party server (Open Food Facts) on tap. The history-based suggestions are entirely local — your data never leaves MESA. If a household is privacy-sensitive, they can simply never tap the OFF search button. Their experience stays history-only.

---

## Suggested next steps

- **Frequency-weighted suggestions** — order history by usage frequency, not just recency
- **Favorites pinning** — let the player star foods they want at the top of suggestions
- **Quick re-log** — one tap on the dashboard to log "the same thing you ate yesterday at this time"
- **Apple Health export** — push nutrition data into HealthKit (long-deferred)
- **Macros** (protein/carbs/fat) — Phase 15a punted; OFF and history could both provide
- **Phase 8 notifications via Resend** — still gated on signup
