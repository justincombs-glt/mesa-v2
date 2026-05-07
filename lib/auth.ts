import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Profile, AppRole } from '@/lib/supabase/types';

/**
 * Returns the signed-in user's profile, or redirects to /sign-in.
 * Use in every server component under /dashboard.
 */
export async function requireProfile(): Promise<Profile> {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/sign-in');

  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!data) {
    // Profile didn't get created by the trigger — edge case, force sign-in again
    redirect('/sign-in');
  }

  return data as Profile;
}

/**
 * Require a specific role, else redirect to dashboard home.
 */
export async function requireRole(...allowed: AppRole[]): Promise<Profile> {
  const profile = await requireProfile();
  if (!allowed.includes(profile.role)) {
    redirect('/dashboard');
  }
  return profile;
}

/**
 * Convenience: get the display name with fallback chain
 */
export function displayNameOf(profile: Pick<Profile, 'full_name' | 'email'>): string {
  return profile.full_name || profile.email.split('@')[0] || 'there';
}
