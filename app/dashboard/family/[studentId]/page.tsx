import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/PageHeader';
import { StudentDashboardView } from '@/components/student/StudentDashboardView';
import { buildStudentDashboard } from '@/lib/student-dashboard';
import { FamilyControls } from './FamilyControls';

export const dynamic = 'force-dynamic';

export default async function FamilyStudentPage({ params }: { params: { studentId: string } }) {
  const profile = await requireProfile();
  const supabase = createClient();

  // Authorization: admin/director always allowed; parent must have a family_link
  // to this student; staff can view via existing role permissions.
  let canView = profile.role === 'admin' || profile.role === 'director'
    || profile.role === 'coach' || profile.role === 'trainer';

  if (!canView && profile.role === 'parent') {
    const { data: link } = await supabase
      .from('family_links').select('id')
      .eq('parent_id', profile.id).eq('student_id', params.studentId).maybeSingle();
    canView = !!link;
  }

  if (!canView) notFound();

  const data = await buildStudentDashboard(params.studentId);
  if (!data) notFound();

  // Phase 14: parents get controls (edit team, schedule game). Staff don't need
  // them here — they have their own admin tools.
  const showFamilyControls = profile.role === 'parent';

  return (
    <>
      <PageHeader
        kicker={
          <>
            <Link href="/dashboard/family" className="hover:text-ink">My Family</Link>
            <span className="mx-2">&middot;</span>
            {data.seasonName ?? 'Current season'}
          </>
        }
        title={<em className="italic text-crimson">{data.student.full_name}</em>}
        description="Read-only view of your child's training data."
      />
      {showFamilyControls && (
        <div className="mb-6">
          <FamilyControls
            student={{
              id: data.student.id,
              full_name: data.student.full_name,
              team_label: data.student.team_label,
            }}
          />
        </div>
      )}
      <StudentDashboardView data={data} isParentView />
    </>
  );
}
