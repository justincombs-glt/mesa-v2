import { headers } from 'next/headers';
import { AppShell } from '@/components/layout/AppShell';
import { requireProfile, displayNameOf } from '@/lib/auth';
import { getSeasonContext } from '@/lib/season';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();
  const currentPath = headers().get('x-pathname') ?? undefined;
  const seasonCtx = await getSeasonContext();

  // Phase 17: compute Coach's Corner unread count for the sidebar badge.
  // Cap at 99 for display sanity.
  const supabase = createClient();
  let coachsCornerUnread = 0;
  {
    const sinceFilter = profile.last_seen_coachs_corner_at
      ? supabase
          .from('coachs_corner_videos')
          .select('id', { count: 'exact', head: true })
          .gt('created_at', profile.last_seen_coachs_corner_at)
      : supabase
          .from('coachs_corner_videos')
          .select('id', { count: 'exact', head: true });
    const { count } = await sinceFilter;
    coachsCornerUnread = Math.min(99, count ?? 0);
  }

  return (
    <AppShell
      role={profile.role}
      email={profile.email}
      displayName={displayNameOf(profile)}
      currentPath={currentPath}
      selectedSeason={seasonCtx.selected}
      allSeasons={seasonCtx.allSeasons}
      isArchivedView={seasonCtx.isArchived}
      coachsCornerUnread={coachsCornerUnread}
    >
      {children}
    </AppShell>
  );
}
