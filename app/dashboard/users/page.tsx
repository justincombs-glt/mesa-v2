import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/PageHeader';
import { UsersClient } from './UsersClient';
import type { Profile, Invite } from '@/lib/supabase/types';

export const dynamic = 'force-dynamic';

export default async function UsersPage() {
  await requireRole('admin');
  const supabase = createClient();

  const [{ data: profileRows }, { data: inviteRows }] = await Promise.all([
    supabase.from('profiles').select('*').order('email'),
    supabase.from('invites').select('*').eq('status', 'pending').order('created_at', { ascending: false }),
  ]);

  const profiles = (profileRows ?? []) as Profile[];
  const pendingInvites = (inviteRows ?? []) as Invite[];

  return (
    <>
      <PageHeader
        kicker="Admin · Users"
        title={<>All <em className="italic text-crimson">users</em>.</>}
        description="Invite new members, change roles, manage access. The first user to sign up becomes admin automatically; everyone else defaults to parent unless invited."
        actions={<UsersClient profiles={[]} pendingInvites={[]} inviteOnly />}
      />

      <UsersClient profiles={profiles} pendingInvites={pendingInvites} />
    </>
  );
}
