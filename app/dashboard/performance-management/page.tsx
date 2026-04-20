import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getSeasonContext } from '@/lib/season';
import { PageHeader } from '@/components/ui/PageHeader';
import { PerformanceManagementClient } from './PerformanceManagementClient';
import type { Activity, Student } from '@/lib/supabase/types';

export const dynamic = 'force-dynamic';

export interface ActivityRow extends Activity {
  student_names: string[];
}

export default async function PerformanceManagementPage() {
  await requireRole('admin', 'director');
  const supabase = createClient();
  const seasonCtx = await getSeasonContext();
  const seasonId = seasonCtx.selected?.id;

  let activityQuery = supabase.from('activities').select('*').order('occurred_on', { ascending: false }).limit(200);
  if (seasonId) {
    activityQuery = activityQuery.eq('season_id', seasonId);
  }

  const [{ data: activityRows }, { data: studentRows }] = await Promise.all([
    activityQuery,
    supabase.from('students').select('id, full_name, jersey_number, active').eq('active', true).order('full_name'),
  ]);

  const activities = (activityRows ?? []) as Activity[];
  const students = (studentRows ?? []) as Array<Pick<Student, 'id' | 'full_name' | 'jersey_number' | 'active'>>;

  // Students per activity
  const activityStudentMap = new Map<string, string[]>();
  if (activities.length > 0) {
    const { data: linkRows } = await supabase
      .from('activity_students').select('activity_id, student_id').in('activity_id', activities.map((a) => a.id));
    const studentNameMap = new Map(students.map((s) => [s.id, s.full_name]));
    ((linkRows ?? []) as Array<{ activity_id: string; student_id: string }>).forEach((l) => {
      const name = studentNameMap.get(l.student_id);
      if (!name) return;
      const list = activityStudentMap.get(l.activity_id) ?? [];
      list.push(name);
      activityStudentMap.set(l.activity_id, list);
    });
  }

  const rows: ActivityRow[] = activities.map((a) => ({
    ...a,
    student_names: activityStudentMap.get(a.id) ?? [],
  }));

  return (
    <>
      <PageHeader
        kicker="Director · Performance Management"
        title={<><em className="italic text-crimson">Activity</em> log.</>}
        description="Cross-cutting view of every activity across the academy — games, practices, workouts. Filter by student, type, or date. Read-only here — coaches log practices and games, trainers log workouts."
      />
      <PerformanceManagementClient activities={rows} students={students} />
    </>
  );
}
