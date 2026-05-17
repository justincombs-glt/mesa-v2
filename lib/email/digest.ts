// ============================================================================
// Weekly digest content builder
//
// Phase 8c: given a profile and date range, builds the structured digest
// content for that user. The output shape is consumed by both the email
// template (lib/email/templates/digest.ts) and the dashboard preview.
//
// Recipient scoping (per Q2 = C):
//   - Athletes (role = 'student' or 'player'): personal digest covering
//     only their own activities + scheduled items.
//   - Parents (role = 'parent'): household digest covering every linked
//     student/player child in their family_links.
//   - Staff (admin/director/coach/trainer): no digest per Q5 = B. Callers
//     should skip staff roles before invoking this.
//
// "Empty" detection (per Q6 = C):
//   - If both past AND upcoming sections are empty for ALL athletes in scope,
//     return null. Caller skips sending.
//   - If at least one section has content for at least one athlete, send.
//
// Date math:
//   - Past = the calendar week just ended (Mon-Sun typically). We pass the
//     range_start/range_end in explicitly so the cron job and any dashboard
//     preview agree on the boundaries.
//   - Upcoming = the next 7 days starting "today".
//
// All queries respect existing RLS — we run with the service-role client
// passed in by the caller (the cron endpoint uses a service-role client to
// bypass RLS since the digest aggregates data across users).
// ============================================================================

// Loose type for the Supabase client. The strict generic types from
// @supabase/supabase-js diverge across versions and helper utilities (auth
// helpers, ssr helpers, plain JS), causing TypeScript variance errors when
// passing clients between modules. Treating the client as any here keeps the
// helpers callable from any caller — same pattern used by app/actions.ts.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = any;

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface AthleteDigest {
  student_id: string;
  student_name: string;
  past: {
    /** Workouts the athlete actually logged sets for (per-workout detail). */
    workouts_logged: Array<{ date: string; title: string | null }>;
    /** Practices the athlete was rostered into AND marked present for. */
    practices_attended: Array<{ date: string; title: string | null }>;
    /** Games the coach marked as reviewed (any reviewed_at in the range). */
    games_reviewed: Array<{
      date: string;
      opponent: string | null;
      our: number | null;
      opp: number | null;
    }>;
  };
  upcoming: {
    practices: Array<{
      date: string;
      time: string | null;
      title: string | null;
      drills: Array<{ title: string; duration_minutes: number | null }>;
    }>;
    workouts_released: Array<{ date: string; title: string | null }>;
  };
}

export interface DigestContent {
  /** Profile this digest is for. */
  profile_id: string;
  profile_email: string;
  profile_name: string;
  profile_role: 'student' | 'player' | 'parent';
  range_start: string;  // YYYY-MM-DD
  range_end: string;    // YYYY-MM-DD
  upcoming_end: string; // YYYY-MM-DD
  /** One entry per athlete in scope. Parents may have several. */
  athletes: AthleteDigest[];
}

// ----------------------------------------------------------------------------
// Public API
// ----------------------------------------------------------------------------

/**
 * Build the digest for one profile. Returns null if either:
 *   - profile is staff (digest skipped per Q5)
 *   - all athletes have empty past + upcoming sections (Q6)
 *   - profile has no athletes linked (parent without kids, athlete without
 *     own student row)
 */
export async function buildDigestForProfile(
  supabase: AnySupabaseClient,
  profileId: string,
  rangeStart: string,   // YYYY-MM-DD (e.g. last Monday)
  rangeEnd: string,     // YYYY-MM-DD (today / cutoff for "past")
  upcomingEnd: string,  // YYYY-MM-DD (today + 7d)
): Promise<DigestContent | null> {
  // Load the profile
  const { data: profRow } = await supabase
    .from('profiles')
    .select('id, email, full_name, role')
    .eq('id', profileId)
    .maybeSingle();
  if (!profRow) return null;
  const profile = profRow as { id: string; email: string; full_name: string | null; role: string };

  // Q5: staff skip
  if (!['student', 'player', 'parent'].includes(profile.role)) return null;

  // Resolve athletes in scope for this profile
  const athletes = await _resolveAthletesForProfile(supabase, profileId, profile.role);
  if (athletes.length === 0) return null;

  // Build per-athlete digest
  const athleteDigests: AthleteDigest[] = [];
  for (const a of athletes) {
    const ad = await _buildAthleteDigest(supabase, a, rangeStart, rangeEnd, upcomingEnd);
    athleteDigests.push(ad);
  }

  // Q6 empty check — skip the email if all sections are empty for all athletes.
  const anyContent = athleteDigests.some(
    (ad) =>
      ad.past.workouts_logged.length > 0 ||
      ad.past.practices_attended.length > 0 ||
      ad.past.games_reviewed.length > 0 ||
      ad.upcoming.practices.length > 0 ||
      ad.upcoming.workouts_released.length > 0,
  );
  if (!anyContent) return null;

  return {
    profile_id: profile.id,
    profile_email: profile.email,
    profile_name: profile.full_name || profile.email.split('@')[0],
    profile_role: profile.role as 'student' | 'player' | 'parent',
    range_start: rangeStart,
    range_end: rangeEnd,
    upcoming_end: upcomingEnd,
    athletes: athleteDigests,
  };
}

