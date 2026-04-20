import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/PageHeader';
import { ExercisesClient } from './ExercisesClient';
import type { Exercise } from '@/lib/supabase/types';

export const dynamic = 'force-dynamic';

export default async function ExercisesPage() {
  await requireRole('admin', 'director', 'trainer');
  const supabase = createClient();
  const { data } = await supabase.from('exercises').select('*').eq('active', true).order('title');
  const exercises = (data ?? []) as Exercise[];

  return (
    <>
      <PageHeader
        kicker="Admin · Exercises"
        title={<>Off-ice <em className="italic text-crimson">exercise library</em>.</>}
        description="The trainer's repository. Each exercise can have default sets, reps, and duration — customizable per workout."
        actions={<ExercisesClient exercises={[]} addOnly />}
      />
      <ExercisesClient exercises={exercises} />
    </>
  );
}
