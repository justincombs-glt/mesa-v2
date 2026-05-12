# MESA v2 — Phase 15c: Barcode Scanner + Open Food Facts

**Status:** Ready to deploy
**No SQL migration required.** All work is frontend.
**New npm dependency**: `@zxing/browser@^0.1.5` — Vercel auto-installs on deploy.

This phase adds a barcode scanner to the nutrition log flow. Students and parents can now scan a product's UPC with their phone camera, get the calorie data auto-populated from Open Food Facts, and confirm-then-save. Manual entry remains the path for products that don't scan or aren't in the database.

---

## How it works

### From the user's perspective
1. Open `/dashboard/nutrition` (or `/dashboard/family/[studentId]/nutrition`)
2. Tap "+ Log"
3. New big "📷 Scan a barcode" button at the top of the log modal
4. Tap it → camera modal opens, asks for camera permission (first time only)
5. Aim at the barcode → on detection, modal closes and log modal repopulates with the product name + calorie count
6. **Review the parsed data** — name and calories are editable
7. Tap "Log entry" to save

### Fallback paths inside the scan modal
- **Camera denied or unavailable** → error message + "Try again" button + manual UPC text field still available below
- **Type UPC manually** → numeric input, "Look up" button calls OFF directly
- **Skip — type it in** → closes scan modal, returns to log modal in plain manual-entry mode
- **Product not in OFF** → log modal still opens; user types name + calories manually
- **Product found but no calorie data** → log modal pre-fills the name from OFF; user types calories
- **Product found with calories per 100g but no per-serving** → uses per-100g with an explicit "you may want to adjust for your actual portion" note

---

## Open Food Facts integration

- **Endpoint**: `https://world.openfoodfacts.org/api/v2/product/{barcode}.json`
- **No auth** required for reads
- **No API key** needed
- **Free** — community-maintained nonprofit database
- Sends a custom User-Agent header: `MESA-Hockey-Academy/1.0 (https://mesa-v2-five.vercel.app)` (browsers may strip this; harmless if so)
- Called directly from the browser (Q8 = A — no server proxy)
- **In-memory cache** for the session (Q3 = B) — same barcode scanned twice doesn't re-hit OFF in the same tab
- Calorie source preference: `energy-kcal_serving` first, falls back to `energy-kcal_100g` with a visible "per 100g" warning to the user

---

## Files added/changed

### New
- `lib/openfoodfacts.ts` — OFF lookup helper, in-memory cache, response parsing
- `components/nutrition/BarcodeScanModal.tsx` — sub-modal with camera + manual UPC fallback
- `PHASE-15C-README.md`

### Modified
- `package.json` — added `@zxing/browser ^0.1.5` dependency
- `components/nutrition/NutritionTracker.tsx` — log modal now has a "Scan a barcode" button, controlled inputs that the scanner can pre-populate, and integrates the BarcodeScanModal as a sub-modal

### Files to delete from GitHub: none

---

## Deploy

### Step 1: Push code to GitHub
1. Unzip `mesa-v2-phase-15c-clean.zip`
2. Upload contents to GitHub via Add file → Upload files (replace conflicts)
3. **Critical**: make sure `package.json` is included in the upload — Vercel needs to see the new dependency
4. Commit: "Phase 15c: barcode scanner + Open Food Facts"

### Step 2: Vercel auto-deploys
Vercel runs `npm install` on every deploy, so `@zxing/browser` is installed automatically. No manual npm step needed. Watch the build log if you want to see the install land.

### Step 3: Verify

**As a student or parent on a mobile device (best test):**
1. `/dashboard/nutrition` → "+ Log"
2. Tap the new "Scan a barcode" button
3. **Allow camera permission** when prompted (one-time browser prompt)
4. Aim at any UPC — a granola bar, a sports drink, anything in your kitchen
5. On detection, the scan modal should close and the log form should fill with product name + calorie estimate
6. Review and adjust if needed (e.g., "Clif Bar Builders Bar Chocolate Mint" → "Clif Bar")
7. Tap "Log entry" — appears in today's list

**As a student on desktop (camera-less test):**
1. Same flow, click "Start camera"
2. Browser will likely fail (no camera or denied) → error message displayed
3. Use the manual UPC entry below — type a known UPC like `722252100023` (Clif Bar) → "Look up"
4. Form pre-fills with the OFF data

