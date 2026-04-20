import { requireProfile, displayNameOf } from '@/lib/auth';
import { PageHeader } from '@/components/ui/PageHeader';
import type { AppRole } from '@/lib/supabase/types';

export const dynamic = 'force-dynamic';

export default async function DashboardHome() {
  const profile = await requireProfile();

  return (
    <>
      <PageHeader
        kicker={`Signed in · ${profile.role.toUpperCase()}`}
        title={
          <>
            Welcome, <em className="italic text-crimson">{displayNameOf(profile)}</em>.
          </>
        }
        description={copyForRole(profile.role)}
      />

      <div className="p-6 bg-sand-50 border border-sand-100 rounded-2xl mb-6">
        <div className="kicker mb-2">MESA v2 · Phase 1 of 7</div>
        <p className="text-ink-dim leading-relaxed text-sm">
          The foundation is live. The next phases roll out one module at a time:
          Admin (Phase 2), Director (Phase 3), Coach (Phase 4), Trainer (Phase 5),
          Student &amp; Parent dashboards (Phase 6), and Reviews integration (Phase 7).
        </p>
      </div>

      <div className="p-5 bg-paper border border-ink-hair rounded-xl">
        <div className="kicker mb-3">Your sidebar</div>
        <p className="text-sm text-ink-dim leading-relaxed">
          Click anything in the left nav. Pages that aren&apos;t built yet will show a
          &ldquo;Coming in Phase N&rdquo; placeholder so you can confirm the menu structure.
        </p>
      </div>
    </>
  );
}

function copyForRole(role: AppRole): string {
  switch (role) {
    case 'admin':
      return "You're the administrator. You manage users, roles, and the academy's repositories — drills, exercises, goal templates, and performance tests.";
    case 'director':
      return "You're the academy director. You enroll students, build practice plans, manage goals, and oversee player performance.";
    case 'coach':
      return "You're a coach. Your focus: drills, practices, game activities, and the students you work with.";
    case 'trainer':
      return "You're a trainer. Your focus: exercises, off-ice workouts, and tracking each player's strength and conditioning work.";
    case 'student':
      return "This is your training portal. Track your goal plan, your activities, and your performance over time.";
    case 'parent':
      return "This is your family portal. See your linked child's goal plan, activities, and performance.";
  }
}
