-- ============================================================================
-- MESA v2 — Demo Seed Data
--
-- Populates a realistic small academy with sample players, drills, exercises,
-- practices, games, workouts, attendance, stats, a goal plan, and a composite
-- baseline assessment session with results. Designed to make every dashboard
-- surface feel populated for demos and screenshots.
--
-- HOW TO RUN
-- ----------
-- 1. Open Supabase SQL Editor
-- 2. Paste the entire contents of this file
-- 3. Run
-- 4. Refresh MESA — the data appears immediately
--
-- IDEMPOTENCY NOTE
-- ----------------
-- This script does NOT auto-delete previous seed data. If you run it twice,
-- you get duplicate students, practices, etc. To re-seed cleanly, FIRST run
-- the cleanup block at the bottom of this file (uncomment it), THEN re-run
-- this seed.
--
-- IDENTIFICATION MARKERS (for cleanup)
-- ------------------------------------
-- - Students: team_label = 'Demo'
-- - Drills/Exercises/Composites/Tests: title ends with '(SEED)'
-- - Activities (practices, games, workouts): notes ends with '(SEED)'
-- - Goal plans: title ends with '(SEED)'
--
-- NO AUTH USERS
-- -------------
-- This seed does NOT create login accounts. The 12 students have no profile
-- linkage. To demo the student/parent experience, manually create one account
-- via /sign-up and use the Phase R.5 link tool to wire it to a seeded student.
-- ============================================================================

do $$
declare
  v_season_id uuid;
  v_admin_id  uuid;

  -- Student IDs
  v_p01 uuid; v_p02 uuid; v_p03 uuid; v_p04 uuid; v_p05 uuid; v_p06 uuid;
  v_p07 uuid; v_p08 uuid; v_p09 uuid; v_p10 uuid; v_p11 uuid; v_p12 uuid;

  -- Drill IDs (some referenced in practices)
  v_d_skating_warm uuid; v_d_skating_edges uuid; v_d_skating_crossovers uuid;
  v_d_puck_handle uuid; v_d_passing_2v0 uuid;
  v_d_shooting_quick uuid; v_d_shooting_oneT uuid;
  v_d_scrimmage uuid; v_d_battles uuid; v_d_goalie_recovery uuid;

  -- Exercise IDs (some referenced in workouts)
  v_e_squat uuid; v_e_deadlift uuid; v_e_bench uuid; v_e_pullup uuid;
  v_e_jumpsquat uuid; v_e_plank uuid; v_e_sprint uuid; v_e_mobility uuid;

  -- Activity IDs
  v_pr01 uuid; v_pr02 uuid; v_pr03 uuid; v_pr04 uuid; v_pr05 uuid;
  v_g01 uuid; v_g02 uuid; v_g03 uuid; v_g04 uuid;
  v_w01 uuid; v_w02 uuid; v_w03 uuid; v_w04 uuid; v_w05 uuid;

  -- Performance test IDs (for the composite)
  v_t_vjump uuid; v_t_bjump uuid; v_t_40yd uuid; v_t_plank uuid; v_t_10stride uuid;

  -- Composite + session
  v_composite_id uuid;
  v_session_id uuid;

  -- Goal plans
  v_plan1_id uuid;
  v_plan2_id uuid;

  -- Reference dates (relative to today)
  d_today date := current_date;

