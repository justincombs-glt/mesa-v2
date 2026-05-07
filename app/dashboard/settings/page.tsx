import { requireProfile } from '@/lib/auth';
import { PageHeader } from '@/components/ui/PageHeader';
import { SettingsForm } from './SettingsForm';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const profile = await requireProfile();

  return (
    <>
      <PageHeader
        kicker="Profile · Settings"
        title={<>Your <em className="italic text-crimson">profile</em>.</>}
        description="Edit your name and contact info. This is visible to academy staff you interact with."
      />
      <div className="max-w-xl">
        <SettingsForm
          email={profile.email}
          fullName={profile.full_name ?? ''}
          phone={profile.phone ?? ''}
          role={profile.role}
        />
      </div>
    </>
  );
}
