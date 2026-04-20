'use client';

import { useState } from 'react';
import { updateProfile } from '@/app/actions';
import { FormField } from '@/components/ui/FormField';
import type { AppRole } from '@/lib/supabase/types';

interface Props {
  email: string;
  fullName: string;
  phone: string;
  role: AppRole;
}

export function SettingsForm({ email, fullName, phone, role }: Props) {
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (formData: FormData) => {
    setStatus('saving');
    setError(null);
    const res = await updateProfile(formData);
    if (res.ok) {
      setStatus('saved');
      setTimeout(() => setStatus('idle'), 2000);
    } else {
      setStatus('error');
      setError(res.error ?? 'Something went wrong.');
    }
  };

  return (
    <form action={handleSubmit} className="card-base p-6 md:p-8 flex flex-col gap-5">
      <FormField label="Email" help="Your sign-in email. Contact the academy to change it.">
        <input type="email" value={email} disabled className="input-base opacity-60 cursor-not-allowed" />
      </FormField>

      <FormField label="Role" help="Set by the academy.">
        <input type="text" value={role} disabled className="input-base opacity-60 cursor-not-allowed capitalize" />
      </FormField>

      <FormField label="Full name" required>
        <input
          type="text"
          name="full_name"
          defaultValue={fullName}
          required
          placeholder="First Last"
          className="input-base"
        />
      </FormField>

      <FormField label="Phone" help="Optional. Used by coaches to reach you about your child.">
        <input
          type="tel"
          name="phone"
          defaultValue={phone}
          placeholder="(555) 555-5555"
          className="input-base"
        />
      </FormField>

      <div className="flex items-center gap-4 mt-2">
        <button type="submit" disabled={status === 'saving'} className="btn-primary">
          {status === 'saving' ? 'Saving…' : 'Save changes'}
        </button>
        {status === 'saved' && (
          <span className="text-sm text-sage-dark">✓ Saved</span>
        )}
        {status === 'error' && error && (
          <span className="text-sm text-crimson">{error}</span>
        )}
      </div>
    </form>
  );
}
