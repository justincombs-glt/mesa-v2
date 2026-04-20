// MESA v2 type definitions

export type AppRole = 'admin' | 'director' | 'coach' | 'trainer' | 'student' | 'parent';
export type PlayerPosition = 'F' | 'D' | 'G';
export type GoalDomain = 'on_ice' | 'off_ice';
export type GoalCategory =
  | 'skating' | 'puck_control' | 'passing' | 'shooting' | 'hockey_iq' | 'coachability'
  | 'strength' | 'conditioning' | 'speed_agility' | 'mental' | 'nutrition_recovery' | 'academic';
export type ActivityType = 'game' | 'practice' | 'off_ice_workout';
export type OffIceCategory = 'strength_conditioning' | 'pilates' | 'fight_club' | 'custom';
export type GoalPlanStatus = 'draft' | 'active' | 'completed' | 'archived';
export type ReviewType = 'scheduled' | 'ad_hoc';

export interface Academy {
  id: string;
  name: string;
  created_at: string;
}

export interface Season {
  id: string;
  name: string;
  starts_on: string;
  ends_on: string;
  is_current: boolean;
  archived_at: string | null;
  created_by: string | null;
  created_at: string;
}

export interface SeasonEnrollment {
  id: string;
  season_id: string;
  student_id: string;
  enrolled_on: string;
  departed_on: string | null;
  notes: string | null;
  created_at: string;
}

export interface GoalPlanComposite {
  id: string;
  plan_id: string;
  composite_id: string;
  created_at: string;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: AppRole;
  phone: string | null;
  date_of_birth: string | null;
  created_at: string;
  updated_at: string;
}

