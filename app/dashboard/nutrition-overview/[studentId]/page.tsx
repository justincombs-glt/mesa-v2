import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/PageHeader';
import { buildNutritionData } from '@/lib/nutrition';
import { TrainerNutritionView } from '@/components/nutrition/TrainerNutritionView';
import type { Student } from '@/lib/supabase/types';

export const dynamic = 'force-dynamic';

export default async function TrainerNutritionDetailPage({ params }: { params: { studentId: string } }) {
  await requireRole('trainer');
  const supabase = createClient();

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
            <Link href="/dashboard/nutrition-overview" className="hover:text-ink">Athlete nutrition</Link>
            <span className="mx-2">&middot;</span>
            {student.full_name}
          </>
        }
        title={<><em className="italic text-crimson">{student.full_name.split(' ')[0]}</em>&apos;s log</>}
        description="Read-only view. Logging and goal-setting are managed by the household."
      />
      <TrainerNutritionView studentName={student.full_name} data={data} />
    </>
  );
}
