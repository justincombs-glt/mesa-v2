import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import type { Season } from '@/lib/supabase/types';

export const SELECTED_SEASON_COOKIE = 'mesa_selected_season';

/**
 * Returns the currently "selected" season for this request.
 *
 * Priority order:
 *   1. Season ID from the cookie (if valid + exists)
 *   2. The is_current = true season
 *   3. null if no seasons exist (edge case, pre-migration)
 *
 * Also returns all seasons for the picker, and a flag for whether the
 * selected season is archived (UI uses this for read-only enforcement).
 */
export async function getSeasonContext(): Promise<{
  selected: Season | null;
  allSeasons: Season[];
  isArchived: boolean;
  isCurrent: boolean;
}> {
  const supabase = createClient();
  const { data: seasonRows } = await supabase.from('seasons').select('*').order('starts_on', { ascending: false });
  const allSeasons = (seasonRows ?? []) as Season[];

  if (allSeasons.length === 0) {
    return { selected: null, allSeasons: [], isArchived: false, isCurrent: false };
  }

  const cookieStore = cookies();
  const cookieVal = cookieStore.get(SELECTED_SEASON_COOKIE)?.value;

  let selected: Season | undefined;
  if (cookieVal) {
    selected = allSeasons.find((s) => s.id === cookieVal);
  }
  if (!selected) {
    selected = allSeasons.find((s) => s.is_current) ?? allSeasons[0];
  }

  return {
    selected,
    allSeasons,
    isArchived: selected.archived_at !== null,
    isCurrent: selected.is_current,
  };
}
