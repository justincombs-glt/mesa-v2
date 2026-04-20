import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/PageHeader';
import { InviteClient } from './InviteClient';
import type { Invite } from '@/lib/supabase/types';

export const dynamic = 'force-dynamic';

export default async function InvitePage() {
  await requireRole('admin', 'director');
  const supabase = createClient();

  const { data } = await supabase
    .from('invites').select('*').eq('status', 'pending').order('created_at', { ascending: false });
  const pending = (data ?? []) as Invite[];

  return (
    <>
      <PageHeader
        kicker="Director · Add Users"
        title={<>Invite <em className="italic text-crimson">a member</em>.</>}
        description="Send invites to coaches, trainers, parents, or students. When they sign up with the invited email, the role you chose is assigned automatically."
        actions={<InviteClient pending={[]} addOnly />}
      />
      <InviteClient pending={pending} />
    </>
  );
}
