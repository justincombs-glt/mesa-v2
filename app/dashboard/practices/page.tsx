import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getSeasonContext } from '@/lib/season';
import { PageHeader } from '@/components/ui/PageHeader';
import { PracticesClient } from './PracticesClient';
import type { Activity, Student, PracticePlan } from '@/lib/supabase/types';

export const dynamic = 'force-dynamic';

export interface PracticeRow extends Activity {
  roster_count: number;
  attendance_marked: number;
  source_plan_title: string | null;
}

export default async function PracticesPage() {
  await requireRole('admin', 'director', 'coach');
  const supabase = createClient();
  const seasonCtx = await getSeasonContext();
  const seasonId = seasonCtx.selected?.id;

  let practiceQuery = supabase
    .from('activities').select('*')
    .eq('activity_type', 'practice')
    .order('occurred_on', { ascending: false });
  if (seasonId) practiceQuery = practiceQuery.eq('season_id', seasonId);

  const { data: practiceRows } = await practiceQuery;
  const practices = (practiceRows ?? []) as Activity[];

  // Active students (for the "New practice" modal roster)
  const { data: studentRows } = await supabase
    .from('students').select('id, full_name, jersey_number, position, active')
    .eq('active', true).order('full_name');
  const students = (studentRows ?? []) as Array<Pick<Student, 'id' | 'full_name' | 'jersey_number' | 'position' | 'active'>>;

  // Roster count + attendance count per practice
  const rosterMap = new Map<string, number>();
  const attendanceMap = new Map<string, number>();
  if (practices.length > 0) {
    const ids = practices.map((p) => p.id);
    const [{ data: rosterRows }, { data: attRows }] = await Promise.all([
      supabase.from('activity_students').select('activity_id').in('activity_id', ids),
      supabase.from('attendance').select('activity_id, attended').in('activity_id', ids).not('attended', 'is', null),
    ]);
    ((rosterRows ?? []) as Array<{ activity_id: string }>).forEach((r) => {
      rosterMap.set(r.activity_id, (rosterMap.get(r.activity_id) ?? 0) + 1);
    });
    ((attRows ?? []) as Array<{ activity_id: string }>).forEach((a) => {
      attendanceMap.set(a.activity_id, (attendanceMap.get(a.activity_id) ?? 0) + 1);
    });
  }

  // Look up plan titles for rows that reference a plan
  const planIds = Array.from(new Set(practices.map((p) => p.source_practice_plan_id).filter(Boolean))) as string[];
  const planTitleMap = new Map<string, string>();
  if (planIds.length > 0) {
    const { data: planRows } = await supabase.from('practice_plans').select('id, title').in('id', planIds);
    ((planRows ?? []) as Array<Pick<PracticePlan, 'id' | 'title'>>).forEach((p) => {
      planTitleMap.set(p.id, p.title);
    });
  }

  const rows: PracticeRow[] = practices.map((p) => ({
    ...p,
    roster_count: rosterMap.get(p.id) ?? 0,
    attendance_marked: attendanceMap.get(p.id) ?? 0,
    source_plan_title: p.source_practice_plan_id ? (planTitleMap.get(p.source_practice_plan_id) ?? null) : null,
  }));

  // Plans for the "start from template" dropdown
  const { data: templateRows } = await supabase
    .from('practice_plans').select('id, title, focus, duration_minutes')
    .eq('is_template', true).order('title');
  const templates = (templateRows ?? []) as Array<Pick<PracticePlan, 'id' | 'title' | 'focus' | 'duration_minutes'>>;

  return (
    <>
      <PageHeader
        kicker={seasonCtx.selected ? `Coach · Practices · ${seasonCtx.selected.name}` : 'Coach · Practices'}
        title={<>Scheduled <em className="italic text-crimson">practices</em>.</>}
        description="Schedule practices, manage the roster, log attendance. Start from a practice plan template or build from scratch."
        actions={
          <PracticesClient
            practices={[]} students={students} templates={templates}
            seasonId={seasonId ?? null} seasonArchived={seasonCtx.isArchived}
            addOnly
          />
        }
      />

      <PracticesClient
        practices={rows}
        students={students}
        templates={templates}
        seasonId={seasonId ?? null}
        seasonArchived={seasonCtx.isArchived}
      />
    </>
  );
}
