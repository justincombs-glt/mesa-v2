'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { deleteSelfWorkout } from '@/app/actions';

interface Props {
  activityId: string;
  title: string;
}

export function WorkoutRowActions({ activityId, title }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const handleDelete = async () => {
    if (!confirm(`Delete ${title}? This cannot be undone.`)) return;
    setBusy(true);
    const fd = new FormData();
    fd.set('activity_id', activityId);
    await deleteSelfWorkout(fd);
    router.refresh();
  };

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={busy}
      className="text-[10px] font-mono uppercase tracking-wider text-ink-faint hover:text-crimson disabled:opacity-50 px-2"
      aria-label="Delete workout"
    >
      Delete
    </button>
  );
}
