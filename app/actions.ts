'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { AppRole, GoalDomain, GoalCategory } from '@/lib/supabase/types';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;

// Profile (all signed-in users)

export async function updateProfile(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/sign-in');

  const full_name = String(formData.get('full_name') ?? '').trim();
  const phone = String(formData.get('phone') ?? '').trim() || null;

  if (!full_name) return { ok: false, error: 'Full name is required.' };

  const { error } = await (supabase.from('profiles') as Any)
    .update({ full_name, phone })
    .eq('id', user.id);

  if (error) return { ok: false, error: error.message };
  revalidatePath('/dashboard/settings');
  revalidatePath('/dashboard');
  return { ok: true };
}

// User management (admin only)

export async function changeUserRole(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/sign-in');

  const id = String(formData.get('id') ?? '').trim();
  const role = String(formData.get('role') ?? '').trim() as AppRole;

  if (!id || !role) return { ok: false, error: 'Missing fields' };

  const validRoles: AppRole[] = ['admin', 'director', 'coach', 'trainer', 'student', 'parent'];
  if (!validRoles.includes(role)) return { ok: false, error: 'Invalid role' };

  if (id === user.id && role !== 'admin') {
    return { ok: false, error: "You can't remove your own admin role. Promote another user to admin first." };
  }

  const { error } = await (supabase.from('profiles') as Any).update({ role }).eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/dashboard/users');
  return { ok: true };
}

// Invites

export async function createInvite(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/sign-in');

  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const role = String(formData.get('role') ?? '').trim() as AppRole;
  const note = String(formData.get('note') ?? '').trim() || null;

  if (!email || !role) return { ok: false, error: 'Email and role are required.' };

  const validRoles: AppRole[] = ['admin', 'director', 'coach', 'trainer', 'student', 'parent'];
  if (!validRoles.includes(role)) return { ok: false, error: 'Invalid role' };

  const { error } = await (supabase.from('invites') as Any).insert({
    email, role, note, invited_by: user.id,
  });

  if (error) return { ok: false, error: error.message };
  revalidatePath('/dashboard/users');
  revalidatePath('/dashboard/invite');
  return { ok: true };
}

export async function revokeInvite(formData: FormData) {
  const supabase = createClient();
  const id = String(formData.get('id') ?? '');
  const { error } = await (supabase.from('invites') as Any)
    .update({ status: 'revoked' })
    .eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/dashboard/users');
  revalidatePath('/dashboard/invite');
  return { ok: true };
}

// Drills

