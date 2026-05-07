import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getSeasonContext } from '@/lib/season';
import { PageHeader } from '@/components/ui/PageHeader';
import { StudentsClient } from './StudentsClient';
import type { Student, FamilyLink, SeasonEnrollment } from '@/lib/supabase/types';

export const dynamic = 'force-dynamic';

export interface StudentRow extends Student {
  parentCount: number;
  hasLogin: boolean;
  enrollment: SeasonEnrollment | null;
}

export default async function StudentsPage() {
  await requireRole('admin', 'director');
  const supabase = createClient();

  const seasonCtx = await getSeasonContext();
  const seasonId = seasonCtx.selected?.id;

  const { data: studentRows } = await supabase.from('students').select('*').order('full_name');
  const students = (studentRows ?? []) as Student[];

  const studentIds = students.map((s) => s.id);
  const parentCountMap = new Map<string, number>();
  if (studentIds.length > 0) {
    const { data: linkRows } = await supabase
      .from('family_links').select('student_id').in('student_id', studentIds);
    ((linkRows ?? []) as Pick<FamilyLink, 'student_id'>[]).forEach((l) => {
      parentCountMap.set(l.student_id, (parentCountMap.get(l.student_id) ?? 0) + 1);
    });
  }

  // Current-season enrollments for each student
  const enrollmentMap = new Map<string, SeasonEnrollment>();
  if (seasonId && studentIds.length > 0) {
    const { data: enrollRows } = await supabase
      .from('season_enrollments').select('*').eq('season_id', seasonId).in('student_id', studentIds);
    ((enrollRows ?? []) as SeasonEnrollment[]).forEach((e) => enrollmentMap.set(e.student_id, e));
  }

  const rows: StudentRow[] = students.map((s) => ({
    ...s,
    parentCount: parentCountMap.get(s.id) ?? 0,
    hasLogin: s.profile_id !== null,
    enrollment: enrollmentMap.get(s.id) ?? null,
  }));

  // Roster for current season = enrolled AND not departed
  const roster = rows.filter((r) => r.enrollment !== null && r.enrollment.departed_on === null);
  // Not enrolled = active students NOT in roster
  const notEnrolled = rows.filter((r) => r.active && (r.enrollment === null || r.enrollment.departed_on !== null));
  const inactive = rows.filter((r) => !r.active);

  return (
    <>
      <PageHeader
        kicker="Director · Students"
        title={<>Academy <em className="italic text-crimson">students</em>.</>}
        description={
          seasonCtx.selected
            ? `Current view: ${seasonCtx.selected.name}. Roster shows students enrolled in this season. Enroll additional academy students into this season from the All Students tab.`
            : 'Enroll students, link parents and student accounts, manage profiles.'
        }
        actions={<StudentsClient roster={[]} notEnrolled={[]} inactive={[]} seasonId={null} seasonArchived={seasonCtx.isArchived} addOnly />}
      />

      {rows.length === 0 ? (
        <div className="card-base p-10 text-center">
          <h3 className="font-serif text-xl text-ink mb-2">No students enrolled yet</h3>
          <p className="text-sm text-ink-dim max-w-md mx-auto mb-6">
            Enroll your first student. They&apos;ll automatically be added to the current season.
          </p>
          <StudentsClient roster={[]} notEnrolled={[]} inactive={[]} seasonId={seasonId ?? null} seasonArchived={seasonCtx.isArchived} addOnly primaryAction />
        </div>
      ) : (
        <StudentsClient
          roster={roster}
          notEnrolled={notEnrolled}
          inactive={inactive}
          seasonId={seasonId ?? null}
          seasonArchived={seasonCtx.isArchived}
        />
      )}
    </>
  );
}