export interface Student {
  id: string;
  full_name: string;
  date_of_birth: string | null;
  jersey_number: string | null;
  position: PlayerPosition | null;
  dominant_hand: 'L' | 'R' | null;
  team_label: string | null;
  notes: string | null;
  active: boolean;
  profile_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface FamilyLink {
  id: string;
  parent_id: string;
  student_id: string;
  relationship: string | null;
  is_primary: boolean;
  created_at: string;
}

export interface Invite {
  id: string;
  email: string;
  role: AppRole;
  token: string;
  status: 'pending' | 'consumed' | 'revoked';
  note: string | null;
  invited_by: string | null;
  consumed_at: string | null;
  created_at: string;
}

export interface Drill {
  id: string;
  title: string;
  category: string;
  description: string | null;
  instructions: string | null;
  duration_minutes: number | null;
  equipment: string[] | null;
  age_groups: string[] | null;
  active: boolean;
  created_by: string | null;
  created_at: string;
}

export interface Exercise {
  id: string;
  title: string;
  category: string;
  description: string | null;
  instructions: string | null;
  default_sets: number | null;
  default_reps: number | null;
  default_duration_seconds: number | null;
  equipment: string[] | null;
  active: boolean;
  created_by: string | null;
  created_at: string;
}

export interface GoalTemplate {
  id: string;
  title: string;
  description: string | null;
  domain: GoalDomain;
  category: GoalCategory;
  target_value: number | null;
  target_unit: string | null;
  suggested_deadline_weeks: number | null;
  active: boolean;
  created_by: string | null;
  created_at: string;
}

export interface PerformanceTest {
  id: string;
  title: string;
  domain: GoalDomain;
  description: string | null;
  instructions: string | null;
  unit: string | null;
  direction: 'higher_is_better' | 'lower_is_better';
  active: boolean;
  created_by: string | null;
  created_at: string;
}

export interface CompositePerformanceTest {
  id: string;
  title: string;
  description: string | null;
  active: boolean;
  created_by: string | null;
  created_at: string;
}

export interface CompositePerformanceTestItem {
  id: string;
  composite_id: string;
  test_id: string;
  sequence: number;
  created_at: string;
}

export interface CPTSession {
  id: string;
  composite_id: string;
  session_date: string;
  administered_by: string | null;
  conditions_notes: string | null;
  is_baseline: boolean;
  season_id: string | null;
  created_at: string;
}

export interface PracticePlan {
  id: string;
  title: string;
  description: string | null;
  focus: string | null;
  duration_minutes: number | null;
  is_template: boolean;
  created_by: string | null;
  created_at: string;
}

export interface PracticePlanItem {
  id: string;
  plan_id: string;
  sequence: number;
  item_type: 'drill' | 'skill';
  drill_id: string | null;
  skill_title: string | null;
  duration_override: number | null;
  coach_notes: string | null;
  created_at: string;
}

export interface WorkoutPlan {
  id: string;
  title: string;
  description: string | null;
  focus: string | null;
  duration_minutes: number | null;
  is_template: boolean;
  created_by: string | null;
  created_at: string;
}

export interface WorkoutPlanItem {
  id: string;
  plan_id: string;
  sequence: number;
  exercise_id: string;
  default_sets: number | null;
  default_reps: number | null;
  default_weight_lbs: number | null;
  default_duration_seconds: number | null;
  default_rest_seconds: number | null;
  coach_notes: string | null;
  created_at: string;
}

export interface Activity {
  id: string;
  activity_type: ActivityType;
  occurred_on: string;
  starts_at: string | null;
  duration_minutes: number | null;
  title: string | null;
  focus: string | null;
  notes: string | null;
  logged_by: string | null;
  opponent: string | null;
  our_score: number | null;
  opp_score: number | null;
  home_away: 'home' | 'away' | null;
  venue: string | null;
  off_ice_category: OffIceCategory | null;
  custom_category_name: string | null;
  source_practice_plan_id: string | null;
  source_workout_plan_id: string | null;
  season_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ActivityStudent {
  id: string;
  activity_id: string;
  student_id: string;
  added_at: string;
}

export interface Attendance {
  id: string;
  activity_id: string;
  student_id: string;
  attended: boolean | null;
  recorded_by: string | null;
  recorded_at: string;
}

export interface GameStat {
  id: string;
  activity_id: string;
  student_id: string;
  goals: number;
  assists: number;
  plus_minus: number;
  shots: number;
  penalty_mins: number;
  time_on_ice: string | null;
  saves: number | null;
  shots_against: number | null;
  goals_against: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkoutExercise {
  id: string;
  activity_id: string;
  exercise_id: string;
  sequence: number;
  sets: number | null;
  coach_notes: string | null;
  created_at: string;
}

export interface WorkoutExerciseSet {
  id: string;
  workout_exercise_id: string;
  student_id: string;
  set_number: number;
  reps: number | null;
  weight: number | null;
  duration_seconds: number | null;
  distance_meters: number | null;
  rpe: number | null;
  notes: string | null;
  created_at: string;
}

export interface PerformanceTestResult {
  id: string;
  student_id: string;
  test_id: string;
  value: number;
  recorded_at: string;
  recorded_by: string | null;
  notes: string | null;
  is_baseline: boolean;
  context: string | null;
  cpt_session_id: string | null;
  season_id: string | null;
}

export interface GoalPlan {
  id: string;
  student_id: string;
  title: string;
  status: GoalPlanStatus;
  agreement_notes: string | null;
  starts_on: string | null;
  ends_on: string | null;
  season_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface GoalPlanGoal {
  id: string;
  plan_id: string;
  template_id: string | null;
  title: string;
  description: string | null;
  domain: GoalDomain | null;
  category: GoalCategory | null;
  target_value: string | null;
  target_unit: string | null;
  current_value: string | null;
  progress_pct: number;
  due_date: string | null;
  status: 'active' | 'achieved' | 'abandoned';
  achieved_at: string | null;
  sequence: number;
  created_at: string;
  updated_at: string;
}

export interface GoalPlanTest {
  id: string;
  plan_id: string;
  test_id: string;
  target_value: number | null;
  target_unit: string | null;
  baseline_value: number | null;
}

export interface Review {
  id: string;
  plan_id: string;
  review_type: ReviewType;
  scheduled_date: string | null;
  completed_at: string | null;
  reviewer_id: string | null;
  summary: string | null;
  concerns: string | null;
  next_steps: string | null;
  attendance_pct: number | null;
  goals_progress_notes: string | null;
  tests_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Database {
  public: {
    Tables: Record<string, { Row: unknown; Insert: unknown; Update: unknown }>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      app_role: AppRole;
      player_position: PlayerPosition;
      goal_domain: GoalDomain;
      goal_category: GoalCategory;
      activity_type: ActivityType;
      off_ice_category: OffIceCategory;
      goal_plan_status: GoalPlanStatus;
      review_type: ReviewType;
    };
  };
}
