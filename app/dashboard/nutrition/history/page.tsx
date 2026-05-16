import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { PageHeader } from '@/components/ui/PageHeader';
import { getLinkedStudentForProfile } from '@/lib/student-dashboard';
import { buildNutritionHistory } from '@/lib/nutrition';
import { HistoryListView } from '@/components/nutrition/HistoryListView';

export const dynamic = 'force-dynamic';

export default async function NutritionHistoryPage() {
  const profile = await requireRole('student', 'player');

  const student = await getLinkedStudentForProfile(profile.id);
  if (!student) {
    return (
      <>
        <PageHeader
          kicker={
            <>
              <Link href="/dashboard/nutrition" className="hover:text-ink">My nutrition</Link>
              <span className="mx-2">&middot;</span>
              History
            </>
          }
          title={<>Full <em className="italic text-crimson">history</em>.</>}
          description="Nothing to show until your account is linked to a student record."
        />
        <div className="card-base p-8 text-center">
          <p className="text-sm text-ink-dim max-w-md mx-auto">
            Your account isn&apos;t linked to a student record yet.
          </p>
        </div>
      </>
    );
  }

  const { goal, days } = await buildNutritionHistory(student.id);

  return (
    <>
      <PageHeader
        kicker={
          <>
            <Link href="/dashboard/nutrition" className="hover:text-ink">My nutrition</Link>
            <span className="mx-2">&middot;</span>
            History
          </>
        }
        title={<>Full <em className="italic text-crimson">history</em>.</>}
        description="Every day you've logged, sorted by most recent. Read-only."
      />
      <HistoryListView days={days} goal={goal?.daily_calories ?? null} />
    </>
  );
}