**As a student in an environment with OFF unreachable:**
1. Same flow — manual UPC entry returns an error after timeout
2. Click "Skip — type it in" → returns to log modal in pure manual mode

---

## Browser compatibility

| Browser | Scanner works? |
|---|---|
| iOS Safari 16+ | Yes (with camera permission) |
| iOS Safari < 14.3 | No (no `getUserMedia` support) |
| iOS Chrome | Yes on iOS 14.3+ — uses WebKit under the hood |
| Android Chrome | Yes |
| Android Firefox | Yes |
| Desktop Chrome | Yes if device has a webcam |
| Desktop Safari | Yes |
| Desktop Firefox | Yes |

If the camera fails for any reason, the manual UPC entry below is always available, and the "Skip — type it in" button is always available.

---

## Known limits / caveats

- **Open Food Facts coverage is uneven.** Brand-name products are well-covered; store-brand items often missing. European products have better coverage than US. When a UPC isn't found, the user gets clear "not found, enter manually" UX.
- **OFF community data accuracy varies.** A user-contributed calorie value may be wrong. The confirm-before-save flow gives the user a chance to spot-check against the package.
- **`energy-kcal_serving` is missing more often than `energy-kcal_100g`.** When we fall back to 100g, the UI clearly labels this so the user knows they may need to adjust based on actual portion size.
- **The User-Agent header** we set may be stripped by some browsers. OFF doesn't actively block this; their guidance just asks apps to identify themselves. Harmless either way.
- **In-memory cache only.** Reloading the page clears the cache. If you want a more persistent cache (across sessions, across users), that's a future addition — at MESA's scale it's not worth the complexity now.
- **No barcode database in MESA itself.** Each scan goes to OFF directly. We're not building a local cache or favorites list (Q4 = A confirmed). If a player frequently eats the same Clif Bar, they re-scan it each time — fast enough not to matter.
- **The camera UI is a takeover within the modal.** It doesn't go full-screen. The crosshair frame is centered. On phones in portrait orientation, this works well; landscape is acceptable but awkward.
- **Vibration / haptic on scan**: not implemented. Could add `navigator.vibrate(50)` on detection if you want tactile feedback.
- **No torch / flashlight toggle.** zxing supports `controls.switchTorch()` on devices with a flashlight; we don't wire that up here.
- **Sound on scan**: not implemented.
- **Continuous scanning**: the modal scans continuously and stops on first detection. There's no "scan multiple items" flow — each log entry is a separate open-scan-confirm-save cycle.
- **Trainers don't get the scanner.** They're view-only per Phase 15b. The log modal doesn't appear in their UI at all.

---

## Performance notes

- `@zxing/browser` is ~200KB minified. It is **dynamically imported** inside `handleStartScan` so the initial bundle of `/dashboard/nutrition` doesn't include it. Users who never tap "Scan barcode" never download zxing.
- OFF responses are typically 1-3KB and resolve in <500ms. The session cache means repeat scans are instantaneous.
- The camera preview runs at the device's default video resolution. On modern phones this is 1080p or higher; zxing handles the frame analysis at reasonable framerates.

---

## Safety still in force

All Phase 15a + 15b safeguards remain:
- Calorie floor warning on goal setting
- Shame-free UI throughout
- Educational copy at the top of each nutrition page
- Trainer view-only access
- Coach / director / admin still have no access
- Student under 16 still can't self-set goals
- Full history deletion still available

The barcode scanner is convenience layer only. It doesn't loosen any access controls or change the data model.

---

## Suggested next steps

- **Phase 8 notifications via Resend** — still gated on signup
- **Practice plan templates** leveraging the Phase 13 drill library
- **Self-create workouts** for students (deferred from Phase 9)
- **Coach-side review templates** for the Phase 14 bullet notes
- **Macros tracking** (protein/carbs/fat) — Phase 15a punted on this. The OFF response includes macros if you want them
- **Recent items quick-add** — show the player's last 10 scanned items as one-tap "log again" buttons for repeat foods
- **Apple Health webhook** — write nutrition + workout data back to HealthKit; long-deferred
