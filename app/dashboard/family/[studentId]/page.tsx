import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/PageHeader';
import { StudentDashboardView } from '@/components/student/StudentDashboardView';
import { buildStudentDashboard } from '@/lib/student-dashboard';

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

  return (
    <>
      <PageHeader
        kicker={
          <>
            <Link href="/dashboard/family" className="hover:text-ink">My Family</Link>
            <span className="mx-2">·</span>
            {data.seasonName ?? 'Current season'}
          </>
        }
        title={<em className="italic text-crimson">{data.student.full_name}</em>}
        description="Read-only view of your child's training data."
      />
      <StudentDashboardView data={data} isParentView />
    </>
  );
}
