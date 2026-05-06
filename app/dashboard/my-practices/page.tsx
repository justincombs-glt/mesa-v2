import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getSeasonContext } from '@/lib/season';
import { PageHeader } from '@/components/ui/PageHeader';
import { getLinkedStudentForProfile } from '@/lib/student-dashboard';
import type { Activity } from '@/lib/supabase/types';

export const dynamic = 'force-dynamic';

export default async function MyPracticesPage() {
  const profile = await requireRole('student');
  const supabase = createClient();
  const seasonCtx = await getSeasonContext();
  const seasonId = seasonCtx.selected?.id ?? null;

  const student = await getLinkedStudentForProfile(profile.id);
  if (!student) {
    return (
      <>
        <PageHeader
          kicker="Student"
          title="Practices"
          description="Practices you're scheduled for."
        />
        <div className="card-base p-8 text-center">
          <p className="text-sm text-ink-dim max-w-md mx-auto">
            Your account isn&apos;t linked to a student record yet. Ask your coach or the academy office to link you.
          </p>
        </div>
      </>
    );
  }

  let activities: Activity[] = [];
  if (seasonId) {
    const { data: linkRows } = await supabase
      .from('activity_students').select('activity_id').eq('student_id', student.id);
    const activityIds = ((linkRows ?? []) as Array<{ activity_id: string }>).map((r) => r.activity_id);

    if (activityIds.length > 0) {
      const { data: rows } = await supabase
        .from('activities').select('*')
        .in('id', activityIds)
        .eq('activity_type', 'practice')
        .eq('season_id', seasonId)
        .order('occurred_on', { ascending: false })
        .limit(100);
      activities = (rows ?? []) as Activity[];
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = activities.filter((a) => a.occurred_on >= today)
    .sort((a, b) => a.occurred_on.localeCompare(b.occurred_on));
  const past = activities.filter((a) => a.occurred_on < today);

  return (
    <>
      <PageHeader
        kicker={`Student · ${seasonCtx.selected?.name ?? 'No season'}`}
        title={<>My <em className="italic text-crimson">practices</em>.</>}
        description="Practices you're scheduled for. Tap one to see details."
      />

      <div className="flex flex-col gap-8">
        <section>
          <div className="kicker mb-3">Upcoming &middot; {upcoming.length}</div>
          {upcoming.length === 0 ? (
            <div className="card-base p-6 text-center text-sm text-ink-dim">
              Nothing on the schedule.
            </div>
          ) : (
            <div className="card-base overflow-hidden">
              {upcoming.map((p, idx) => <PracticeRow key={p.id} practice={p} first={idx === 0} />)}
            </div>
          )}
        </section>

        <section>
          <div className="kicker mb-3">Past &middot; {past.length}</div>
          {past.length === 0 ? (
            <div className="card-base p-6 text-center text-sm text-ink-dim">No past practices yet.</div>
          ) : (
            <div className="card-base overflow-hidden">
              {past.map((p, idx) => <PracticeRow key={p.id} practice={p} first={idx === 0} />)}
            </div>
          )}
        </section>
      </div>
    </>
  );
}

function PracticeRow({ practice, first }: { practice: Activity; first: boolean }) {
  const date = new Date(practice.occurred_on + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric',
  });

  return (
    <Link
      href={`/dashboard/my-practices/${practice.id}`}
      className={`flex items-center gap-4 px-5 py-3.5 ${first ? '' : 'border-t border-ink-hair'} group hover:bg-ivory active:bg-ivory transition-colors`}
    >
      <div className="flex-shrink-0 w-16 text-right">
        <div className="font-serif text-sm text-ink">{date}</div>
        {practice.starts_at && (
          <div className="text-[10px] font-mono text-ink-faint mt-0.5">{practice.starts_at.slice(0, 5)}</div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap mb-0.5">
          <span className="text-[9px] font-mono tracking-[0.15em] uppercase px-1.5 py-0.5 rounded bg-ink text-paper">
            Practice
          </span>
          <span className="text-sm font-medium text-ink truncate">{practice.title || 'Practice'}</span>
        </div>
        {practice.focus && <div className="text-xs text-ink-faint truncate">{practice.focus}</div>}
      </div>
      <div className="flex-shrink-0 text-[10px] font-mono uppercase tracking-wider text-ink-faint group-hover:text-crimson">
        Details &rarr;
      </div>
    </Link>
  );
}
