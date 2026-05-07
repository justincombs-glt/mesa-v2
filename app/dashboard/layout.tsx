import { headers } from 'next/headers';
import { AppShell } from '@/components/layout/AppShell';
import { requireProfile, displayNameOf } from '@/lib/auth';
import { getSeasonContext } from '@/lib/season';

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();
  const currentPath = headers().get('x-pathname') ?? undefined;
  const seasonCtx = await getSeasonContext();

  return (
    <AppShell
      role={profile.role}
      email={profile.email}
      displayName={displayNameOf(profile)}
      currentPath={currentPath}
      selectedSeason={seasonCtx.selected}
      allSeasons={seasonCtx.allSeasons}
      isArchivedView={seasonCtx.isArchived}
    >
      {children}
    </AppShell>
  );
}