begin

  -- ==========================================================================
  -- Resolve current season. Error out if none exists.
  -- ==========================================================================
  select id into v_season_id from public.seasons where is_current = true limit 1;
  if v_season_id is null then
    raise exception 'No active season found. Create one first in /dashboard/seasons or run migration 0008.';
  end if;

  -- ==========================================================================
  -- Best-effort: find an admin profile to attribute drill/exercise creation to.
  -- (Nullable — if there's no admin, leave creator null.)
  -- ==========================================================================
  select id into v_admin_id from public.profiles where role = 'admin' limit 1;
  if v_admin_id is null then
    select id into v_admin_id from public.profiles where role = 'director' limit 1;
  end if;

  -- ==========================================================================
  -- 1. STUDENTS — 12 players, mix of positions, all on "Demo" team_label
  -- ==========================================================================
  v_p01 := gen_random_uuid();
  v_p02 := gen_random_uuid();
  v_p03 := gen_random_uuid();
  v_p04 := gen_random_uuid();
  v_p05 := gen_random_uuid();
  v_p06 := gen_random_uuid();
  v_p07 := gen_random_uuid();
  v_p08 := gen_random_uuid();
  v_p09 := gen_random_uuid();
  v_p10 := gen_random_uuid();
  v_p11 := gen_random_uuid();
  v_p12 := gen_random_uuid();

  insert into public.students (id, full_name, date_of_birth, jersey_number, position, dominant_hand, team_label, active) values
    (v_p01, 'Tyler MacKinnon',  (d_today - interval '15 years')::date, '9',  'F', 'L', 'Demo', true),
    (v_p02, 'Cole Reinhart',    (d_today - interval '15 years')::date, '14', 'F', 'R', 'Demo', true),
    (v_p03, 'Ethan Tremblay',   (d_today - interval '14 years')::date, '21', 'F', 'L', 'Demo', true),
    (v_p04, 'Jack Wozniak',     (d_today - interval '14 years')::date, '7',  'F', 'L', 'Demo', true),
    (v_p05, 'Aiden Beauchemin', (d_today - interval '15 years')::date, '17', 'F', 'R', 'Demo', true),
    (v_p06, 'Mason Larocque',   (d_today - interval '13 years')::date, '11', 'F', 'L', 'Demo', true),
    (v_p07, 'Liam O''Sullivan', (d_today - interval '14 years')::date, '22', 'F', 'R', 'Demo', true),
    (v_p08, 'Noah Petersson',   (d_today - interval '13 years')::date, '19', 'F', 'L', 'Demo', true),
    (v_p09, 'Henrik Lindqvist', (d_today - interval '15 years')::date, '4',  'D', 'L', 'Demo', true),
    (v_p10, 'Owen Brennan',     (d_today - interval '14 years')::date, '6',  'D', 'R', 'Demo', true),
    (v_p11, 'Logan Vasiliev',   (d_today - interval '13 years')::date, '24', 'D', 'L', 'Demo', true),
    (v_p12, 'Caleb Marchetti',  (d_today - interval '15 years')::date, '30', 'G', 'L', 'Demo', true);

  -- Enroll all 12 in the current season
  insert into public.season_enrollments (season_id, student_id, enrolled_on) values
    (v_season_id, v_p01, (d_today - 60)),
    (v_season_id, v_p02, (d_today - 60)),
    (v_season_id, v_p03, (d_today - 60)),
    (v_season_id, v_p04, (d_today - 60)),
    (v_season_id, v_p05, (d_today - 60)),
    (v_season_id, v_p06, (d_today - 55)),
    (v_season_id, v_p07, (d_today - 55)),
    (v_season_id, v_p08, (d_today - 55)),
    (v_season_id, v_p09, (d_today - 60)),
    (v_season_id, v_p10, (d_today - 60)),
    (v_season_id, v_p11, (d_today - 50)),
    (v_season_id, v_p12, (d_today - 60));

  -- ==========================================================================
  -- 2. DRILLS — 10 sample on-ice drills
  -- ==========================================================================
  v_d_skating_warm        := gen_random_uuid();
  v_d_skating_edges       := gen_random_uuid();
  v_d_skating_crossovers  := gen_random_uuid();
  v_d_puck_handle         := gen_random_uuid();
  v_d_passing_2v0         := gen_random_uuid();
  v_d_shooting_quick      := gen_random_uuid();
  v_d_shooting_oneT       := gen_random_uuid();
  v_d_scrimmage           := gen_random_uuid();
  v_d_battles             := gen_random_uuid();
  v_d_goalie_recovery     := gen_random_uuid();

  insert into public.drills (id, title, category, description, duration_minutes, equipment, age_groups, active, created_by) values
    (v_d_skating_warm,       'Skating Warm-Up Laps (SEED)',      'Skating',     'Easy laps with progressive tempo.',                                             10, array['Pucks (optional)'],            array['U13','U14','U15'], true, v_admin_id),
    (v_d_skating_edges,      'Edge Work Series (SEED)',          'Skating',     'Inside/outside edges, tight turns, two-foot stops.',                            12, array['Cones'],                       array['U13','U14','U15'], true, v_admin_id),
    (v_d_skating_crossovers, 'Crossover Acceleration (SEED)',    'Skating',     'Circle crossovers building to full sprints.',                                   10, array['Cones'],                       array['U13','U14','U15'], true, v_admin_id),
    (v_d_puck_handle,        'Puck Control Stations (SEED)',     'Puck Control','Stickhandling through cones, toe drags, around obstacles.',                     15, array['Pucks','Cones','Tires'],       array['U13','U14','U15'], true, v_admin_id),
    (v_d_passing_2v0,        '2-on-0 Passing Rush (SEED)',       'Passing',     'Pairs make crisp passes up ice and finish on net.',                             12, array['Pucks'],                       array['U13','U14','U15'], true, v_admin_id),
    (v_d_shooting_quick,     'Quick Release Snapshots (SEED)',   'Shooting',    'Catch pass, shoot in under one second. Repeat from multiple angles.',           10, array['Pucks'],                       array['U13','U14','U15'], true, v_admin_id),
    (v_d_shooting_oneT,      'One-Timers (SEED)',                'Shooting',    'Pass-and-shoot from the slot. Goalie active.',                                  10, array['Pucks'],                       array['U14','U15'],       true, v_admin_id),
    (v_d_scrimmage,          'Cross-Ice Scrimmage (SEED)',       'Scrimmage',   'Small-area games, station rotation.',                                           15, array['Pucks','Cones'],               array['U13','U14','U15'], true, v_admin_id),
    (v_d_battles,            '1-on-1 Wall Battles (SEED)',       'Compete',     'Body positioning and protecting the puck along the boards.',                    10, array['Pucks'],                       array['U14','U15'],       true, v_admin_id),
    (v_d_goalie_recovery,    'Goalie Lateral Recovery (SEED)',   'Goalie',      'Butterfly slides, post-to-post recovery, rebound control.',                     12, array['Pucks'],                       array['U13','U14','U15'], true, v_admin_id);

  -- ==========================================================================
  -- 3. EXERCISES — 8 sample off-ice exercises
  -- ==========================================================================
  v_e_squat     := gen_random_uuid();
  v_e_deadlift  := gen_random_uuid();
  v_e_bench     := gen_random_uuid();
  v_e_pullup    := gen_random_uuid();
  v_e_jumpsquat := gen_random_uuid();
  v_e_plank     := gen_random_uuid();
  v_e_sprint    := gen_random_uuid();
  v_e_mobility  := gen_random_uuid();

  insert into public.exercises (id, title, category, description, default_sets, default_reps, default_duration_seconds, equipment, active, created_by) values
    (v_e_squat,     'Back Squat (SEED)',        'Strength',     'Barbell squat to parallel. Drive through heels.',          4, 6,  null, array['Barbell','Rack'],    true, v_admin_id),
    (v_e_deadlift,  'Conventional Deadlift (SEED)', 'Strength', 'Hip hinge. Brace core, neutral spine.',                    3, 5,  null, array['Barbell','Plates'],  true, v_admin_id),
    (v_e_bench,     'Bench Press (SEED)',       'Strength',     'Bar to chest, drive evenly. Spotter for top sets.',        4, 8,  null, array['Barbell','Bench'],   true, v_admin_id),
    (v_e_pullup,    'Pull-Ups (SEED)',          'Strength',     'Wide grip, chin over bar. Use band assist if needed.',     3, 8,  null, array['Pull-up bar'],       true, v_admin_id),
    (v_e_jumpsquat, 'Jump Squats (SEED)',       'Power',        'Explosive vertical. Land soft, reset, repeat.',            4, 6,  null, array['Bodyweight'],        true, v_admin_id),
    (v_e_plank,     'Plank Hold (SEED)',        'Core',         'Hold in line. Stop when form breaks.',                     3, null, 60, array['Bodyweight'],        true, v_admin_id),
    (v_e_sprint,    'Sprint Intervals (SEED)',  'Conditioning', '40-yard sprints with 60-second rest between.',             6, null, 8,  array['Open space'],        true, v_admin_id),
    (v_e_mobility,  'Hip Mobility Flow (SEED)', 'Mobility',     'Dynamic hip openers — 90/90, pigeon, cossack squats.',     2, null, 90, array['Bodyweight'],        true, v_admin_id);

  -- ==========================================================================
  -- 4. PRACTICES — 5 total (3 past, 2 upcoming)
  -- ==========================================================================
  v_pr01 := gen_random_uuid();
  v_pr02 := gen_random_uuid();
  v_pr03 := gen_random_uuid();
  v_pr04 := gen_random_uuid();
  v_pr05 := gen_random_uuid();

  insert into public.activities (id, activity_type, occurred_on, starts_at, duration_minutes, title, focus, notes, venue, season_id) values
    (v_pr01, 'practice', (d_today - 14), '16:30', 75, 'Foundations Day',       'Skating + Edge Work',   'Mid-week practice. Focus on basics. (SEED)',      'Rink A',  v_season_id),
    (v_pr02, 'practice', (d_today - 10), '17:00', 90, 'Game Speed Drills',     'Transitions + Shooting','Pre-game day session. (SEED)',                    'Rink A',  v_season_id),
    (v_pr03, 'practice', (d_today - 5),  '16:30', 75, 'Compete Practice',      'Battles + Scrimmage',   'High-tempo work. (SEED)',                          'Rink B',  v_season_id),
    (v_pr04, 'practice', (d_today + 2),  '17:00', 75, 'Power Skating Focus',   'Edges + Crossovers',    'Heavy skating emphasis this week. (SEED)',         'Rink A',  v_season_id),
    (v_pr05, 'practice', (d_today + 5),  '16:30', 90, 'Pre-Game Tune-Up',      'Quick Release + Flow',  'Light skate before Saturday game. (SEED)',         'Rink A',  v_season_id);

  -- All 12 players rostered onto every practice
  insert into public.activity_students (activity_id, student_id)
  select v_pr01, id from (values (v_p01),(v_p02),(v_p03),(v_p04),(v_p05),(v_p06),(v_p07),(v_p08),(v_p09),(v_p10),(v_p11),(v_p12)) as t(id);
  insert into public.activity_students (activity_id, student_id)
  select v_pr02, id from (values (v_p01),(v_p02),(v_p03),(v_p04),(v_p05),(v_p06),(v_p07),(v_p08),(v_p09),(v_p10),(v_p11),(v_p12)) as t(id);
  insert into public.activity_students (activity_id, student_id)
  select v_pr03, id from (values (v_p01),(v_p02),(v_p03),(v_p04),(v_p05),(v_p06),(v_p07),(v_p08),(v_p09),(v_p10),(v_p11),(v_p12)) as t(id);
  insert into public.activity_students (activity_id, student_id)
  select v_pr04, id from (values (v_p01),(v_p02),(v_p03),(v_p04),(v_p05),(v_p06),(v_p07),(v_p08),(v_p09),(v_p10),(v_p11),(v_p12)) as t(id);
  insert into public.activity_students (activity_id, student_id)
  select v_pr05, id from (values (v_p01),(v_p02),(v_p03),(v_p04),(v_p05),(v_p06),(v_p07),(v_p08),(v_p09),(v_p10),(v_p11),(v_p12)) as t(id);

  -- Attendance for the 3 past practices (mostly present, a few absent for realism)
  -- pr01: everyone present except p06 and p11
  insert into public.attendance (activity_id, student_id, attended) values
    (v_pr01, v_p01, true),  (v_pr01, v_p02, true),  (v_pr01, v_p03, true),  (v_pr01, v_p04, true),
    (v_pr01, v_p05, true),  (v_pr01, v_p06, false), (v_pr01, v_p07, true),  (v_pr01, v_p08, true),
    (v_pr01, v_p09, true),  (v_pr01, v_p10, true),  (v_pr01, v_p11, false), (v_pr01, v_p12, true);
  -- pr02: everyone present except p03
  insert into public.attendance (activity_id, student_id, attended) values
    (v_pr02, v_p01, true),  (v_pr02, v_p02, true),  (v_pr02, v_p03, false), (v_pr02, v_p04, true),
    (v_pr02, v_p05, true),  (v_pr02, v_p06, true),  (v_pr02, v_p07, true),  (v_pr02, v_p08, true),
    (v_pr02, v_p09, true),  (v_pr02, v_p10, true),  (v_pr02, v_p11, true),  (v_pr02, v_p12, true);
  -- pr03: everyone present
  insert into public.attendance (activity_id, student_id, attended) values
    (v_pr03, v_p01, true),  (v_pr03, v_p02, true),  (v_pr03, v_p03, true),  (v_pr03, v_p04, true),
    (v_pr03, v_p05, true),  (v_pr03, v_p06, true),  (v_pr03, v_p07, true),  (v_pr03, v_p08, true),
    (v_pr03, v_p09, true),  (v_pr03, v_p10, true),  (v_pr03, v_p11, true),  (v_pr03, v_p12, true);

  -- ==========================================================================
  -- 5. GAMES — 4 total (3 past with scores, 1 upcoming)
  -- ==========================================================================
  v_g01 := gen_random_uuid();
  v_g02 := gen_random_uuid();
  v_g03 := gen_random_uuid();
  v_g04 := gen_random_uuid();

  insert into public.activities (id, activity_type, occurred_on, starts_at, duration_minutes, opponent, our_score, opp_score, home_away, venue, notes, season_id) values
    (v_g01, 'game', (d_today - 21), '14:00', 75, 'Riverside Rangers',   5, 3, 'home', 'Rink A',           'Strong start, held lead. (SEED)',           v_season_id),
    (v_g02, 'game', (d_today - 13), '11:30', 75, 'Bayview Bears',       2, 4, 'away', 'Bayview Arena',    'Tough loss on the road. (SEED)',            v_season_id),
    (v_g03, 'game', (d_today - 6),  '15:00', 75, 'Lakeshore Lightning', 4, 4, 'home', 'Rink A',           'Tied 4-4 in OT, finished as tie. (SEED)',   v_season_id),
    (v_g04, 'game', (d_today + 7),  '13:00', 75, 'Westport Wolves',     null, null, 'home', 'Rink A',     'Conference matchup. (SEED)',                v_season_id);

  -- Roster all 12 players onto every game
  insert into public.activity_students (activity_id, student_id)
  select v_g01, id from (values (v_p01),(v_p02),(v_p03),(v_p04),(v_p05),(v_p06),(v_p07),(v_p08),(v_p09),(v_p10),(v_p11),(v_p12)) as t(id);
  insert into public.activity_students (activity_id, student_id)
  select v_g02, id from (values (v_p01),(v_p02),(v_p03),(v_p04),(v_p05),(v_p06),(v_p07),(v_p08),(v_p09),(v_p10),(v_p11),(v_p12)) as t(id);
  insert into public.activity_students (activity_id, student_id)
  select v_g03, id from (values (v_p01),(v_p02),(v_p03),(v_p04),(v_p05),(v_p06),(v_p07),(v_p08),(v_p09),(v_p10),(v_p11),(v_p12)) as t(id);
  insert into public.activity_students (activity_id, student_id)
  select v_g04, id from (values (v_p01),(v_p02),(v_p03),(v_p04),(v_p05),(v_p06),(v_p07),(v_p08),(v_p09),(v_p10),(v_p11),(v_p12)) as t(id);

  -- Game 1 stats (Riverside Rangers, W 5-3) — skaters mostly, goalie has saves
  insert into public.game_stats (activity_id, student_id, goals, assists, plus_minus, shots, penalty_mins, time_on_ice, saves, shots_against, goals_against) values
    (v_g01, v_p01, 2, 1,  3, 6, 0, '00:15:32', null, null, null),
    (v_g01, v_p02, 1, 2,  3, 5, 2, '00:14:55', null, null, null),
    (v_g01, v_p03, 0, 1,  1, 3, 0, '00:12:10', null, null, null),
    (v_g01, v_p04, 1, 0,  2, 4, 0, '00:12:45', null, null, null),
    (v_g01, v_p05, 1, 0,  1, 4, 2, '00:13:20', null, null, null),
    (v_g01, v_p06, 0, 1,  1, 2, 0, '00:10:15', null, null, null),
    (v_g01, v_p07, 0, 0,  0, 1, 0, '00:11:40', null, null, null),
    (v_g01, v_p08, 0, 0,  0, 2, 0, '00:10:50', null, null, null),
    (v_g01, v_p09, 0, 1,  2, 1, 0, '00:18:25', null, null, null),
    (v_g01, v_p10, 0, 0,  2, 0, 0, '00:17:50', null, null, null),
    (v_g01, v_p11, 0, 0, -1, 1, 4, '00:14:30', null, null, null),
    (v_g01, v_p12, 0, 0,  0, 0, 0, '01:00:00',  28, 31, 3);

  -- Game 2 stats (Bayview Bears, L 2-4)
  insert into public.game_stats (activity_id, student_id, goals, assists, plus_minus, shots, penalty_mins, time_on_ice, saves, shots_against, goals_against) values
    (v_g02, v_p01, 1, 0, -1, 4, 0, '00:14:20', null, null, null),
    (v_g02, v_p02, 0, 1, -1, 3, 0, '00:13:45', null, null, null),
    (v_g02, v_p03, 0, 0, -1, 2, 2, '00:11:30', null, null, null),
    (v_g02, v_p04, 0, 0, -1, 1, 0, '00:11:50', null, null, null),
    (v_g02, v_p05, 1, 1,  0, 5, 0, '00:14:00', null, null, null),
    (v_g02, v_p06, 0, 0, -1, 1, 0,  '00:09:55', null, null, null),
    (v_g02, v_p07, 0, 0, -1, 2, 0, '00:10:30', null, null, null),
    (v_g02, v_p08, 0, 0, -1, 1, 0, '00:10:15', null, null, null),
    (v_g02, v_p09, 0, 1, -2, 0, 0, '00:17:10', null, null, null),
    (v_g02, v_p10, 0, 0, -2, 1, 2, '00:16:55', null, null, null),
    (v_g02, v_p11, 0, 0, -2, 0, 0, '00:13:20', null, null, null),
    (v_g02, v_p12, 0, 0,  0, 0, 0, '01:00:00',  32, 36, 4);

  -- Game 3 stats (Lakeshore Lightning, T 4-4)
  insert into public.game_stats (activity_id, student_id, goals, assists, plus_minus, shots, penalty_mins, time_on_ice, saves, shots_against, goals_against) values
    (v_g03, v_p01, 1, 1,  1, 5, 0, '00:15:10', null, null, null),
    (v_g03, v_p02, 2, 0,  1, 6, 0, '00:14:30', null, null, null),
    (v_g03, v_p03, 0, 1,  0, 2, 0, '00:11:45', null, null, null),
    (v_g03, v_p04, 1, 0,  1, 4, 0, '00:12:20', null, null, null),
    (v_g03, v_p05, 0, 2,  1, 3, 0, '00:13:50', null, null, null),
    (v_g03, v_p06, 0, 0,  0, 1, 0, '00:10:00', null, null, null),
    (v_g03, v_p07, 0, 0,  0, 2, 2, '00:10:40', null, null, null),
    (v_g03, v_p08, 0, 1,  1, 1, 0, '00:10:25', null, null, null),
    (v_g03, v_p09, 0, 0,  0, 0, 0, '00:18:00', null, null, null),
    (v_g03, v_p10, 0, 1,  0, 2, 0, '00:17:30', null, null, null),
    (v_g03, v_p11, 0, 0,  0, 1, 0, '00:13:50', null, null, null),
    (v_g03, v_p12, 0, 0,  0, 0, 0, '01:00:00',  30, 34, 4);

  -- Attendance for the 3 past games — all 12 present (no absences for games)
  insert into public.attendance (activity_id, student_id, attended)
  select v_g01, id, true from (values (v_p01),(v_p02),(v_p03),(v_p04),(v_p05),(v_p06),(v_p07),(v_p08),(v_p09),(v_p10),(v_p11),(v_p12)) as t(id);
  insert into public.attendance (activity_id, student_id, attended)
  select v_g02, id, true from (values (v_p01),(v_p02),(v_p03),(v_p04),(v_p05),(v_p06),(v_p07),(v_p08),(v_p09),(v_p10),(v_p11),(v_p12)) as t(id);
  insert into public.attendance (activity_id, student_id, attended)
  select v_g03, id, true from (values (v_p01),(v_p02),(v_p03),(v_p04),(v_p05),(v_p06),(v_p07),(v_p08),(v_p09),(v_p10),(v_p11),(v_p12)) as t(id);

  -- ==========================================================================
  -- 6. OFF-ICE WORKOUTS — 5 total (3 past with sets logged, 2 upcoming)
  -- ==========================================================================
  v_w01 := gen_random_uuid();
  v_w02 := gen_random_uuid();
  v_w03 := gen_random_uuid();
  v_w04 := gen_random_uuid();
  v_w05 := gen_random_uuid();

  insert into public.activities (id, activity_type, occurred_on, starts_at, duration_minutes, title, focus, off_ice_category, notes, venue, season_id) values
    (v_w01, 'off_ice_workout', (d_today - 17), '08:00', 60, 'Lower Body Strength', 'Squat + Deadlift',     'strength_conditioning', 'Heavy lower body. (SEED)',                      'Gym',  v_season_id),
    (v_w02, 'off_ice_workout', (d_today - 11), '08:00', 60, 'Upper Body Strength', 'Bench + Pull',         'strength_conditioning', 'Push/pull pairing. (SEED)',                     'Gym',  v_season_id),
    (v_w03, 'off_ice_workout', (d_today - 4),  '08:00', 45, 'Power + Conditioning','Jump Squats + Sprints','strength_conditioning', 'Explosive work + sprint intervals. (SEED)',     'Gym',  v_season_id),
    (v_w04, 'off_ice_workout', (d_today + 1),  '08:00', 60, 'Lower Body Strength', 'Squat focus',          'strength_conditioning', 'Tomorrow morning. (SEED)',                      'Gym',  v_season_id),
    (v_w05, 'off_ice_workout', (d_today + 8),  '08:00', 45, 'Mobility Recovery',   'Hip + thoracic',       'pilates',               'Active recovery between games. (SEED)',         'Gym',  v_season_id);

  -- Roster all 12 onto every workout
  insert into public.activity_students (activity_id, student_id)
  select v_w01, id from (values (v_p01),(v_p02),(v_p03),(v_p04),(v_p05),(v_p06),(v_p07),(v_p08),(v_p09),(v_p10),(v_p11),(v_p12)) as t(id);
  insert into public.activity_students (activity_id, student_id)
  select v_w02, id from (values (v_p01),(v_p02),(v_p03),(v_p04),(v_p05),(v_p06),(v_p07),(v_p08),(v_p09),(v_p10),(v_p11),(v_p12)) as t(id);
  insert into public.activity_students (activity_id, student_id)
  select v_w03, id from (values (v_p01),(v_p02),(v_p03),(v_p04),(v_p05),(v_p06),(v_p07),(v_p08),(v_p09),(v_p10),(v_p11),(v_p12)) as t(id);
  insert into public.activity_students (activity_id, student_id)
  select v_w04, id from (values (v_p01),(v_p02),(v_p03),(v_p04),(v_p05),(v_p06),(v_p07),(v_p08),(v_p09),(v_p10),(v_p11),(v_p12)) as t(id);
  insert into public.activity_students (activity_id, student_id)
  select v_w05, id from (values (v_p01),(v_p02),(v_p03),(v_p04),(v_p05),(v_p06),(v_p07),(v_p08),(v_p09),(v_p10),(v_p11),(v_p12)) as t(id);

  -- Workout 1: Lower Body Strength — Squat + Deadlift
  declare
    v_we01a uuid := gen_random_uuid();
    v_we01b uuid := gen_random_uuid();
  begin
    insert into public.workout_exercises (id, activity_id, exercise_id, sequence, sets, coach_notes) values
      (v_we01a, v_w01, v_e_squat,    1, 4, 'Work up to a heavy triple.'),
      (v_we01b, v_w01, v_e_deadlift, 2, 3, 'Singles at 80% on top set.');

    -- Sets for 3 sample players (p01, p09, p12) — just enough to populate dashboards
    insert into public.workout_exercise_sets (workout_exercise_id, student_id, set_number, reps, weight, rpe) values
      (v_we01a, v_p01, 1, 6, 95,  6),
      (v_we01a, v_p01, 2, 6, 105, 7),
      (v_we01a, v_p01, 3, 5, 115, 8),
      (v_we01a, v_p01, 4, 3, 125, 9),
      (v_we01b, v_p01, 1, 5, 135, 7),
      (v_we01b, v_p01, 2, 3, 155, 8),
      (v_we01b, v_p01, 3, 1, 175, 9),
      (v_we01a, v_p09, 1, 6, 115, 6),
      (v_we01a, v_p09, 2, 6, 130, 7),
      (v_we01a, v_p09, 3, 5, 140, 8),
      (v_we01b, v_p09, 1, 5, 155, 7),
      (v_we01b, v_p09, 2, 3, 175, 8),
      (v_we01a, v_p12, 1, 8, 75,  6),
      (v_we01a, v_p12, 2, 8, 85,  7);
  end;

  -- Workout 2: Upper Body Strength — Bench + Pull-Ups
  declare
    v_we02a uuid := gen_random_uuid();
    v_we02b uuid := gen_random_uuid();
  begin
    insert into public.workout_exercises (id, activity_id, exercise_id, sequence, sets, coach_notes) values
      (v_we02a, v_w02, v_e_bench,  1, 4, '8 reps, build weight each set.'),
      (v_we02b, v_w02, v_e_pullup, 2, 3, 'Add weight if you can do all 8 unassisted.');

    insert into public.workout_exercise_sets (workout_exercise_id, student_id, set_number, reps, weight, rpe) values
      (v_we02a, v_p01, 1, 8, 95,  6),
      (v_we02a, v_p01, 2, 8, 105, 7),
      (v_we02a, v_p01, 3, 8, 115, 8),
      (v_we02b, v_p01, 1, 8, null, 7),
      (v_we02b, v_p01, 2, 6, null, 8),
      (v_we02b, v_p01, 3, 5, null, 9),
      (v_we02a, v_p05, 1, 8, 105, 6),
      (v_we02a, v_p05, 2, 8, 115, 7),
      (v_we02b, v_p05, 1, 10, null, 7);
  end;

  -- Workout 3: Power + Conditioning — Jump Squats + Sprints
  declare
    v_we03a uuid := gen_random_uuid();
    v_we03b uuid := gen_random_uuid();
  begin
    insert into public.workout_exercises (id, activity_id, exercise_id, sequence, sets, coach_notes) values
      (v_we03a, v_w03, v_e_jumpsquat, 1, 4, 'Max height each rep.'),
      (v_we03b, v_w03, v_e_sprint,    2, 6, '40 yards, 60s rest.');

    insert into public.workout_exercise_sets (workout_exercise_id, student_id, set_number, reps, weight, rpe, duration_seconds) values
      (v_we03a, v_p01, 1, 6, null, 7, null),
      (v_we03a, v_p01, 2, 6, null, 7, null),
      (v_we03a, v_p01, 3, 6, null, 8, null),
      (v_we03b, v_p01, 1, null, null, 7, 6),
      (v_we03b, v_p01, 2, null, null, 7, 6),
      (v_we03b, v_p01, 3, null, null, 8, 7),
      (v_we03b, v_p01, 4, null, null, 8, 7),
      (v_we03a, v_p02, 1, 6, null, 7, null),
      (v_we03a, v_p02, 2, 6, null, 8, null),
      (v_we03b, v_p02, 1, null, null, 7, 6),
      (v_we03b, v_p02, 2, null, null, 8, 6);
  end;

  -- ==========================================================================
  -- 7. PERFORMANCE TESTS + COMPOSITE + BASELINE SESSION
  -- ==========================================================================
  v_t_vjump    := gen_random_uuid();
  v_t_bjump    := gen_random_uuid();
  v_t_40yd     := gen_random_uuid();
  v_t_plank    := gen_random_uuid();
  v_t_10stride := gen_random_uuid();

  insert into public.performance_tests (id, title, domain, description, unit, direction, active, created_by) values
    (v_t_vjump,    'Vertical Jump (SEED)',        'off_ice', 'Max vertical leap from standing.',                            'in',   'higher_is_better', true, v_admin_id),
    (v_t_bjump,    'Broad Jump (SEED)',           'off_ice', 'Standing long jump for distance.',                            'in',   'higher_is_better', true, v_admin_id),
    (v_t_40yd,     '40-Yard Sprint (SEED)',       'off_ice', 'Sprint 40 yards, fastest time of two tries.',                 's',    'lower_is_better',  true, v_admin_id),
    (v_t_plank,    'Plank Hold (SEED)',           'off_ice', 'Hold front plank to form break.',                             's',    'higher_is_better', true, v_admin_id),
    (v_t_10stride, '10-Stride On-Ice Speed (SEED)','on_ice', 'Ten strides from standstill, timed at the blue line.',         's',    'lower_is_better',  true, v_admin_id);

  v_composite_id := gen_random_uuid();
  insert into public.composite_performance_tests (id, title, description, active, created_by) values
    (v_composite_id, 'Initial Baseline Assessment (SEED)',
     'Standard pre-season athletic battery: vertical jump, broad jump, 40-yard sprint, plank hold, on-ice 10-stride speed.',
     true, v_admin_id);

  insert into public.composite_performance_test_items (composite_id, test_id, sequence) values
    (v_composite_id, v_t_vjump,    1),
    (v_composite_id, v_t_bjump,    2),
    (v_composite_id, v_t_40yd,     3),
    (v_composite_id, v_t_plank,    4),
    (v_composite_id, v_t_10stride, 5);

  v_session_id := gen_random_uuid();
  insert into public.cpt_sessions (id, composite_id, session_date, season_id, is_baseline, conditions_notes) values
    (v_session_id, v_composite_id, (d_today - 45), v_season_id, true, 'Pre-season baseline. Indoor gym + Rink A. (SEED)');

  -- Results for all 12 students on all 5 sub-tests — varied for realism
  insert into public.performance_test_results (student_id, test_id, value, recorded_at, is_baseline, context, cpt_session_id, season_id) values
    -- p01 Tyler MacKinnon - forward, strong
    (v_p01, v_t_vjump,    27.5, now() - interval '45 days', true, 'scheduled_test', v_session_id, v_season_id),
    (v_p01, v_t_bjump,    98,   now() - interval '45 days', true, 'scheduled_test', v_session_id, v_season_id),
    (v_p01, v_t_40yd,     5.2,  now() - interval '45 days', true, 'scheduled_test', v_session_id, v_season_id),
    (v_p01, v_t_plank,    90,   now() - interval '45 days', true, 'scheduled_test', v_session_id, v_season_id),
    (v_p01, v_t_10stride, 3.1,  now() - interval '45 days', true, 'scheduled_test', v_session_id, v_season_id),
    -- p02 Cole Reinhart - forward
    (v_p02, v_t_vjump,    25,   now() - interval '45 days', true, 'scheduled_test', v_session_id, v_season_id),
    (v_p02, v_t_bjump,    94,   now() - interval '45 days', true, 'scheduled_test', v_session_id, v_season_id),
    (v_p02, v_t_40yd,     5.4,  now() - interval '45 days', true, 'scheduled_test', v_session_id, v_season_id),
    (v_p02, v_t_plank,    75,   now() - interval '45 days', true, 'scheduled_test', v_session_id, v_season_id),
    (v_p02, v_t_10stride, 3.2,  now() - interval '45 days', true, 'scheduled_test', v_session_id, v_season_id),
    -- p03
    (v_p03, v_t_vjump,    22,   now() - interval '45 days', true, 'scheduled_test', v_session_id, v_season_id),
    (v_p03, v_t_bjump,    88,   now() - interval '45 days', true, 'scheduled_test', v_session_id, v_season_id),
    (v_p03, v_t_40yd,     5.6,  now() - interval '45 days', true, 'scheduled_test', v_session_id, v_season_id),
    (v_p03, v_t_plank,    60,   now() - interval '45 days', true, 'scheduled_test', v_session_id, v_season_id),
    (v_p03, v_t_10stride, 3.4,  now() - interval '45 days', true, 'scheduled_test', v_session_id, v_season_id),
    -- p04
    (v_p04, v_t_vjump,    24,   now() - interval '45 days', true, 'scheduled_test', v_session_id, v_season_id),
    (v_p04, v_t_bjump,    91,   now() - interval '45 days', true, 'scheduled_test', v_session_id, v_season_id),
    (v_p04, v_t_40yd,     5.5,  now() - interval '45 days', true, 'scheduled_test', v_session_id, v_season_id),
    (v_p04, v_t_plank,    70,   now() - interval '45 days', true, 'scheduled_test', v_session_id, v_season_id),
    (v_p04, v_t_10stride, 3.3,  now() - interval '45 days', true, 'scheduled_test', v_session_id, v_season_id),
    -- p05
    (v_p05, v_t_vjump,    26,   now() - interval '45 days', true, 'scheduled_test', v_session_id, v_season_id),
    (v_p05, v_t_bjump,    95,   now() - interval '45 days', true, 'scheduled_test', v_session_id, v_season_id),
    (v_p05, v_t_40yd,     5.3,  now() - interval '45 days', true, 'scheduled_test', v_session_id, v_season_id),
    (v_p05, v_t_plank,    82,   now() - interval '45 days', true, 'scheduled_test', v_session_id, v_season_id),
    (v_p05, v_t_10stride, 3.2,  now() - interval '45 days', true, 'scheduled_test', v_session_id, v_season_id),
    -- p06
    (v_p06, v_t_vjump,    19,   now() - interval '45 days', true, 'scheduled_test', v_session_id, v_season_id),
    (v_p06, v_t_bjump,    78,   now() - interval '45 days', true, 'scheduled_test', v_session_id, v_season_id),
    (v_p06, v_t_40yd,     5.9,  now() - interval '45 days', true, 'scheduled_test', v_session_id, v_season_id),
    (v_p06, v_t_plank,    45,   now() - interval '45 days', true, 'scheduled_test', v_session_id, v_season_id),
    (v_p06, v_t_10stride, 3.6,  now() - interval '45 days', true, 'scheduled_test', v_session_id, v_season_id),
    -- p07
    (v_p07, v_t_vjump,    23,   now() - interval '45 days', true, 'scheduled_test', v_session_id, v_season_id),
    (v_p07, v_t_bjump,    89,   now() - interval '45 days', true, 'scheduled_test', v_session_id, v_season_id),
    (v_p07, v_t_40yd,     5.5,  now() - interval '45 days', true, 'scheduled_test', v_session_id, v_season_id),
    (v_p07, v_t_plank,    65,   now() - interval '45 days', true, 'scheduled_test', v_session_id, v_season_id),
    (v_p07, v_t_10stride, 3.3,  now() - interval '45 days', true, 'scheduled_test', v_session_id, v_season_id),
    -- p08
    (v_p08, v_t_vjump,    20,   now() - interval '45 days', true, 'scheduled_test', v_session_id, v_season_id),
    (v_p08, v_t_bjump,    82,   now() - interval '45 days', true, 'scheduled_test', v_session_id, v_season_id),
    (v_p08, v_t_40yd,     5.7,  now() - interval '45 days', true, 'scheduled_test', v_session_id, v_season_id),
    (v_p08, v_t_plank,    55,   now() - interval '45 days', true, 'scheduled_test', v_session_id, v_season_id),
    (v_p08, v_t_10stride, 3.5,  now() - interval '45 days', true, 'scheduled_test', v_session_id, v_season_id),
    -- p09 Henrik Lindqvist - defense, strong
    (v_p09, v_t_vjump,    28,   now() - interval '45 days', true, 'scheduled_test', v_session_id, v_season_id),
    (v_p09, v_t_bjump,   100,   now() - interval '45 days', true, 'scheduled_test', v_session_id, v_season_id),
    (v_p09, v_t_40yd,     5.1,  now() - interval '45 days', true, 'scheduled_test', v_session_id, v_season_id),
    (v_p09, v_t_plank,   105,   now() - interval '45 days', true, 'scheduled_test', v_session_id, v_season_id),
    (v_p09, v_t_10stride, 3.0,  now() - interval '45 days', true, 'scheduled_test', v_session_id, v_season_id),
    -- p10
    (v_p10, v_t_vjump,    25,   now() - interval '45 days', true, 'scheduled_test', v_session_id, v_season_id),
    (v_p10, v_t_bjump,    93,   now() - interval '45 days', true, 'scheduled_test', v_session_id, v_season_id),
    (v_p10, v_t_40yd,     5.3,  now() - interval '45 days', true, 'scheduled_test', v_session_id, v_season_id),
    (v_p10, v_t_plank,    80,   now() - interval '45 days', true, 'scheduled_test', v_session_id, v_season_id),
    (v_p10, v_t_10stride, 3.2,  now() - interval '45 days', true, 'scheduled_test', v_session_id, v_season_id),
    -- p11
    (v_p11, v_t_vjump,    21,   now() - interval '45 days', true, 'scheduled_test', v_session_id, v_season_id),
    (v_p11, v_t_bjump,    85,   now() - interval '45 days', true, 'scheduled_test', v_session_id, v_season_id),
    (v_p11, v_t_40yd,     5.7,  now() - interval '45 days', true, 'scheduled_test', v_session_id, v_season_id),
    (v_p11, v_t_plank,    58,   now() - interval '45 days', true, 'scheduled_test', v_session_id, v_season_id),
    (v_p11, v_t_10stride, 3.5,  now() - interval '45 days', true, 'scheduled_test', v_session_id, v_season_id),
    -- p12 Caleb Marchetti - goalie
    (v_p12, v_t_vjump,    22,   now() - interval '45 days', true, 'scheduled_test', v_session_id, v_season_id),
    (v_p12, v_t_bjump,    86,   now() - interval '45 days', true, 'scheduled_test', v_session_id, v_season_id),
    (v_p12, v_t_40yd,     5.5,  now() - interval '45 days', true, 'scheduled_test', v_session_id, v_season_id),
    (v_p12, v_t_plank,    85,   now() - interval '45 days', true, 'scheduled_test', v_session_id, v_season_id),
    (v_p12, v_t_10stride, 3.4,  now() - interval '45 days', true, 'scheduled_test', v_session_id, v_season_id);

  -- ==========================================================================
  -- 8. GOAL PLANS for 2 students (Tyler MacKinnon + Henrik Lindqvist)
  -- ==========================================================================
  v_plan1_id := gen_random_uuid();
  insert into public.goal_plans (id, student_id, title, status, agreement_notes, starts_on, ends_on, created_by) values
    (v_plan1_id, v_p01, 'Tyler — Q1 Development Plan (SEED)', 'active',
     'Focus on first-step quickness and shot accuracy. Reviewed with player and parent at season start.',
     (d_today - 40), (d_today + 50), v_admin_id);

  insert into public.goal_plan_goals (plan_id, title, description, domain, category, target_value, target_unit, progress_pct, sequence) values
    (v_plan1_id, 'Increase Vertical Jump by 2 inches',
     'Target: 29.5" by end of season. Current baseline: 27.5".',
     'off_ice', 'strength', '29.5', 'in', 25, 1),
    (v_plan1_id, 'Lower 40-yard Sprint to 5.0s',
     'Improve first-step explosiveness. Baseline 5.2s.',
     'off_ice', 'speed_agility', '5.0', 's', 20, 2),
    (v_plan1_id, 'Shoot 70% on Quick-Release Drills',
     'Targeting accuracy + release time. Score 7/10 attempts on snapshots.',
     'on_ice', 'shooting', '70', '%', 40, 3);

  insert into public.goal_plan_composites (plan_id, composite_id) values
    (v_plan1_id, v_composite_id);

  v_plan2_id := gen_random_uuid();
  insert into public.goal_plans (id, student_id, title, status, agreement_notes, starts_on, ends_on, created_by) values
    (v_plan2_id, v_p09, 'Henrik — Defensive Dominance Plan (SEED)', 'active',
     'Build on already-strong baseline. Focus on gap control and breakout passing.',
     (d_today - 40), (d_today + 50), v_admin_id);

  insert into public.goal_plan_goals (plan_id, title, description, domain, category, target_value, target_unit, progress_pct, sequence) values
    (v_plan2_id, 'Lead Team in Plus/Minus',
     'Stay at +2 or better every game. Currently +0 across 3 games.',
     'on_ice', 'hockey_iq', '+15', null, 50, 1),
    (v_plan2_id, 'Hold Plank for 2 Minutes',
     'Core endurance for sustained defensive posture. Baseline 1:45.',
     'off_ice', 'strength', '120', 's', 80, 2);

  insert into public.goal_plan_composites (plan_id, composite_id) values
    (v_plan2_id, v_composite_id);

  raise notice 'Demo seed complete: 12 students, 10 drills, 8 exercises, 5 practices, 4 games, 5 workouts, 1 composite + baseline session, 2 goal plans.';
end $$;

-- ============================================================================
-- CLEANUP BLOCK — uncomment to wipe all demo data before re-seeding
-- ============================================================================
-- Run this BEFORE re-running the seed if you want a fresh slate.
-- This deletes all rows marked with the seed markers (team_label='Demo' on
-- students, '(SEED)' suffix on activities/drills/exercises/composites/tests/plans).
-- Cascades on FKs will clean up dependent rows (activity_students, attendance,
-- game_stats, workout_exercises, workout_exercise_sets, performance_test_results,
-- composite_performance_test_items, cpt_sessions, goal_plan_goals, goal_plan_composites).
--
-- /*
-- delete from public.goal_plans          where title like '%(SEED)';
-- delete from public.cpt_sessions        where conditions_notes like '%(SEED)';
-- delete from public.composite_performance_tests where title like '%(SEED)';
-- delete from public.performance_tests   where title like '%(SEED)';
-- delete from public.activities          where notes like '%(SEED)';
-- delete from public.exercises           where title like '%(SEED)';
-- delete from public.drills              where title like '%(SEED)';
-- delete from public.students            where team_label = 'Demo';
-- */
