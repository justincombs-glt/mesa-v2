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
    workouts_logged: number;
    practices_attended: number;
    games_played: Array<{ date: string; opponent: string | null; our: number | null; opp: number | null }>;
    goal_updates: Array<{ title: string }>;
    apa_results_count: number;
    game_review_notes_count: number;
  };
  upcoming: {
    practices: Array<{ date: string; time: string | null; title: string | null }>;
    games: Array<{ date: string; opponent: string | null; home_away: 'home' | 'away' | null }>;
    workouts_released: Array<{ date: string; title: string | null }>;
    active_goals: Array<{ title: string }>;
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

  // Q6 empty check
  const anyContent = athleteDigests.some(
    (ad) =>
      ad.past.workouts_logged > 0 ||
      ad.past.practices_attended > 0 ||
      ad.past.games_played.length > 0 ||
      ad.past.goal_updates.length > 0 ||
      ad.past.apa_results_count > 0 ||
      ad.past.game_review_notes_count > 0 ||
      ad.upcoming.practices.length > 0 ||
      ad.upcoming.games.length > 0 ||
      ad.upcoming.workouts_released.length > 0 ||
      ad.upcoming.active_goals.length > 0,
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
 */
async function _buildAthleteDigest(
  supabase: AnySupabaseClient,
  athlete: AthleteRef,
  rangeStart: string,
  rangeEnd: string,
  upcomingEnd: string,
): Promise<AthleteDigest> {
  // Today's date (used as the boundary for past vs upcoming activities)
  const today = new Date().toISOString().slice(0, 10);

  // Find all activity_ids this athlete is rostered into within the relevant range
  const { data: rosterRows } = await supabase
    .from('activity_students')
    .select('activity_id')
    .eq('student_id', athlete.id);
  const activityIds = ((rosterRows ?? []) as Array<{ activity_id: string }>).map((r) => r.activity_id);

  // Past + upcoming activities
  let pastWorkoutsCount = 0;
  let pastPracticesCount = 0;
  const pastGames: AthleteDigest['past']['games_played'] = [];
  const upcomingPractices: AthleteDigest['upcoming']['practices'] = [];
  const upcomingGames: AthleteDigest['upcoming']['games'] = [];
  const upcomingWorkoutsReleased: AthleteDigest['upcoming']['workouts_released'] = [];
  let pastGameReviewCount = 0;

  if (activityIds.length > 0) {
    const { data: acts } = await supabase
      .from('activities')
      .select('id, activity_type, occurred_on, starts_at, title, opponent, our_score, opp_score, home_away, released_at, reviewed_at, updated_at')
      .in('id', activityIds)
      .gte('occurred_on', rangeStart)
      .lte('occurred_on', upcomingEnd);
    const acts2 = (acts ?? []) as Array<{
      id: string; activity_type: string; occurred_on: string; starts_at: string | null;
      title: string | null; opponent: string | null; our_score: number | null;
      opp_score: number | null; home_away: 'home' | 'away' | null;
      released_at: string | null; reviewed_at: string | null; updated_at: string;
    }>;

    for (const act of acts2) {
      const isPast = act.occurred_on >= rangeStart && act.occurred_on <= rangeEnd;
      const isUpcoming = act.occurred_on > today && act.occurred_on <= upcomingEnd;

      if (act.activity_type === 'off_ice_workout') {
        if (isPast) {
          // Count past workouts only if athlete actually logged sets — proxy:
          // check workout_exercise_sets. For perf we batch this below.
          pastWorkoutsCount += 1; // adjusted below
        } else if (isUpcoming && act.released_at) {
          upcomingWorkoutsReleased.push({
            date: act.occurred_on,
            title: act.title,
          });
        }
      } else if (act.activity_type === 'practice') {
        if (isPast) pastPracticesCount += 1;
        else if (isUpcoming) {
          upcomingPractices.push({
            date: act.occurred_on,
            time: act.starts_at?.slice(0, 5) ?? null,
            title: act.title,
          });
        }
      } else if (act.activity_type === 'game') {
        if (isPast) {
          pastGames.push({
            date: act.occurred_on,
            opponent: act.opponent,
            our: act.our_score,
            opp: act.opp_score,
          });
          // Count game-review notes added in range (proxy: reviewed_at falls in range)
          if (act.reviewed_at && act.reviewed_at.slice(0, 10) >= rangeStart && act.reviewed_at.slice(0, 10) <= rangeEnd) {
            pastGameReviewCount += 1;
          }
        } else if (isUpcoming) {
          upcomingGames.push({
            date: act.occurred_on,
            opponent: act.opponent,
            home_away: act.home_away,
          });
        }
      }
    }

    // Refine pastWorkoutsCount: only count workouts where this athlete actually
    // logged at least one set within the range. Replace the naive count.
    const pastWorkoutIds = acts2
      .filter((a) => a.activity_type === 'off_ice_workout' && a.occurred_on >= rangeStart && a.occurred_on <= rangeEnd)
      .map((a) => a.id);
    if (pastWorkoutIds.length > 0) {
      const { data: weRows } = await supabase
        .from('workout_exercises').select('id, activity_id')
        .in('activity_id', pastWorkoutIds);
      const weList = ((weRows ?? []) as Array<{ id: string; activity_id: string }>);
      if (weList.length > 0) {
        const { data: setRows } = await supabase
          .from('workout_exercise_sets').select('workout_exercise_id')
          .eq('student_id', athlete.id)
          .in('workout_exercise_id', weList.map((w) => w.id));
        // Workouts where the athlete logged at least one set
        const loggedActivityIds = new Set<string>();
        const weToActivity = new Map(weList.map((we) => [we.id, we.activity_id]));
        ((setRows ?? []) as Array<{ workout_exercise_id: string }>).forEach((s) => {
          const aid = weToActivity.get(s.workout_exercise_id);
          if (aid) loggedActivityIds.add(aid);
        });
        pastWorkoutsCount = loggedActivityIds.size;
      } else {
        pastWorkoutsCount = 0;
      }
    } else {
      pastWorkoutsCount = 0;
    }
  }

  // Goal updates in the past range
  const goalUpdates: AthleteDigest['past']['goal_updates'] = [];
  const { data: goalPlans } = await supabase
    .from('goal_plans')
    .select('id, title, updated_at, status')
    .eq('student_id', athlete.id);
  const plans = ((goalPlans ?? []) as Array<{ id: string; title: string; updated_at: string; status: string }>);
  for (const p of plans) {
    if (p.updated_at.slice(0, 10) >= rangeStart && p.updated_at.slice(0, 10) <= rangeEnd) {
      goalUpdates.push({ title: p.title });
    }
  }

  // Active goals for upcoming section
  const activeGoals: AthleteDigest['upcoming']['active_goals'] = plans
    .filter((p) => p.status === 'active')
    .map((p) => ({ title: p.title }))
    .slice(0, 5);

  // APA / performance test results recorded in range
  let apaResultsCount = 0;
  const { data: apaRows } = await supabase
    .from('performance_test_results')
    .select('id, recorded_at')
    .eq('student_id', athlete.id);
  const apaList = ((apaRows ?? []) as Array<{ recorded_at: string }>);
  for (const r of apaList) {
    if (r.recorded_at.slice(0, 10) >= rangeStart && r.recorded_at.slice(0, 10) <= rangeEnd) {
      apaResultsCount += 1;
    }
  }

  // Sort upcoming sections by date
  upcomingPractices.sort((a, b) => a.date.localeCompare(b.date));
  upcomingGames.sort((a, b) => a.date.localeCompare(b.date));
  upcomingWorkoutsReleased.sort((a, b) => a.date.localeCompare(b.date));

  return {
    student_id: athlete.id,
    student_name: athlete.full_name,
    past: {
      workouts_logged: pastWorkoutsCount,
      practices_attended: pastPracticesCount,
      games_played: pastGames,
      goal_updates: goalUpdates,
      apa_results_count: apaResultsCount,
      game_review_notes_count: pastGameReviewCount,
    },
    upcoming: {
      practices: upcomingPractices,
      games: upcomingGames,
      workouts_released: upcomingWorkoutsReleased,
      active_goals: activeGoals,
    },
  };
}
