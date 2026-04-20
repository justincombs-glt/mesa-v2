import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/PageHeader';
import { StudentsClient } from './StudentsClient';
import type { Student, FamilyLink } from '@/lib/supabase/types';

export const dynamic = 'force-dynamic';

export interface StudentRow extends Student {
  parentCount: number;
  hasLogin: boolean;
}

export default async function StudentsPage() {
  await requireRole('admin', 'director');
  const supabase = createClient();

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

  const rows: StudentRow[] = students.map((s) => ({
    ...s,
    parentCount: parentCountMap.get(s.id) ?? 0,
    hasLogin: s.profile_id !== null,
  }));

  const active = rows.filter((r) => r.active);
  const inactive = rows.filter((r) => !r.active);

  return (
    <>
      <PageHeader
        kicker="Director · Students"
        title={<>Academy <em className="italic text-crimson">students</em>.</>}
        description="Enroll students, link parents and student accounts, manage profiles. Coaches and trainers see all active students automatically."
        actions={<StudentsClient students={[]} addOnly />}
      />

      {rows.length === 0 ? (
        <div className="card-base p-10 text-center">
          <h3 className="font-serif text-xl text-ink mb-2">No students enrolled yet</h3>
          <p className="text-sm text-ink-dim max-w-md mx-auto mb-6">
            Enroll your first student. You can link parents and link a student account afterward.
          </p>
          <StudentsClient students={[]} addOnly primaryAction />
        </div>
      ) : (
        <StudentsClient students={active} inactiveStudents={inactive} />
      )}
    </>
  );
}
