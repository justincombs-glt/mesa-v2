import type { GoalDomain, GoalCategory } from './supabase/types';

export const DOMAIN_LABELS: Record<GoalDomain, string> = {
  on_ice: 'On-Ice',
  off_ice: 'Off-Ice',
};

export const CATEGORY_LABELS: Record<GoalCategory, string> = {
  // On-ice
  skating: 'Skating',
  puck_control: 'Puck Control',
  passing: 'Passing',
  shooting: 'Shooting',
  hockey_iq: 'Hockey IQ',
  coachability: 'Coachability',
  // Off-ice
  strength: 'Strength',
  conditioning: 'Conditioning',
  speed_agility: 'Speed & Agility',
  mental: 'Mental',
  nutrition_recovery: 'Nutrition & Recovery',
  academic: 'Academic',
};

export const ON_ICE_CATEGORIES: GoalCategory[] = [
  'skating', 'puck_control', 'passing', 'shooting', 'hockey_iq', 'coachability',
];

export const OFF_ICE_CATEGORIES: GoalCategory[] = [
  'strength', 'conditioning', 'speed_agility', 'mental', 'nutrition_recovery', 'academic',
];

export function categoriesForDomain(d: GoalDomain): GoalCategory[] {
  return d === 'on_ice' ? ON_ICE_CATEGORIES : OFF_ICE_CATEGORIES;
}

export function domainForCategory(c: GoalCategory): GoalDomain {
  return ON_ICE_CATEGORIES.includes(c) ? 'on_ice' : 'off_ice';
}
