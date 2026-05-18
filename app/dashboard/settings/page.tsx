import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DevicesSection } from './devices/DevicesSection';

export const dynamic = 'force-dynamic';

interface SearchParams {
  devices_status?: string;
  devices_msg?: string;
  devices_error?: string;
}

interface DeviceConnectionRow {
  provider: string;
  status: string;
  connected_at: string;
  scopes: string[];
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect('/sign-in?next=/dashboard/settings');

  // Load device connections (RLS limits to own rows)
  const { data: connectionRows } = await supabase
    .from('user_device_connections')
    .select('provider, status, connected_at, scopes')
    .eq('profile_id', userData.user.id);
  const connections = ((connectionRows ?? []) as DeviceConnectionRow[]).map((c) => ({
    provider: c.provider,
    status: c.status,
    connected_at: c.connected_at,
    scopes: c.scopes ?? [],
  }));

  const status = searchParams.devices_status ?? null;
  const msg = searchParams.devices_msg ?? searchParams.devices_error ?? null;

  return (
    <main className="min-h-screen px-6 py-10 md:px-10 md:py-14 bg-ivory">
      <div className="max-w-3xl mx-auto">
        <div className="mb-10">
          <div className="kicker mb-2">Account</div>
          <h1 className="font-serif text-4xl text-ink leading-tight">Settings</h1>
          <p className="text-sm text-ink-dim mt-2">
            Connections, preferences, and account info.
          </p>
        </div>

        {/* Devices section */}
        <DevicesSection
          connections={connections}
          statusFlag={status}
          message={msg}
        />

        {/* Stub sections for future settings */}
        <SectionStub
          title="Notifications"
          subtitle="Weekly digest and email preferences (coming soon)"
        />
        <SectionStub
          title="Account"
          subtitle="Change password, email, and profile details (coming soon)"
        />
      </div>
    </main>
  );
}

function SectionStub({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <section className="mt-12 pb-8 border-b border-ink-hair">
      <h2 className="font-serif text-2xl text-ink mb-1">{title}</h2>
      <p className="text-sm text-ink-faint">{subtitle}</p>
    </section>
  );
}
