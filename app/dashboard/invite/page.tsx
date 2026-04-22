import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/PageHeader';
import { InviteClient } from './InviteClient';
import type { Invite, Student } from '@/lib/supabase/types';

export const dynamic = 'force-dynamic';

export default async function InvitePage() {
  await requireRole('admin', 'director');
  const supabase = createClient();

  const [{ data: inviteRows }, { data: studentRows }] = await Promise.all([
    supabase.from('invites').select('*').eq('status', 'pending').order('created_at', { ascending: false }),
    supabase.from('students')
      .select('id, full_name, jersey_number, date_of_birth, profile_id, active')
      .eq('active', true)
      .is('profile_id', null)  // only students without an account yet
      .order('full_name'),
  ]);

  const pending = (inviteRows ?? []) as Invite[];
  const students = (studentRows ?? []) as Array<
    Pick<Student, 'id' | 'full_name' | 'jersey_number' | 'date_of_birth' | 'profile_id' | 'active'>
  >;

  return (
    <>
      <PageHeader
        kicker="Director · Add Users"
        title={<>Invite <em className="italic text-crimson">a member</em>.</>}
        description="Send invites to coaches, trainers, parents, or students. When they sign up with the invited email, the role you chose is assigned automatically."
        actions={<InviteClient pending={[]} students={students} addOnly />}
      />
      <InviteClient pending={pending} students={students} />
    </>
  );
}
