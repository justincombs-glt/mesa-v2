-- ============================================================================
-- MESA v2 — Drill Library
--
-- A collection of ~40 hockey drills inspired by the structural framework of
-- USA Hockey's American Development Model (ADM): age-appropriate progressions,
-- station-based fundamentals, small-area games, and game-situation work. All
-- drill descriptions are original to MESA. No content was copied from USA
-- Hockey publications, the Mobile Coach app, admkids.com, or any other
-- copyrighted source.
--
-- Categories follow the ADM-style grouping coaches will recognize:
--   - Skating (fundamentals — emphasized per academy needs)
--   - Puck Control (stickhandling, protection, manipulation)
--   - Passing
--   - Shooting
--   - Compete (1v1, 2v1, 3v2, wall battles)
--   - Game Situation (breakouts, forecheck, neutral zone, D-zone)
--   - Goalie (positioning + tracking)
--   - Conditioning (tempo, agility)
--
-- Age groups use USA Hockey standard codes (8U, 10U, 12U, 14U, 16U, 18U).
--
-- HOW TO RUN
-- ----------
-- 1. Open Supabase SQL Editor
-- 2. Paste the entire contents of this file
-- 3. Run
-- 4. Refresh MESA — drills appear in /dashboard/drills
--
-- IDEMPOTENCY
-- -----------
-- The script starts by deleting any existing rows where the title ends with
-- "(LIBRARY)". Running it again gives you a fresh insert (replaces in place).
-- ============================================================================

do $$
declare
  v_admin_id uuid;
