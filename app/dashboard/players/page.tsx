import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/PageHeader';
import { PlayersClient } from './PlayersClient';
import type { Student } from '@/lib/supabase/types';

export const dynamic = 'force-dynamic';

export interface PlayerRow extends Student {
  hasLogin: boolean;
}

export default async function PlayersPage() {
  // Per Q10 = A: admin/director/coach/trainer all manage Players
  await requireRole('admin', 'director', 'coach', 'trainer');
  const supabase = createClient();

  const { data: playerRows } = await supabase
    .from('students')
    .select('*')
    .eq('category', 'player')
    .order('full_name');
  const players = ((playerRows ?? []) as Student[]).map<PlayerRow>((p) => ({
    ...p,
    hasLogin: !!p.profile_id,
  }));

  return (
    <>
      <PageHeader
        kicker="Athletes"
        title={<><em className="italic text-crimson">Players</em>.</>}
        description="External athletes paying the academy for individual services. Not part of practices or trainer-scheduled workouts."
      />
      <PlayersClient players={players} />
    </>
  );
}
