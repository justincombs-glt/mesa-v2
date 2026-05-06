import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/PageHeader';
import { getLinkedStudentForProfile } from '@/lib/student-dashboard';
import type {
  Activity, Attendance, PracticePlanItem, Drill,
} from '@/lib/supabase/types';

export const dynamic = 'force-dynamic';

interface ResolvedPracticeItem {
  id: string;
  sequence: number;
  item_type: 'drill' | 'skill';
  drill_title?: string;
  drill_category?: string | null;
  skill_title?: string;
  duration_minutes: number | null;
  coach_notes: string | null;
}

export default async function MyPracticeDetailPage({ params }: { params: { id: string } }) {
  const profile = await requireRole('student');
  const supabase = createClient();

  const student = await getLinkedStudentForProfile(profile.id);
  if (!student) {
    return (
      <>
        <PageHeader kicker="Student" title="Practice" description="Couldn't load." />
        <div className="card-base p-8 text-center">
          <p className="text-sm text-ink-dim">Your account isn&apos;t linked to a student record yet.</p>
        </div>
      </>
    );
  }

  const { data: actRow } = await supabase
    .from('activities').select('*').eq('id', params.id).eq('activity_type', 'practice').single();
  if (!actRow) notFound();
  const practice = actRow as Activity;

  // Verify the student is rostered onto this practice (else RLS would have already blocked,
  // but defense in depth)
  const { data: rosterCheck } = await supabase
    .from('activity_students').select('student_id').eq('activity_id', practice.id).eq('student_id', student.id).maybeSingle();
  if (!rosterCheck) notFound();

  // My attendance status
  const { data: attRow } = await supabase
    .from('attendance').select('*').eq('activity_id', practice.id).eq('student_id', student.id).maybeSingle();
  const attendance = attRow as Attendance | null;

  // Roster size (just the count, not names — privacy)
  const { count: rosterCount } = await supabase
    .from('activity_students').select('*', { count: 'exact', head: true }).eq('activity_id', practice.id);

  // Plan items, if a practice plan was attached (read-only display of drills / skills)
  let planItems: ResolvedPracticeItem[] = [];
  if (practice.source_practice_plan_id) {
    const { data: itemRows } = await supabase
      .from('practice_plan_items').select('*')
      .eq('plan_id', practice.source_practice_plan_id)
      .order('sequence');
    const items = (itemRows ?? []) as PracticePlanItem[];
    const drillIds = items.filter((i) => i.drill_id).map((i) => i.drill_id as string);
    let drillMap = new Map<string, Pick<Drill, 'id' | 'title' | 'category' | 'duration_minutes'>>();
    if (drillIds.length > 0) {
      const { data: drillRows } = await supabase
        .from('drills').select('id, title, category, duration_minutes').in('id', drillIds);
      ((drillRows ?? []) as Array<Pick<Drill, 'id' | 'title' | 'category' | 'duration_minutes'>>).forEach((d) => {
        drillMap.set(d.id, d);
      });
    }
    planItems = items.map((it) => {
      const drill = it.drill_id ? drillMap.get(it.drill_id) : undefined;
      return {
        id: it.id,
        sequence: it.sequence,
        item_type: it.item_type as 'drill' | 'skill',
        drill_title: drill?.title,
        drill_category: drill?.category ?? null,
        skill_title: it.skill_title ?? undefined,
        duration_minutes: it.duration_override ?? drill?.duration_minutes ?? null,
        coach_notes: it.coach_notes,
      };
    });
  }

  const date = new Date(practice.occurred_on + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });

  return (
    <>
      <PageHeader
        kicker={
          <>
            <Link href="/dashboard/my-practices" className="hover:text-ink">My practices</Link>
            <span className="mx-2">&middot;</span>
            Practice
          </>
        }
        title={<><em className="italic">{practice.title || 'Practice'}</em></>}
        description={[
          date,
          practice.starts_at ? practice.starts_at.slice(0, 5) : null,
          practice.duration_minutes ? `${practice.duration_minutes} min` : null,
          practice.venue ? practice.venue : null,
        ].filter(Boolean).join(' \u00b7 ')}
      />

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 flex flex-col gap-6">
          {practice.focus && (
            <section>
              <div className="kicker mb-2">Focus</div>
              <div className="card-base p-4 text-sm text-ink">{practice.focus}</div>
            </section>
          )}

          {planItems.length > 0 && (
            <section>
              <div className="kicker mb-3">Practice plan &middot; {planItems.length} items</div>
              <div className="card-base overflow-hidden">
                {planItems.map((item, idx) => (
                  <div key={item.id}
                    className={`flex items-start gap-4 px-5 py-3.5 ${idx > 0 ? 'border-t border-ink-hair' : ''}`}>
                    <div className="flex-shrink-0 w-7 text-center">
                      <div className="font-serif text-sm text-ink-dim">{idx + 1}</div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className={`text-[9px] font-mono tracking-[0.15em] uppercase px-1.5 py-0.5 rounded ${
                          item.item_type === 'drill' ? 'bg-ink text-paper' : 'bg-sand-100 text-ink-dim border border-ink-hair'
                        }`}>
                          {item.item_type === 'drill' ? 'Drill' : 'Skill'}
                        </span>
                        <span className="text-sm font-medium text-ink truncate">
                          {item.item_type === 'drill' ? item.drill_title : item.skill_title}
                        </span>
                      </div>
                      {item.drill_category && (
                        <div className="text-[10px] font-mono uppercase tracking-wider text-ink-faint">
                          {item.drill_category}
                        </div>
                      )}
                      {item.coach_notes && (
                        <div className="text-xs text-ink-dim mt-1.5">{item.coach_notes}</div>
                      )}
                    </div>
                    {item.duration_minutes && (
                      <div className="flex-shrink-0 text-xs font-mono text-ink-faint">
                        {item.duration_minutes} min
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {practice.notes && (
            <section>
              <div className="kicker mb-2">Coach notes</div>
              <div className="card-base p-4 text-sm text-ink whitespace-pre-wrap">{practice.notes}</div>
            </section>
          )}
        </div>

        <div className="flex flex-col gap-6">
          <section>
            <div className="kicker mb-2">My attendance</div>
            <AttendanceCard attendance={attendance} occurredOn={practice.occurred_on} />
          </section>

          <section>
            <div className="kicker mb-2">Roster</div>
            <div className="card-base p-4 text-sm text-ink-dim">
              {rosterCount ?? 0} player{rosterCount === 1 ? '' : 's'} scheduled
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

function AttendanceCard({ attendance, occurredOn }: { attendance: Attendance | null; occurredOn: string }) {
  const today = new Date().toISOString().slice(0, 10);
  const isPast = occurredOn < today;

  if (!attendance || attendance.attended === null) {
    return (
      <div className="card-base p-4 text-sm text-ink-dim">
        {isPast ? 'No attendance recorded.' : 'Not yet recorded \u2014 practice hasn\u2019t happened yet.'}
      </div>
    );
  }

  const styles = attendance.attended
    ? 'bg-sage/10 text-sage-dark border-sage/30'
    : 'bg-crimson/5 text-crimson border-crimson/30';

  return (
    <div className={`card-base p-4 border ${styles}`}>
      <div className="font-medium">{attendance.attended ? 'Present' : 'Absent'}</div>
    </div>
  );
}