export async function createDrill(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/sign-in');

  const title = String(formData.get('title') ?? '').trim();
  const category = String(formData.get('category') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim() || null;
  const instructions = String(formData.get('instructions') ?? '').trim() || null;
  const duration_str = String(formData.get('duration_minutes') ?? '').trim();
  const duration_minutes = duration_str ? parseInt(duration_str, 10) : null;
  const age_str = String(formData.get('age_groups') ?? '').trim();
  const age_groups = age_str ? age_str.split(',').map(s => s.trim()).filter(Boolean) : null;
  const equip_str = String(formData.get('equipment') ?? '').trim();
  const equipment = equip_str ? equip_str.split(',').map(s => s.trim()).filter(Boolean) : null;

  if (!title) return { ok: false, error: 'Title is required.' };
  if (!category) return { ok: false, error: 'Category is required.' };

  const { data, error } = await (supabase.from('drills') as Any)
    .insert({ title, category, description, instructions, duration_minutes, age_groups, equipment, created_by: user.id })
    .select('id').single();

  if (error) return { ok: false, error: error.message };
  revalidatePath('/dashboard/drills');
  return { ok: true, id: (data as { id: string }).id };
}

export async function updateDrill(formData: FormData) {
  const supabase = createClient();
  const id = String(formData.get('id') ?? '').trim();
  const title = String(formData.get('title') ?? '').trim();
  const category = String(formData.get('category') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim() || null;
  const instructions = String(formData.get('instructions') ?? '').trim() || null;
  const duration_str = String(formData.get('duration_minutes') ?? '').trim();
  const duration_minutes = duration_str ? parseInt(duration_str, 10) : null;
  const age_str = String(formData.get('age_groups') ?? '').trim();
  const age_groups = age_str ? age_str.split(',').map(s => s.trim()).filter(Boolean) : null;
  const equip_str = String(formData.get('equipment') ?? '').trim();
  const equipment = equip_str ? equip_str.split(',').map(s => s.trim()).filter(Boolean) : null;

  if (!id || !title || !category) return { ok: false, error: 'Missing fields' };

  const { error } = await (supabase.from('drills') as Any)
    .update({ title, category, description, instructions, duration_minutes, age_groups, equipment })
    .eq('id', id);

  if (error) return { ok: false, error: error.message };
  revalidatePath('/dashboard/drills');
  revalidatePath(`/dashboard/drills/${id}`);
  return { ok: true };
}

export async function deleteDrill(formData: FormData) {
  const supabase = createClient();
  const id = String(formData.get('id') ?? '');
  const { error } = await (supabase.from('drills') as Any).delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/dashboard/drills');
  return { ok: true };
}

// Exercises

export async function createExercise(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/sign-in');

  const title = String(formData.get('title') ?? '').trim();
  const category = String(formData.get('category') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim() || null;
  const instructions = String(formData.get('instructions') ?? '').trim() || null;
  const def_sets_str = String(formData.get('default_sets') ?? '').trim();
  const default_sets = def_sets_str ? parseInt(def_sets_str, 10) : null;
  const def_reps_str = String(formData.get('default_reps') ?? '').trim();
  const default_reps = def_reps_str ? parseInt(def_reps_str, 10) : null;
  const def_dur_str = String(formData.get('default_duration_seconds') ?? '').trim();
  const default_duration_seconds = def_dur_str ? parseInt(def_dur_str, 10) : null;
  const equip_str = String(formData.get('equipment') ?? '').trim();
  const equipment = equip_str ? equip_str.split(',').map(s => s.trim()).filter(Boolean) : null;

  if (!title) return { ok: false, error: 'Title is required.' };
  if (!category) return { ok: false, error: 'Category is required.' };

  const { data, error } = await (supabase.from('exercises') as Any)
    .insert({ title, category, description, instructions, default_sets, default_reps, default_duration_seconds, equipment, created_by: user.id })
    .select('id').single();

  if (error) return { ok: false, error: error.message };
  revalidatePath('/dashboard/exercises');
  return { ok: true, id: (data as { id: string }).id };
}

export async function updateExercise(formData: FormData) {
  const supabase = createClient();
  const id = String(formData.get('id') ?? '').trim();
  const title = String(formData.get('title') ?? '').trim();
  const category = String(formData.get('category') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim() || null;
  const instructions = String(formData.get('instructions') ?? '').trim() || null;
  const def_sets_str = String(formData.get('default_sets') ?? '').trim();
  const default_sets = def_sets_str ? parseInt(def_sets_str, 10) : null;
  const def_reps_str = String(formData.get('default_reps') ?? '').trim();
  const default_reps = def_reps_str ? parseInt(def_reps_str, 10) : null;
  const def_dur_str = String(formData.get('default_duration_seconds') ?? '').trim();
  const default_duration_seconds = def_dur_str ? parseInt(def_dur_str, 10) : null;
  const equip_str = String(formData.get('equipment') ?? '').trim();
  const equipment = equip_str ? equip_str.split(',').map(s => s.trim()).filter(Boolean) : null;

  if (!id || !title || !category) return { ok: false, error: 'Missing fields' };

  const { error } = await (supabase.from('exercises') as Any)
    .update({ title, category, description, instructions, default_sets, default_reps, default_duration_seconds, equipment })
    .eq('id', id);

  if (error) return { ok: false, error: error.message };
  revalidatePath('/dashboard/exercises');
  revalidatePath(`/dashboard/exercises/${id}`);
  return { ok: true };
}

export async function deleteExercise(formData: FormData) {
  const supabase = createClient();
  const id = String(formData.get('id') ?? '');
  const { error } = await (supabase.from('exercises') as Any).delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/dashboard/exercises');
  return { ok: true };
}

// Goal templates

export async function createGoalTemplate(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/sign-in');

  const title = String(formData.get('title') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim() || null;
  const domain = String(formData.get('domain') ?? '').trim() as GoalDomain;
  const category = String(formData.get('category') ?? '').trim() as GoalCategory;
  const target_value_str = String(formData.get('target_value') ?? '').trim();
  const target_value = target_value_str ? parseFloat(target_value_str) : null;
  const target_unit = String(formData.get('target_unit') ?? '').trim() || null;
  const weeks_str = String(formData.get('suggested_deadline_weeks') ?? '').trim();
  const suggested_deadline_weeks = weeks_str ? parseInt(weeks_str, 10) : null;

  if (!title) return { ok: false, error: 'Title is required.' };
  if (!domain) return { ok: false, error: 'Domain is required.' };
  if (!category) return { ok: false, error: 'Category is required.' };

  const { data, error } = await (supabase.from('goal_templates') as Any)
    .insert({ title, description, domain, category, target_value, target_unit, suggested_deadline_weeks, created_by: user.id })
    .select('id').single();

  if (error) return { ok: false, error: error.message };
  revalidatePath('/dashboard/goal-templates');
  return { ok: true, id: (data as { id: string }).id };
}

export async function updateGoalTemplate(formData: FormData) {
  const supabase = createClient();
  const id = String(formData.get('id') ?? '').trim();
  const title = String(formData.get('title') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim() || null;
  const domain = String(formData.get('domain') ?? '').trim() as GoalDomain;
  const category = String(formData.get('category') ?? '').trim() as GoalCategory;
  const target_value_str = String(formData.get('target_value') ?? '').trim();
  const target_value = target_value_str ? parseFloat(target_value_str) : null;
  const target_unit = String(formData.get('target_unit') ?? '').trim() || null;
  const weeks_str = String(formData.get('suggested_deadline_weeks') ?? '').trim();
  const suggested_deadline_weeks = weeks_str ? parseInt(weeks_str, 10) : null;

  if (!id || !title || !domain || !category) return { ok: false, error: 'Missing fields' };

  const { error } = await (supabase.from('goal_templates') as Any)
    .update({ title, description, domain, category, target_value, target_unit, suggested_deadline_weeks })
    .eq('id', id);

  if (error) return { ok: false, error: error.message };
  revalidatePath('/dashboard/goal-templates');
  revalidatePath(`/dashboard/goal-templates/${id}`);
  return { ok: true };
}

export async function deleteGoalTemplate(formData: FormData) {
  const supabase = createClient();
  const id = String(formData.get('id') ?? '');
  const { error } = await (supabase.from('goal_templates') as Any).delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/dashboard/goal-templates');
  return { ok: true };
}

// Performance tests

export async function createPerformanceTest(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/sign-in');

  const title = String(formData.get('title') ?? '').trim();
  const domain = String(formData.get('domain') ?? '').trim() as GoalDomain;
  const description = String(formData.get('description') ?? '').trim() || null;
  const instructions = String(formData.get('instructions') ?? '').trim() || null;
  const unit = String(formData.get('unit') ?? '').trim() || null;
  const direction = String(formData.get('direction') ?? 'higher_is_better').trim();

  if (!title) return { ok: false, error: 'Title is required.' };
  if (!domain) return { ok: false, error: 'Domain is required.' };

  const { data, error } = await (supabase.from('performance_tests') as Any)
    .insert({ title, domain, description, instructions, unit, direction, created_by: user.id })
    .select('id').single();

  if (error) return { ok: false, error: error.message };
  revalidatePath('/dashboard/performance-tests');
  return { ok: true, id: (data as { id: string }).id };
}

export async function updatePerformanceTest(formData: FormData) {
  const supabase = createClient();
  const id = String(formData.get('id') ?? '').trim();
  const title = String(formData.get('title') ?? '').trim();
  const domain = String(formData.get('domain') ?? '').trim() as GoalDomain;
  const description = String(formData.get('description') ?? '').trim() || null;
  const instructions = String(formData.get('instructions') ?? '').trim() || null;
  const unit = String(formData.get('unit') ?? '').trim() || null;
  const direction = String(formData.get('direction') ?? '').trim();

  if (!id || !title || !domain) return { ok: false, error: 'Missing fields' };

  const { error } = await (supabase.from('performance_tests') as Any)
    .update({ title, domain, description, instructions, unit, direction })
    .eq('id', id);

  if (error) return { ok: false, error: error.message };
  revalidatePath('/dashboard/performance-tests');
  revalidatePath(`/dashboard/performance-tests/${id}`);
  return { ok: true };
}

export async function deletePerformanceTest(formData: FormData) {
  const supabase = createClient();
  const id = String(formData.get('id') ?? '');
  const { error } = await (supabase.from('performance_tests') as Any).delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/dashboard/performance-tests');
  return { ok: true };
}
