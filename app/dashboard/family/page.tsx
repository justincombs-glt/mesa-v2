import Link from 'next/link';
import { requireProfile, displayNameOf } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/PageHeader';
import { getLinkedStudentsForParent } from '@/lib/student-dashboard';
import type { Student } from '@/lib/supabase/types';

export const dynamic = 'force-dynamic';

export default async function FamilyPage() {
  const profile = await requireProfile();

  // Only parents use this page; admin/director can also see (they have universal access)
  if (profile.role !== 'parent' && profile.role !== 'admin' && profile.role !== 'director') {
    return (
      <>
        <PageHeader
          kicker="Family"
          title="Not available"
          description="Only parents can view the family dashboard."
        />
      </>
    );
  }

  const students = await getLinkedStudentsForParent(profile.id);

  if (students.length === 0) {
    return (
      <>
        <PageHeader
          kicker="Family"
          title={<>My <em className="italic text-crimson">family</em>.</>}
          description="No students linked to your account yet."
        />
        <div className="card-base p-8 text-center">
          <p className="text-sm text-ink-dim max-w-md mx-auto">
            Your account isn&apos;t linked to any students yet. Ask the academy to link your child&apos;s record to your parent account. Once linked, each of your children will appear here.
          </p>
        </div>
      </>
    );
  }

  // Enrich with goal counts
  const supabase = createClient();
  const enriched = await Promise.all(students.map(async (s) => {
    const { data: planRows } = await supabase
      .from('goal_plans').select('id').eq('student_id', s.id).in('status', ['draft', 'active']);
    const planIds = ((planRows ?? []) as Array<{ id: string }>).map((p) => p.id);
    let goalCount = 0;
    if (planIds.length > 0) {
      const { count } = await supabase
        .from('goals').select('id', { count: 'exact', head: true }).in('plan_id', planIds);
      goalCount = count ?? 0;
    }
    return { student: s, goalCount };
  }));

  return (
    <>
      <PageHeader
        kicker={`Family · ${displayNameOf(profile)}`}
        title={<>My <em className="italic text-crimson">family</em>.</>}
        description={students.length === 1
          ? "Click through to see their goals, schedule, and performance."
          : `Your ${students.length} linked students — click any to see their progress.`}
      />
      <div className="card-base overflow-hidden">
        {enriched.map((row, idx) => (
          <FamilyMemberRow key={row.student.id} student={row.student}
            goalCount={row.goalCount} first={idx === 0} />
        ))}
      </div>
    </>
  );
}

function FamilyMemberRow({ student, goalCount, first }: {
  student: Student; goalCount: number; first: boolean;
}) {
  return (
    <Link href={`/dashboard/family/${student.id}`}
      className={`flex items-center gap-4 px-5 py-4 group ${first ? '' : 'border-t border-ink-hair'}`}>
      <div className="flex-shrink-0 font-serif text-2xl text-crimson w-12 text-right">
        {student.jersey_number ? `#${student.jersey_number}` : ''}
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-medium text-ink group-hover:text-crimson transition-colors">{student.full_name}</div>
        <div className="text-[10px] font-mono uppercase tracking-wider text-ink-faint mt-1">
          {positionLabel(student.position)} · {goalCount} active goal{goalCount === 1 ? '' : 's'}
        </div>
      </div>
      <span className="text-[10px] font-mono uppercase tracking-wider text-ink-faint group-hover:text-ink">
        Open →
      </span>
    </Link>
  );
}

function positionLabel(p: string | null): string {
  if (!p) return 'Player';
  return p === 'F' ? 'Forward' : p === 'D' ? 'Defense' : p === 'G' ? 'Goalie' : p;
}
