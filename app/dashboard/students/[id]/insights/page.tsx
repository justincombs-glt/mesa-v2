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
  const profile = await requireRole('admin', 'director', 'coach', 'trainer');
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

  // Phase 15b: trainers (and ONLY trainers) get a link to this student's
  // nutrition log here. Other staff don't have nutrition access.
  const showNutritionLink = profile.role === 'trainer';

  return (
    <>
      <PageHeader
        kicker={
          <>
            <Link href="/dashboard/students" className="hover:text-ink">Students</Link>
            <span className="mx-2">&middot;</span>
            <Link href={`/dashboard/students/${params.id}`} className="hover:text-ink">{data.student.full_name}</Link>
            <span className="mx-2">&middot;</span>
            Insights
          </>
        }
        title={
          <>
            <em className="italic">{data.student.full_name}</em>
            <span className="ml-3 text-base font-normal text-ink-faint">&mdash; Insights</span>
          </>
        }
        description={data.seasonName
          ? `Auto-populated review data for ${data.seasonName}. Save a snapshot or click a past review to see what was true on a given date.`
          : 'Auto-populated review data across all seasons.'}
      />
      {showNutritionLink && (
        <div className="mb-6 -mt-2">
          <Link
            href={`/dashboard/nutrition-overview/${params.id}`}
            className="text-[11px] font-mono uppercase tracking-wider text-ink-faint hover:text-crimson inline-flex items-center gap-1"
          >
            View nutrition log <span aria-hidden>&rarr;</span>
          </Link>
        </div>
      )}
      <InsightsView data={data} reviews={reviews} />
    </>
  );
}
