import Link from 'next/link';
import { requireProfile, displayNameOf } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/PageHeader';
import { StudentDashboardView } from '@/components/student/StudentDashboardView';
import { AddChildButton } from './family/AddChildButton';
import {
  getLinkedStudentForProfile,
  getLinkedStudentsForParent,
  buildStudentDashboard,
} from '@/lib/student-dashboard';
import type { AppRole, Student } from '@/lib/supabase/types';

export const dynamic = 'force-dynamic';

export default async function DashboardHome() {
  const profile = await requireProfile();

  if (profile.role === 'student') {
    return <StudentHome profileId={profile.id} profileName={displayNameOf(profile)} />;
  }
  if (profile.role === 'parent') {
    return <ParentHome profileId={profile.id} profileName={displayNameOf(profile)} />;
  }

  return (
    <>
      <PageHeader
        kicker={`Signed in · ${profile.role.toUpperCase()}`}
        title={<>Welcome, <em className="italic text-crimson">{displayNameOf(profile)}</em>.</>}
        description={staffCopy(profile.role)}
      />
      <div className="card-base p-5">
        <div className="kicker mb-3">Your sidebar</div>
        <p className="text-sm text-ink-dim leading-relaxed">
          Use the left nav to jump into your module. Data is scoped to the currently selected season.
        </p>
      </div>
    </>
  );
}

async function StudentHome({ profileId, profileName }: { profileId: string; profileName: string }) {
  const student = await getLinkedStudentForProfile(profileId);
  if (!student) {
    return (
      <>
        <PageHeader
          kicker="Student"
          title={<>Welcome, <em className="italic text-crimson">{profileName}</em>.</>}
          description="Your account isn't linked to a student record yet."
        />
        <div className="card-base p-8 text-center">
          <p className="text-sm text-ink-dim max-w-md mx-auto">
            Ask your coach, trainer, or the academy office to link your profile to your student record. Once linked, this page will show your goals, schedule, and test results.
          </p>
        </div>
      </>
    );
  }

  const data = await buildStudentDashboard(student.id);
  if (!data) {
    return (
      <PageHeader
        kicker="Student"
        title={<>Welcome, <em className="italic text-crimson">{profileName}</em>.</>}
        description="Couldn't load your dashboard."
      />
    );
  }

  return (
    <>
      <PageHeader
        kicker={data.seasonName ? `Student · ${data.seasonName}` : 'Student'}
        title={<>Welcome, <em className="italic text-crimson">{profileName}</em>.</>}
        description="Your goals, schedule, and test results for the current season."
      />
      <StudentDashboardView data={data} />
    </>
  );
}

async function ParentHome({ profileId, profileName }: { profileId: string; profileName: string }) {
  const students = await getLinkedStudentsForParent(profileId);

  if (students.length === 0) {
    return (
      <>
        <PageHeader
          kicker="Parent"
          title={<>Welcome, <em className="italic text-crimson">{profileName}</em>.</>}
          description="Add your first child to get started."
        />
        <div className="card-base p-8 text-center">
          <p className="text-sm text-ink-dim max-w-md mx-auto mb-5">
            Register your child with the academy by adding them below. Once created, you&apos;ll see their goals, schedule, and progress here.
          </p>
          <AddChildButton variant="primary" label="Add my first child" />
        </div>
      </>
    );
  }

  // Enrich each student with their active-goal count
  const supabase = createClient();
  const enriched = await Promise.all(students.map(async (s) => {
    const { data: planRows } = await supabase
      .from('goal_plans').select('id').eq('student_id', s.id).in('status', ['draft', 'active']);
    const planIds = ((planRows ?? []) as Array<{ id: string }>).map((p) => p.id);
    let goalsCount = 0;
    if (planIds.length > 0) {
      const { count } = await supabase
        .from('goals').select('id', { count: 'exact', head: true }).in('plan_id', planIds);
      goalsCount = count ?? 0;
    }
    return { student: s, goalCount: goalsCount };
  }));

  return (
    <>
      <PageHeader
        kicker="Parent · My Family"
        title={<>Welcome, <em className="italic text-crimson">{profileName}</em>.</>}
        description={students.length === 1
          ? 'Your linked student — click through to see their progress.'
          : `Your ${students.length} linked students — click any to see their progress.`}
        actions={<AddChildButton />}
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

function staffCopy(role: AppRole): string {
  switch (role) {
    case 'admin':
      return "You're the administrator. You manage users, roles, and the academy's repositories.";
    case 'director':
      return "You're the director. You enroll students, build plans, and oversee performance.";
    case 'coach':
      return "You're a coach. Drills, practices, game activities, and the students you work with.";
    case 'trainer':
      return "You're a trainer. Exercises, off-ice workouts, and strength tracking.";
    default:
      return '';
  }
}
