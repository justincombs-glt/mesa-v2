import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { getSeasonContext } from '@/lib/season';
import { PageHeader } from '@/components/ui/PageHeader';
import { InsightsView } from '@/components/insights/InsightsView';
import { buildStudentInsights } from '@/lib/student-insights';

export const dynamic = 'force-dynamic';

export default async function StudentInsightsPage({ params }: { params: { id: string } }) {
  // Q7 = B: all staff can view insights
  await requireRole('admin', 'director', 'coach', 'trainer');
  const seasonCtx = await getSeasonContext();

  const data = await buildStudentInsights(
    params.id,
    seasonCtx.selected?.id ?? null,
    seasonCtx.selected?.name ?? null,
  );
  if (!data) notFound();

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
          ? `Auto-populated review data for ${data.seasonName}. Click a goal to follow it back to the plan.`
          : 'Auto-populated review data across all seasons.'}
      />
      <InsightsView data={data} />
    </>
  );
}
