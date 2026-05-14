import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/PageHeader';
import { buildNutritionHistory } from '@/lib/nutrition';
import { HistoryListView } from '@/components/nutrition/HistoryListView';
import type { Student } from '@/lib/supabase/types';

export const dynamic = 'force-dynamic';

export default async function FamilyNutritionHistoryPage({ params }: { params: { studentId: string } }) {
  const profile = await requireProfile();
  const supabase = createClient();

  // Same gating as the parent's main nutrition page: parent role + family link.
  if (profile.role !== 'parent') notFound();

  const { data: link } = await supabase
    .from('family_links').select('id')
    .eq('parent_id', profile.id).eq('student_id', params.studentId).maybeSingle();
  if (!link) notFound();

  const { data: studentRow } = await supabase
    .from('students').select('*').eq('id', params.studentId).single();
  if (!studentRow) notFound();
  const student = studentRow as unknown as Student;

  const { goal, days } = await buildNutritionHistory(student.id);

  return (
    <>
      <PageHeader
        kicker={
          <>
            <Link href="/dashboard/family" className="hover:text-ink">My Family</Link>
            <span className="mx-2">&middot;</span>
            <Link href={`/dashboard/family/${student.id}`} className="hover:text-ink">{student.full_name}</Link>
            <span className="mx-2">&middot;</span>
            <Link href={`/dashboard/family/${student.id}/nutrition`} className="hover:text-ink">Nutrition</Link>
            <span className="mx-2">&middot;</span>
            History
          </>
        }
        title={<><em className="italic text-crimson">{student.full_name.split(' ')[0]}</em>&apos;s history</>}
        description="Every day with logged entries, most recent first. Read-only."
      />
      <HistoryListView days={days} goal={goal?.daily_calories ?? null} />
    </>
  );
}
