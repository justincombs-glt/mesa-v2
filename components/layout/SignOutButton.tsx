'use client';

import { createClient } from '@/lib/supabase/client';

export function SignOutButton() {
  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  return (
    <button onClick={handleSignOut} className="btn-secondary !h-10 !px-4 text-[13px]">
      Sign out
    </button>
  );
}
