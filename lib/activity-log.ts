import { createClient } from '@/lib/supabase/server';
import type { Activity, ActivityType, Student } from '@/lib/supabase/types';
import type { ActivityRowData } from '@/components/activity-log/ActivityLogView';

export type StudentLite = Pick<Student, 'id' | 'full_name' | 'jersey_number' | 'active'>;

export interface ActivityLogData {
  activities: ActivityRowData[];
  students: StudentLite[];
}

/**
 * Fetches up to 200 activities scoped to the given season (or all seasons if
 * seasonId is null) along with the active student roster. Each activity is
 * enriched with a `student_names` array of the players linked to it.
 *
 * `excludeTypes` filters out activities of the given types at fetch time
 * (e.g. coach view excludes 'off_ice_workout' since that's trainer's domain).
 *
 * Used by both the director home page (read-only week view) and the
 * performance-management page (editable workbench), and by the coach home
 * page (read-only week view, no workouts).
 */
export async function fetchActivityLogData(
  seasonId: string | null,
  excludeTypes: ActivityType[] = [],
): Promise<ActivityLogData> {
  const supabase = createClient();

  let activityQuery = supabase.from('activities').select('*').order('occurred_on', { ascending: false }).limit(200);
  if (seasonId) {
    activityQuery = activityQuery.eq('season_id', seasonId);
  }
  if (excludeTypes.length > 0) {
    activityQuery = activityQuery.not('activity_type', 'in', `(${excludeTypes.map((t) => `"${t}"`).join(',')})`);
  }

  const [{ data: activityRows }, { data: studentRows }] = await Promise.all([
    activityQuery,
    supabase.from('students').select('id, full_name, jersey_number, active').eq('active', true).order('full_name'),
  ]);

  const activities = (activityRows ?? []) as Activity[];
  const students = (studentRows ?? []) as StudentLite[];

  const activityStudentMap = new Map<string, string[]>();
  if (activities.length > 0) {
    const { data: linkRows } = await supabase
      .from('activity_students').select('activity_id, student_id')
      .in('activity_id', activities.map((a) => a.id));
    const studentNameMap = new Map(students.map((s) => [s.id, s.full_name]));
    ((linkRows ?? []) as Array<{ activity_id: string; student_id: string }>).forEach((l) => {
      const name = studentNameMap.get(l.student_id);
      if (!name) return;
      const list = activityStudentMap.get(l.activity_id) ?? [];
      list.push(name);
      activityStudentMap.set(l.activity_id, list);
    });
  }

  const enriched: ActivityRowData[] = activities.map((a) => ({
    ...a,
    student_names: activityStudentMap.get(a.id) ?? [],
  }));

  return { activities: enriched, students };
}
