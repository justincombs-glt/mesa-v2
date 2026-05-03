'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createReviewSnapshot } from '@/app/actions';
import type { StudentInsights, GoalProgressDetail } from '@/lib/student-insights';

interface Props {
  insights: StudentInsights;
}

export function SaveReviewButton({ insights }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasPlan = insights.plans.length > 0;

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    // Pull goal_id -> auto_pct map for review_goal_ratings pre-population
    const autoPcts: Record<string, number> = {};
    insights.plans.forEach((pg) => {
      pg.goals.forEach((g: GoalProgressDetail) => {
        autoPcts[g.id] = g.computed_pct;
      });
    });

    const fd = new FormData();
    fd.set('student_id', insights.student.id);
    if (insights.plans[0]) fd.set('plan_id', insights.plans[0].plan.id);
    fd.set('snapshot_data', JSON.stringify(insights));
    fd.set('goal_auto_pcts', JSON.stringify(autoPcts));
    fd.set('summary', '');
    fd.set('review_type', 'ad_hoc');

    const res = await createReviewSnapshot(fd);
    setSaving(false);

    if (res.ok && res.id) {
      router.push(`/dashboard/students/${insights.student.id}/insights/reviews/${res.id}`);
    } else {
      setError(res.error ?? 'Could not save review.');
    }
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        onClick={handleSave}
        disabled={saving || !hasPlan}
        className="btn-primary !h-9 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
        title={!hasPlan ? 'Create an active goal plan first' : ''}
      >
        {saving ? 'Capturing snapshot…' : '+ Save as review'}
      </button>
      {error && <div className="text-xs text-crimson">{error}</div>}
    </div>
  );
}
