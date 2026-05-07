'use client';

import { useState } from 'react';
import { AddChildModal } from './AddChildModal';

interface Props {
  variant?: 'primary' | 'secondary';
  label?: string;
  description?: string;
}

export function AddChildButton({ variant = 'secondary', label = '+ Add child', description }: Props) {
  const [open, setOpen] = useState(false);
  const className = variant === 'primary'
    ? 'btn-primary !h-10 !px-4 text-[13px]'
    : 'btn-secondary !h-9 text-xs';

  return (
    <>
      <button onClick={() => setOpen(true)} className={className}>
        {label}
      </button>
      {description && (
        <p className="text-xs text-ink-faint mt-2 max-w-md mx-auto">{description}</p>
      )}
      <AddChildModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
