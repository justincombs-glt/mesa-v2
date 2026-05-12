import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/PageHeader';
import { buildNutritionData } from '@/lib/nutrition';
import { NutritionTracker } from '@/components/nutrition/NutritionTracker';
import type { Student } from '@/lib/supabase/types';

export const dynamic = 'force-dynamic';

export default async function FamilyNutritionPage({ params }: { params: { studentId: string } }) {
  const profile = await requireProfile();
  const supabase = createClient();

  // Only parents land here; staff don't have nutrition access (Q2 = B).
  if (profile.role !== 'parent') notFound();

  // Verify the parent is linked to this child
  const { data: link } = await supabase
    .from('family_links').select('id')
    .eq('parent_id', profile.id).eq('student_id', params.studentId).maybeSingle();
  if (!link) notFound();

  const { data: studentRow } = await supabase
    .from('students').select('*').eq('id', params.studentId).single();
  if (!studentRow) notFound();
  const student = studentRow as unknown as Student;

  const data = await buildNutritionData(student.id);

  return (
    <>
      <PageHeader
        kicker={
          <>
            <Link href="/dashboard/family" className="hover:text-ink">My Family</Link>
            <span className="mx-2">&middot;</span>
            <Link href={`/dashboard/family/${student.id}`} className="hover:text-ink">{student.full_name}</Link>
            <span className="mx-2">&middot;</span>
            Nutrition
          </>
        }
        title={<><em className="italic text-crimson">{student.full_name.split(' ')[0]}</em>&apos;s nutrition</>}
        description="Help your child stay properly fueled. You can set a goal, log items together, or just review their history."
      />
      <NutritionTracker
        studentId={student.id}
        studentName={student.full_name}
        data={data}
        viewerRole="parent"
        allowGoalSelfSet={true}
      />
    </>
  );
}
