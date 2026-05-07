import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getSeasonContext } from '@/lib/season';
import { PageHeader } from '@/components/ui/PageHeader';
import { InsightsView } from '@/components/insights/InsightsView';
import { buildStudentInsights } from '@/lib/student-insights';
import type { Review } from '@/lib/supabase/types';

export const dynamic = 'force-dynamic';

export default async function StudentInsightsPage({ params }: { params: { id: string } }) {
  await requireRole('admin', 'director', 'coach', 'trainer');
  const seasonCtx = await getSeasonContext();
  const supabase = createClient();

  const data = await buildStudentInsights(
    params.id,
    seasonCtx.selected?.id ?? null,
    seasonCtx.selected?.name ?? null,
  );
  if (!data) notFound();

  const { data: reviewRows } = await supabase
    .from('reviews').select('*').eq('student_id', params.id)
    .order('completed_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });
  const reviews = (reviewRows ?? []) as Review[];

  return (
    <>
      <PageHeader
        kicker={
          <>
            <Link href="/dashboard/students" className="hover:text-ink">Students</Link>
            <span className="mx-2">·</span>
            <Link href={`/dashboard/students/${params.id}`} className="hover:text-ink">{data.student.full_name}</Link>
            <span className="mx-2">·</span>
            Insights
          </>
        }
        title={
          <>
            <em className="italic">{data.student.full_name}</em>
            <span className="ml-3 text-base font-normal text-ink-faint">— Insights</span>
          </>
        }
        description={data.seasonName
          ? `Auto-populated review data for ${data.seasonName}. Save a snapshot or click a past review to see what was true on a given date.`
          : 'Auto-populated review data across all seasons.'}
      />
      <InsightsView data={data} reviews={reviews} />
    </>
  );
}