begin

  -- Best-effort attribution to an admin/director profile (nullable)
  select id into v_admin_id from public.profiles where role = 'admin' limit 1;
  if v_admin_id is null then
    select id into v_admin_id from public.profiles where role = 'director' limit 1;
  end if;

  -- ==========================================================================
  -- Idempotent cleanup: remove prior library drills before inserting fresh.
  -- ==========================================================================
  delete from public.drills where title like '%(LIBRARY)';

  -- ==========================================================================
  -- SKATING — 8 drills (heavy emphasis on fundamentals per Q4)
  -- ==========================================================================
  insert into public.drills (title, category, description, instructions, duration_minutes, equipment, age_groups, active, created_by) values

  ('Stride Length Progression (LIBRARY)', 'Skating',
   'Builds forward stride mechanics by isolating push extension and recovery.',
   'Skaters work blue line to blue line at quarter speed, focusing on full hip extension. Repeat at half speed, three-quarter, then full. Coach watches for heel drag and incomplete recovery on each pass.',
   10, array['Open ice'], array['8U','10U','12U','14U'], true, v_admin_id),

  ('Two-Foot Stops Both Sides (LIBRARY)', 'Skating',
   'Trains controlled stopping in both directions equally. Many players favor one side; this fixes that imbalance.',
   'Line drill from goal line. Skater accelerates to the blue line, stops two-footed, accelerates back, stops the other direction. Six reps minimum, alternating direction.',
   8, array['Open ice'], array['8U','10U','12U'], true, v_admin_id),

  ('Inside-Outside Edge Series (LIBRARY)', 'Skating',
   'Develops control on both edges through a series of single-foot glides and shifts.',
   'Six stations around the rink: glide on inside edge for 10 feet, switch to outside edge, hold. Then add a tight turn into the next station. Cycle through both feet.',
   12, array['Cones (optional)'], array['10U','12U','14U','16U'], true, v_admin_id),

  ('Crossover Circles Build-Up (LIBRARY)', 'Skating',
   'Crossover form starting slow and accelerating, both directions equally.',
   'Skate the circle in crossover form at 50% speed for one full lap, building to 75% on the second, full speed on the third. Switch directions. Coach watches that the crossover happens behind the lead foot, not in front.',
   10, array['Open ice'], array['10U','12U','14U','16U'], true, v_admin_id),

  ('Mohawk Turn Stations (LIBRARY)', 'Skating',
   'Builds the mohawk (open-hip pivot) for changing direction without losing speed.',
   'Four cones in a line, six feet apart. Skater enters at the first cone, mohawks at each subsequent cone, alternating which foot opens. Full speed on the last rep.',
   8, array['Cones'], array['12U','14U','16U','18U'], true, v_admin_id),

  ('Backward Skating Power Stride (LIBRARY)', 'Skating',
   'Reinforces the C-cut backward stride with emphasis on hip drive, not just ankle motion.',
   'Skate backward from blue line to blue line. Focus on pushing the inside edge wide and pulling back under. No forward-facing peeks. Coach calls out the cadence to slow players down.',
   8, array['Open ice'], array['10U','12U','14U'], true, v_admin_id),

  ('Transition Spins Forward to Backward (LIBRARY)', 'Skating',
   'Smooth direction changes without losing momentum.',
   'Skate forward to the blue line, plant and pivot to backward, continue to the next blue line, pivot back to forward, finish at the far goal line. Alternate which way you pivot each rep.',
   10, array['Open ice'], array['12U','14U','16U','18U'], true, v_admin_id),

  ('Tight Turn Figure-Eights (LIBRARY)', 'Skating',
   'Combines crossovers and edge work in a continuous-motion pattern.',
   'Two circles touching at one point form a figure-eight. Skater crosses over through the curves and steps through at the intersection. Two minutes per rotation, switch lead direction.',
   12, array['Open ice'], array['12U','14U','16U','18U'], true, v_admin_id),

  -- ==========================================================================
  -- PUCK CONTROL — 7 drills
  -- ==========================================================================

  ('Stationary Stickhandling Variations (LIBRARY)', 'Puck Control',
   'Hand and wrist conditioning through 8 stationary stickhandling patterns.',
   '60 seconds each of: side-to-side, front-to-back, figure-eight around feet, toe drag pulls, one-handed forehand, one-handed backhand, around the back, between the legs. Eyes up the whole time.',
   8, array['Pucks'], array['8U','10U','12U','14U'], true, v_admin_id),

  ('Cone Weave with Head Up (LIBRARY)', 'Puck Control',
   'Stickhandling through traffic while keeping vision upfield.',
   'Eight cones in a slalom pattern across the neutral zone. Skater weaves through with the puck, looking up at a coach who flashes hand signals (1, 2, 3 fingers). Call out what you see.',
   8, array['Pucks','Cones'], array['10U','12U','14U','16U'], true, v_admin_id),

  ('Toe Drag Series (LIBRARY)', 'Puck Control',
   'The toe drag pull — used to evade a poke check or shift a defender.',
   'Three stations: stationary toe drag pulls, toe drag while moving forward, toe drag while moving toward a cone (simulated defender). Finish each rep with a quick wrist shot.',
   10, array['Pucks','Cones'], array['12U','14U','16U','18U'], true, v_admin_id),

  ('Puck Protection Walk (LIBRARY)', 'Puck Control',
   'Using the body to shield the puck from a chasing defender. Builds the habit of leaning into pressure rather than away.',
   'Pairs. One player has the puck, the other applies one-hand stick pressure (no body contact). Puck carrier walks slowly across the zone, keeping the body between the defender and the puck. Switch roles every minute.',
   10, array['Pucks'], array['10U','12U','14U','16U'], true, v_admin_id),

  ('One-Handed Reach and Recover (LIBRARY)', 'Puck Control',
   'Extending the puck on one hand to evade a stick, then snapping it back to two-handed control.',
   'Skate along the boards. Defender (passive) puts a stick on the puck-side. Skater extends one-handed past the stick, then snaps back to two-handed and accelerates away. Eight reps each side.',
   8, array['Pucks'], array['12U','14U','16U','18U'], true, v_admin_id),

  ('Tight Space Pivot Drill (LIBRARY)', 'Puck Control',
   'Handling the puck through a small box of cones using mohawks and pivots — game-realistic confined-space puck movement.',
   'A 10x10 ft box of cones. Skater enters with the puck and must exit through a designated side after at least one pivot and one direction change. Time each rep; faster is better but must stay in the box.',
   10, array['Pucks','Cones'], array['12U','14U','16U','18U'], true, v_admin_id),

  ('Two-Puck Stickhandling (LIBRARY)', 'Puck Control',
   'Advanced hands development — controlling two pucks at once forces precision and isolates fine motor control.',
   '60 seconds of stationary work with two pucks side-by-side. Move them in unison, then alternately, then in a figure-eight pattern. Drop one if it gets away, recover, continue.',
   6, array['Pucks (multiple)'], array['14U','16U','18U'], true, v_admin_id),

  ('Puck Pickup Reaction (LIBRARY)', 'Puck Control',
   'Coach throws a puck into the zone at unpredictable angles; skater reads, retrieves, and exits with control.',
   'Skater stands at the blue line. Coach randomly tosses a puck to a corner or behind the net. Skater retrieves, controls, and exits through a marked gate. Six reps each player.',
   8, array['Pucks','Cones (gate)'], array['10U','12U','14U','16U'], true, v_admin_id),

  -- ==========================================================================
  -- PASSING — 5 drills
  -- ==========================================================================

  ('Stationary Crisp Passes (LIBRARY)', 'Passing',
   'Foundational pairing — passes flat to the tape, received soft.',
   'Pairs 15 feet apart. 50 forehand passes each, then 50 backhand. Receiver cushions the puck to a controlled stop, then returns. No saucers in this drill — focus is flat-on-the-ice crispness.',
   10, array['Pucks'], array['8U','10U','12U','14U'], true, v_admin_id),

  ('Moving 2-Pass Up-Ice (LIBRARY)', 'Passing',
   'Two players move up ice exchanging passes at game pace.',
   'Two skaters start at the goal line, ten feet apart. Pass and skate, pass and skate, finish with a shot at the far net. Three reps each side. The pass must lead the receiver into open ice, not behind.',
   10, array['Pucks'], array['10U','12U','14U','16U'], true, v_admin_id),

  ('Saucer Pass over Obstacle (LIBRARY)', 'Passing',
   'Lifting the puck over a stick or stick on ice to reach a teammate. The saucer must land flat for the receiver to handle.',
   'Pairs 20 feet apart with a stick laying flat between them. Saucer passes both directions, 10 each side. Receiver must catch and control, not just stop.',
   8, array['Pucks','Sticks'], array['12U','14U','16U','18U'], true, v_admin_id),

  ('Triangle Passing Stations (LIBRARY)', 'Passing',
   'Three-player rotational passing — read the open passing lane.',
   'Three players form a triangle, 20 ft sides. Passes go around the triangle in one direction for 60 seconds, then reverse. Coach calls "switch direction" without warning — players must adapt.',
   10, array['Pucks'], array['10U','12U','14U'], true, v_admin_id),

  ('Give-and-Go Pattern (LIBRARY)', 'Passing',
   'The give-and-go — pass to a teammate, skate into open ice, receive the return pass.',
   'Pairs at the blue line. Player A passes to B and skates forward into open ice; B returns the pass to A in stride; A skates in for a shot. Three reps, then switch roles. Pass must lead the skater.',
   10, array['Pucks'], array['12U','14U','16U','18U'], true, v_admin_id),

  -- ==========================================================================
  -- SHOOTING — 5 drills
  -- ==========================================================================

  ('Stationary Shot Form Reps (LIBRARY)', 'Shooting',
   'Pure shooting mechanics from a stationary position. Focus on weight transfer and follow-through.',
   '20 wrist shots from the top of the circle, 20 snap shots from the slot, 10 backhand shots from the high slot. Goalie active. Coach watches for opening the body too early.',
   10, array['Pucks'], array['10U','12U','14U','16U'], true, v_admin_id),

  ('Quick Release in Stride (LIBRARY)', 'Shooting',
   'Receive a pass and shoot in under one second. Game-realistic.',
   'Coach passes from the boards to a skater moving through the slot. Skater shoots in one motion without breaking stride. 10 reps each side. The shot doesn''t need to score — the speed of release is the measure.',
   10, array['Pucks'], array['12U','14U','16U','18U'], true, v_admin_id),

  ('One-Timer Setup (LIBRARY)', 'Shooting',
   'Setting up and timing a one-timer from a pass. Foot positioning is everything.',
   'Passer from the half-wall, shooter at the top of the off-side circle. 15 one-timers each player. Goalie active. Coach reminds shooters: open hip, weight back at receipt, follow through.',
   10, array['Pucks'], array['14U','16U','18U'], true, v_admin_id),

  ('Screen and Rebound Net Front (LIBRARY)', 'Shooting',
   'Net-front skill — establishing position, screening the goalie, hammering rebounds.',
   'Defenseman shoots from the point. Forward sets up in front, screens, and looks for the rebound. 10 reps. Goalie active. Forward switches to puck-side of the goalie depending on the shot.',
   10, array['Pucks'], array['12U','14U','16U','18U'], true, v_admin_id),

  ('Curl and Drag Shot (LIBRARY)', 'Shooting',
   'Curling off the wall, dragging the puck to the middle, releasing a quick shot — a staple offensive zone move.',
   'Skater enters the zone wide, curls toward the middle of the slot, dragging the puck across their body, releases a wrist shot. 10 reps each side. Goalie active.',
   10, array['Pucks'], array['14U','16U','18U'], true, v_admin_id),

  -- ==========================================================================
  -- COMPETE — 5 drills (1v1 / 2v1 / battles)
  -- ==========================================================================

  ('1-on-1 from Center Ice (LIBRARY)', 'Compete',
   'Defender starts in good gap, attacker brings puck. Read the gap, beat the defender.',
   'Attacker starts at the red line with the puck, defender 15 feet ahead. Live 1v1 into the offensive zone, finishing at the net. Six reps each player, alternating role.',
   12, array['Pucks'], array['12U','14U','16U','18U'], true, v_admin_id),

  ('2-on-1 Rush (LIBRARY)', 'Compete',
   'Classic rush situation. Attacker decisions: shoot or pass. Defender decisions: take the pass or take the puck carrier.',
   'Two attackers vs one defender, starting from the blue line and going at the far net. Eight reps. Defenders must commit early — don''t over-pursue or back off too far.',
   12, array['Pucks'], array['12U','14U','16U','18U'], true, v_admin_id),

  ('3-on-2 Continuous (LIBRARY)', 'Compete',
   'Three forwards vs two defenders, with the next group entering immediately when the play ends.',
   'New 3-on-2 starts every 30 seconds. Coach blows whistle and feeds a puck. Play to a goal, frozen puck, or zone clear. High pace for 8-10 minutes.',
   10, array['Pucks'], array['14U','16U','18U'], true, v_admin_id),

  ('Wall Battle 1-on-1 (LIBRARY)', 'Compete',
   'Two players battle for a loose puck along the boards. Position, leverage, and stick angle matter more than strength.',
   'Coach throws a puck along the boards. Two players battle for possession. Winner exits the zone with the puck; loser tries to lift the stick or take the body. 30 seconds per rep, eight reps.',
   10, array['Pucks'], array['12U','14U','16U','18U'], true, v_admin_id),

  ('Small Area 2-on-2 Cross-Ice (LIBRARY)', 'Compete',
   'Continuous 2-on-2 in cross-ice space. Lots of touches, lots of reads.',
   'Cross-ice game from blue line to blue line, two small nets. Teams of two players each. Continuous play for 2 minutes, then rotate. Coach can introduce constraints (3-pass rule, no offside, etc.).',
   12, array['Pucks','Small nets','Cones (zone boundaries)'], array['10U','12U','14U','16U'], true, v_admin_id),

  -- ==========================================================================
  -- GAME SITUATION — 4 drills (systems work)
  -- ==========================================================================

  ('5-on-0 Breakout Patterns (LIBRARY)', 'Game Situation',
   'Walking through the team''s breakout patterns at slow speed before scaling to game pace. No defenders.',
   'Coach blows whistle, defenseman retrieves a dumped puck behind the net. Forwards establish breakout support positions (strong-side wing low, weak-side wing high, center high). Walk through three different patterns: D-to-D, D-to-wing, reverse. Build to full speed once the pattern is clean.',
   12, array['Pucks'], array['12U','14U','16U','18U'], true, v_admin_id),

  ('Neutral Zone Regroup (LIBRARY)', 'Game Situation',
   'When the breakout stalls, the team regroups in the neutral zone and attacks again. Practices spacing and timing.',
   'Five forwards start to attack, then coach blows whistle. Forwards stop and regroup, passing back to a defenseman who hits a streaking forward. Attack the far blue line. 8 reps.',
   10, array['Pucks'], array['12U','14U','16U','18U'], true, v_admin_id),

  ('1-2-2 Forecheck Walkthrough (LIBRARY)', 'Game Situation',
   'Three-forward forecheck with one player pressuring puck and two supporting wide. Practices angling and contain.',
   'Coach starts the puck behind the net. F1 pressures from the strong side, F2 supports up high, F3 contains the weak-side board area. Defenders try to break out. Run six reps, switch roles.',
   12, array['Pucks'], array['14U','16U','18U'], true, v_admin_id),

  ('Defensive Zone Coverage Box (LIBRARY)', 'Game Situation',
   'Practicing the box-plus-one in the defensive zone — defenders low, wings on the points, center sliding.',
   'Coach plays a puck into the defensive zone. Defenders take low positions, wings on the points, center supports puck-side. Once possession is won, breakout pattern starts. 8 reps total.',
   10, array['Pucks'], array['14U','16U','18U'], true, v_admin_id),

  -- ==========================================================================
  -- GOALIE — 3 drills (positioning + tracking)
  -- ==========================================================================

  ('Post Integration Series (LIBRARY)', 'Goalie',
   'Tying the goalie to the post on lateral plays — VH (vertical-horizontal) and RVH (reverse-VH) positioning.',
   'Coach shoots from the wall, behind the net, then back to the slot. Goalie must drop to VH or RVH on the wall shot, recover to the slot before the next shot. 10 sequences per goalie.',
   12, array['Pucks'], array['12U','14U','16U','18U'], true, v_admin_id),

  ('Lateral Push and Track (LIBRARY)', 'Goalie',
   'Pure lateral movement — pushing off one leg, sealing the second post.',
   'Coach passes from one side of the slot to the other. Goalie pushes from one post to the other, must seal the second post before the shot arrives. 12 sequences, alternating directions.',
   10, array['Pucks'], array['10U','12U','14U','16U','18U'], true, v_admin_id),

  ('Rebound Control and Recovery (LIBRARY)', 'Goalie',
   'Steering rebounds to the corners, then recovering to challenge the next shot.',
   'Three shooters in sequence from high slot, low slot, and side wall. Goalie must control the first rebound (to the corner, not center), then recover for the next shot. 8 sequences per goalie.',
   12, array['Pucks'], array['12U','14U','16U','18U'], true, v_admin_id),

  -- ==========================================================================
  -- CONDITIONING — 3 drills (tempo + agility, on-ice)
  -- ==========================================================================

  ('Russian Circles (LIBRARY)', 'Conditioning',
   'Hard-skating tempo work on the circles. Tough cardio with a hockey-specific movement pattern.',
   'Skate hard around one circle, sprint to the next, hard around again, sprint to the next. Hit all five circles in sequence. 90 seconds of work, 60 seconds of rest, three sets.',
   10, array['Open ice'], array['12U','14U','16U','18U'], true, v_admin_id),

  ('Blue Line to Blue Line Sprints (LIBRARY)', 'Conditioning',
   'Pure speed work. Short bursts, full recovery.',
   'Sprint from goal line to blue line, glide to red line, sprint to far blue line, glide to far goal line. Six reps with full rest between. The point is max effort each sprint.',
   8, array['Open ice'], array['10U','12U','14U','16U','18U'], true, v_admin_id),

  ('Stop-and-Start Agility (LIBRARY)', 'Conditioning',
   'Quick changes of direction at the blue lines — game-realistic anaerobic work.',
   'On the whistle, skate forward at full speed. Whistle again: stop and reverse direction. Random whistle timings for 60 seconds. 60 seconds rest, repeat four times.',
   10, array['Open ice','Whistle'], array['10U','12U','14U','16U','18U'], true, v_admin_id);

  raise notice 'Drill library loaded: 40 drills inserted, tagged (LIBRARY).';
end $$;

-- ============================================================================
-- CLEANUP BLOCK — to remove drill library
-- ============================================================================
-- Uncomment and run if you want to wipe the library without re-seeding.
--
-- /*
-- delete from public.drills where title like '%(LIBRARY)';
-- */
