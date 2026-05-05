import { requireRole } from '@/lib/auth';
import { getSeasonContext } from '@/lib/season';
import { PageHeader } from '@/components/ui/PageHeader';
import { ActivityLogView } from '@/components/activity-log/ActivityLogView';
import { fetchActivityLogData } from '@/lib/activity-log';

export const dynamic = 'force-dynamic';

export default async function PerformanceManagementPage() {
  await requireRole('admin', 'director');
  const seasonCtx = await getSeasonContext();
  const seasonId = seasonCtx.selected?.id ?? null;

  const { activities, students } = await fetchActivityLogData(seasonId);

  return (
    <>
      <PageHeader
        kicker="Director · Performance Management"
        title={<><em className="italic text-crimson">Activity</em> log.</>}
        description="Every activity across the academy — games, practices, workouts. Filter by student, type, or date. Click any row to open and manage it."
      />
      <ActivityLogView activities={activities} students={students} readOnly={false} />
    </>
  );
}