// ----------------------------------------------------------------------------
// Internal helpers
// ----------------------------------------------------------------------------

interface AthleteRef {
  id: string;          // students.id
  full_name: string;
}

/**
 * For athletes (student/player), return their own student row.
 * For parents, return all linked student rows via family_links.
 */
async function _resolveAthletesForProfile(
  supabase: AnySupabaseClient,
  profileId: string,
  role: string,
): Promise<AthleteRef[]> {
  if (role === 'student' || role === 'player') {
    const { data } = await supabase
      .from('students')
      .select('id, full_name')
      .eq('profile_id', profileId)
      .eq('active', true);
    return ((data ?? []) as AthleteRef[]);
  }
  if (role === 'parent') {
    const { data: links } = await supabase
      .from('family_links')
      .select('student_id')
      .eq('parent_id', profileId);
    const ids = ((links ?? []) as Array<{ student_id: string }>).map((l) => l.student_id);
    if (ids.length === 0) return [];
    const { data } = await supabase
      .from('students')
      .select('id, full_name')
      .in('id', ids)
      .eq('active', true)
      .order('full_name');
    return ((data ?? []) as AthleteRef[]);
  }
  return [];
}

/**
 * Build the per-athlete digest content. All queries scoped to this one student.
 *
 * Shape (per current design):
 *   PAST week
 *     - workouts_logged: list (date + title) — only workouts where this athlete
 *       actually logged at least one set in the range
 *     - practices_attended: list (date + title) — only practices where the
 *       attendance row shows attended = TRUE for this athlete in the range
 *     - games_reviewed: list (date + opponent + score) — games with
 *       reviewed_at falling in the range; this REPLACES "games played"
 *
 *   UPCOMING week
 *     - practices: list with header (date + time + title) + drills sub-list
 *     - workouts_released: list (date + title) — released workouts on
 *       this athlete's roster in the upcoming window
 *
 * Intentionally omitted (deferred to a future review feature):
 *   - goal updates / active goals
 *   - APA results
 *   - games played (only "reviewed" games appear, in past section)
 *   - upcoming games
 */
