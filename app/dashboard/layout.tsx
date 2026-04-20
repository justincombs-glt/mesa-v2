import { headers } from 'next/headers';
import { AppShell } from '@/components/layout/AppShell';
import { requireProfile, displayNameOf } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();
  // Middleware sets x-pathname for us via response headers, but we'll derive
  // client-side active state through Link. For server-rendered active highlighting,
  // read from the referer-ish header if available.
  const currentPath = headers().get('x-pathname') ?? undefined;

  return (
    <AppShell
      role={profile.role}
      email={profile.email}
      displayName={displayNameOf(profile)}
      currentPath={currentPath}
    >
      {children}
    </AppShell>
  );
}
