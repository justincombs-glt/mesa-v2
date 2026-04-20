import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getSeasonContext } from '@/lib/season';
import { PageHeader } from '@/components/ui/PageHeader';
import { PracticeDetailClient } from './PracticeDetailClient';
import type {
  Activity, Student, ActivityStudent, Attendance,
  PracticePlan, PracticePlanItem, Drill,
} from '@/lib/supabase/types';

export const dynamic = 'force-dynamic';

export interface RosterEntry {
  link: ActivityStudent;
  student: Pick<Student, 'id' | 'full_name' | 'jersey_number' | 'position' | 'dominant_hand'>;
  attendance: Attendance | null;
}

export interface ResolvedPracticeItem {
  id: string;
  sequence: number;
  item_type: 'drill' | 'skill';
  drill?: Pick<Drill, 'id' | 'title' | 'category' | 'duration_minutes'>;
  skill_title?: string;
  duration_override?: number | null;
  coach_notes?: string | null;
}

export default async function PracticeDetailPage({ params }: { params: { id: string } }) {
  await requireRole('admin', 'director', 'coach');
  const supabase = createClient();
  const seasonCtx = await getSeasonContext();

  const { data: actRow } = await supabase
    .from('activities').select('*').eq('id', params.id).eq('activity_type', 'practice').single();
  if (!actRow) notFound();
  const practice = actRow as Activity;

  // Roster
  const { data: rosterRows } = await supabase
    .from('activity_students').select('*').eq('activity_id', practice.id);
  const rosterLinks = (rosterRows ?? []) as ActivityStudent[];

  const studentIds = rosterLinks.map((r) => r.student_id);
  let rosterStudents: Array<Pick<Student, 'id' | 'full_name' | 'jersey_number' | 'position' | 'dominant_hand'>> = [];
  if (studentIds.length > 0) {
    const { data } = await supabase
      .from('students').select('id, full_name, jersey_number, position, dominant_hand').in('id', studentIds);
    rosterStudents = (data ?? []) as typeof rosterStudents;
  }

  // Attendance
  const { data: attRows } = await supabase.from('attendance').select('*').eq('activity_id', practice.id);
  const attendance = (attRows ?? []) as Attendance[];
  const attMap = new Map(attendance.map((a) => [a.student_id, a]));

  const roster: RosterEntry[] = rosterLinks.map((link) => {
    const student = rosterStudents.find((s) => s.id === link.student_id);
    return {
      link,
      student: student ?? { id: link.student_id, full_name: '(unknown)', jersey_number: null, position: null, dominant_hand: null },
      attendance: attMap.get(link.student_id) ?? null,
    };
  }).sort((a, b) => a.student.full_name.localeCompare(b.student.full_name));

  // Practice items (from the linked plan, if any)
  let items: ResolvedPracticeItem[] = [];
  let planTitle: string | null = null;
  if (practice.source_practice_plan_id) {
    const [{ data: planRow }, { data: itemRows }] = await Promise.all([
      supabase.from('practice_plans').select('id, title').eq('id', practice.source_practice_plan_id).single(),
      supabase.from('practice_plan_items').select('*').eq('plan_id', practice.source_practice_plan_id).order('sequence'),
    ]);
    planTitle = planRow ? (planRow as Pick<PracticePlan, 'title'>).title : null;

    const planItems = (itemRows ?? []) as PracticePlanItem[];
    const drillIds = planItems.filter((i) => i.drill_id).map((i) => i.drill_id as string);
    let drillMap = new Map<string, Pick<Drill, 'id' | 'title' | 'category' | 'duration_minutes'>>();
    if (drillIds.length > 0) {
      const { data: drillRows } = await supabase
        .from('drills').select('id, title, category, duration_minutes').in('id', drillIds);
      drillMap = new Map(((drillRows ?? []) as Pick<Drill, 'id' | 'title' | 'category' | 'duration_minutes'>[]).map((d) => [d.id, d]));
    }

    items = planItems.map((it) => ({
      id: it.id,
      sequence: it.sequence,
      item_type: it.item_type,
      drill: it.drill_id ? drillMap.get(it.drill_id) : undefined,
      skill_title: it.skill_title ?? undefined,
      duration_override: it.duration_override,
      coach_notes: it.coach_notes,
    }));
  }

  // Pool of students who could be added to the roster (active + not already in roster)
  const { data: allStudentRows } = await supabase
    .from('students').select('id, full_name, jersey_number, position, active')
    .eq('active', true).order('full_name');
  const allActive = (allStudentRows ?? []) as Array<Pick<Student, 'id' | 'full_name' | 'jersey_number' | 'position' | 'active'>>;
  const rosterIds = new Set(rosterLinks.map((r) => r.student_id));
  const addableStudents = allActive.filter((s) => !rosterIds.has(s.id));

  return (
    <>
      <PageHeader
        kicker={
          <>
            <Link href="/dashboard/practices" className="hover:text-ink">Practices</Link>
            <span className="mx-2">·</span>
            {formatDate(practice.occurred_on)}
          </>
        }
        title={<em className="italic">{practice.title || practice.focus || 'Practice'}</em>}
        description={practice.focus && practice.title ? practice.focus : undefined}
      />

      <PracticeDetailClient
        practice={practice}
        roster={roster}
        items={items}
        planTitle={planTitle}
        addableStudents={addableStudents}
        readOnly={seasonCtx.isArchived}
      />
    </>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}