async function _buildAthleteDigest(
  supabase: AnySupabaseClient,
  athlete: AthleteRef,
  rangeStart: string,
  rangeEnd: string,
  upcomingEnd: string,
): Promise<AthleteDigest> {
  const today = new Date().toISOString().slice(0, 10);

  // Roster — every activity this athlete is on
  const { data: rosterRows } = await supabase
    .from('activity_students')
    .select('activity_id')
    .eq('student_id', athlete.id);
  const activityIds = ((rosterRows ?? []) as Array<{ activity_id: string }>).map((r) => r.activity_id);

  const workoutsLogged: AthleteDigest['past']['workouts_logged'] = [];
  const practicesAttended: AthleteDigest['past']['practices_attended'] = [];
  const gamesReviewed: AthleteDigest['past']['games_reviewed'] = [];
  const upcomingPractices: AthleteDigest['upcoming']['practices'] = [];
  const upcomingWorkoutsReleased: AthleteDigest['upcoming']['workouts_released'] = [];

  if (activityIds.length > 0) {
    const { data: acts } = await supabase
      .from('activities')
      .select('id, activity_type, occurred_on, starts_at, title, opponent, our_score, opp_score, released_at, reviewed_at, source_practice_plan_id')
      .in('id', activityIds)
      .gte('occurred_on', rangeStart)
      .lte('occurred_on', upcomingEnd);
    const acts2 = (acts ?? []) as Array<{
      id: string;
      activity_type: string;
      occurred_on: string;
      starts_at: string | null;
      title: string | null;
      opponent: string | null;
      our_score: number | null;
      opp_score: number | null;
      released_at: string | null;
      reviewed_at: string | null;
      source_practice_plan_id: string | null;
    }>;

    // ----- Past: workouts logged (only ones with actual set entries) -----
    const pastWorkoutActs = acts2.filter(
      (a) => a.activity_type === 'off_ice_workout'
        && a.occurred_on >= rangeStart
        && a.occurred_on <= rangeEnd,
    );
    if (pastWorkoutActs.length > 0) {
      const { data: weRows } = await supabase
        .from('workout_exercises').select('id, activity_id')
        .in('activity_id', pastWorkoutActs.map((a) => a.id));
      const weList = ((weRows ?? []) as Array<{ id: string; activity_id: string }>);
      const loggedActivityIds = new Set<string>();
      if (weList.length > 0) {
        const { data: setRows } = await supabase
          .from('workout_exercise_sets').select('workout_exercise_id')
          .eq('student_id', athlete.id)
          .in('workout_exercise_id', weList.map((w) => w.id));
        const weToActivity = new Map(weList.map((we) => [we.id, we.activity_id]));
        ((setRows ?? []) as Array<{ workout_exercise_id: string }>).forEach((s) => {
          const aid = weToActivity.get(s.workout_exercise_id);
          if (aid) loggedActivityIds.add(aid);
        });
      }
      for (const a of pastWorkoutActs) {
        if (loggedActivityIds.has(a.id)) {
          workoutsLogged.push({ date: a.occurred_on, title: a.title });
        }
      }
    }

    // ----- Past: practices attended (per attendance.attended = TRUE) -----
    const pastPracticeActs = acts2.filter(
      (a) => a.activity_type === 'practice'
        && a.occurred_on >= rangeStart
        && a.occurred_on <= rangeEnd,
    );
    if (pastPracticeActs.length > 0) {
      const { data: attRows } = await supabase
        .from('attendance')
        .select('activity_id, attended')
        .eq('student_id', athlete.id)
        .in('activity_id', pastPracticeActs.map((a) => a.id));
      const attMap = new Map<string, boolean | null>();
      for (const r of ((attRows ?? []) as Array<{ activity_id: string; attended: boolean | null }>)) {
        attMap.set(r.activity_id, r.attended);
      }
      for (const a of pastPracticeActs) {
        if (attMap.get(a.id) === true) {
          practicesAttended.push({ date: a.occurred_on, title: a.title });
        }
      }
    }

    // ----- Past: games reviewed (reviewed_at falls in range) -----
    for (const a of acts2) {
      if (a.activity_type !== 'game') continue;
      if (!a.reviewed_at) continue;
      const reviewedDate = a.reviewed_at.slice(0, 10);
      if (reviewedDate >= rangeStart && reviewedDate <= rangeEnd) {
        gamesReviewed.push({
          date: a.occurred_on,
          opponent: a.opponent,
          our: a.our_score,
          opp: a.opp_score,
        });
      }
    }

    // ----- Upcoming: practices with drills -----
    const upcomingPracticeActs = acts2.filter(
      (a) => a.activity_type === 'practice'
        && a.occurred_on > today
        && a.occurred_on <= upcomingEnd,
    );
    if (upcomingPracticeActs.length > 0) {
      // Batch-load drill lists for all upcoming practices' source plans
      const planIds = upcomingPracticeActs
        .map((a) => a.source_practice_plan_id)
        .filter((id): id is string => id !== null);
      const drillsByPlan = new Map<string, Array<{ title: string; duration_minutes: number | null }>>();
      if (planIds.length > 0) {
        const { data: itemRows } = await supabase
          .from('practice_plan_items')
          .select('plan_id, sequence, item_type, drill_id, skill_title, duration_override, drills(title, duration_minutes)')
          .in('plan_id', planIds)
          .order('sequence');
        for (const it of ((itemRows ?? []) as Array<{
          plan_id: string;
          sequence: number;
          item_type: string;
          drill_id: string | null;
          skill_title: string | null;
          duration_override: number | null;
          drills: { title: string | null; duration_minutes: number | null } | null;
        }>)) {
          const arr = drillsByPlan.get(it.plan_id) ?? [];
          const title = it.item_type === 'drill'
            ? (it.drills?.title ?? '(unknown drill)')
            : (it.skill_title ?? '(unnamed item)');
          const duration = it.duration_override ?? it.drills?.duration_minutes ?? null;
          arr.push({ title, duration_minutes: duration });
          drillsByPlan.set(it.plan_id, arr);
        }
      }
      for (const p of upcomingPracticeActs) {
        upcomingPractices.push({
          date: p.occurred_on,
          time: p.starts_at?.slice(0, 5) ?? null,
          title: p.title,
          drills: p.source_practice_plan_id
            ? (drillsByPlan.get(p.source_practice_plan_id) ?? [])
            : [],
        });
      }
    }

    // ----- Upcoming: workouts released -----
    for (const a of acts2) {
      if (a.activity_type !== 'off_ice_workout') continue;
      if (!a.released_at) continue;
      if (a.occurred_on > today && a.occurred_on <= upcomingEnd) {
        upcomingWorkoutsReleased.push({ date: a.occurred_on, title: a.title });
      }
    }
  }

  // Sort by date for consistent presentation
  workoutsLogged.sort((a, b) => a.date.localeCompare(b.date));
  practicesAttended.sort((a, b) => a.date.localeCompare(b.date));
  gamesReviewed.sort((a, b) => a.date.localeCompare(b.date));
  upcomingPractices.sort((a, b) => a.date.localeCompare(b.date));
  upcomingWorkoutsReleased.sort((a, b) => a.date.localeCompare(b.date));

  return {
    student_id: athlete.id,
    student_name: athlete.full_name,
    past: {
      workouts_logged: workoutsLogged,
      practices_attended: practicesAttended,
      games_reviewed: gamesReviewed,
    },
    upcoming: {
      practices: upcomingPractices,
      workouts_released: upcomingWorkoutsReleased,
    },
  };
}
