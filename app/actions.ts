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

// ============================================================================
// Composite Performance Tests (CPTs) - admin + director
// ============================================================================

export async function createCompositeTest(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/sign-in');

  const title = String(formData.get('title') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim() || null;
  // test_ids submitted as JSON array of { test_id, sequence }
  const itemsRaw = String(formData.get('items') ?? '').trim();
  let items: Array<{ test_id: string; sequence: number }> = [];
  if (itemsRaw) {
    try { items = JSON.parse(itemsRaw); } catch { return { ok: false, error: 'Could not parse items.' }; }
  }

  if (!title) return { ok: false, error: 'Title is required.' };
  if (items.length === 0) return { ok: false, error: 'A composite test needs at least one individual test.' };

  const { data: composite, error: cErr } = await (supabase.from('composite_performance_tests') as Any)
    .insert({ title, description, created_by: user.id })
    .select('id').single();

  if (cErr || !composite) return { ok: false, error: cErr?.message ?? 'Could not create composite.' };
  const composite_id = (composite as { id: string }).id;

  const itemRows = items.map((i, idx) => ({
    composite_id,
    test_id: i.test_id,
    sequence: i.sequence ?? idx,
  }));

  const { error: iErr } = await (supabase.from('composite_performance_test_items') as Any).insert(itemRows);
  if (iErr) {
    // Roll back the composite since items failed
    await (supabase.from('composite_performance_tests') as Any).delete().eq('id', composite_id);
    return { ok: false, error: iErr.message };
  }

  revalidatePath('/dashboard/composite-performance-tests');
  return { ok: true, id: composite_id };
}

export async function updateCompositeTest(formData: FormData) {
  const supabase = createClient();
  const id = String(formData.get('id') ?? '').trim();
  const title = String(formData.get('title') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim() || null;
  const itemsRaw = String(formData.get('items') ?? '').trim();
  let items: Array<{ test_id: string; sequence: number }> = [];
  if (itemsRaw) {
    try { items = JSON.parse(itemsRaw); } catch { return { ok: false, error: 'Could not parse items.' }; }
  }

  if (!id || !title) return { ok: false, error: 'Missing fields' };
  if (items.length === 0) return { ok: false, error: 'A composite test needs at least one individual test.' };

  const { error: uErr } = await (supabase.from('composite_performance_tests') as Any)
    .update({ title, description }).eq('id', id);
  if (uErr) return { ok: false, error: uErr.message };

  // Replace items: delete all, insert fresh. Simpler and avoids tracking diffs client-side.
  const { error: dErr } = await (supabase.from('composite_performance_test_items') as Any)
    .delete().eq('composite_id', id);
  if (dErr) return { ok: false, error: dErr.message };

  const itemRows = items.map((i, idx) => ({
    composite_id: id,
    test_id: i.test_id,
    sequence: i.sequence ?? idx,
  }));

  const { error: iErr } = await (supabase.from('composite_performance_test_items') as Any).insert(itemRows);
  if (iErr) return { ok: false, error: iErr.message };

  revalidatePath('/dashboard/composite-performance-tests');
  revalidatePath(`/dashboard/composite-performance-tests/${id}`);
  return { ok: true };
}

export async function deleteCompositeTest(formData: FormData) {
  const supabase = createClient();
  const id = String(formData.get('id') ?? '');
  const { error } = await (supabase.from('composite_performance_tests') as Any).delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/dashboard/composite-performance-tests');
  return { ok: true };
}

// ============================================================================
// Phase 3a: Students (director-managed enrollment)
// ============================================================================

export async function createStudent(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/sign-in');

  const full_name = String(formData.get('full_name') ?? '').trim();
  const date_of_birth = String(formData.get('date_of_birth') ?? '').trim() || null;
  const jersey_number = String(formData.get('jersey_number') ?? '').trim() || null;
  const position = (String(formData.get('position') ?? '').trim() || null) as 'F' | 'D' | 'G' | null;
  const dominant_hand = (String(formData.get('dominant_hand') ?? '').trim() || null) as 'L' | 'R' | null;
  const team_label = String(formData.get('team_label') ?? '').trim() || null;
  const notes = String(formData.get('notes') ?? '').trim() || null;

  if (!full_name) return { ok: false, error: "Student's name is required." };

  const { data, error } = await (supabase.from('students') as Any)
    .insert({ full_name, date_of_birth, jersey_number, position, dominant_hand, team_label, notes })
    .select('id').single();

  if (error) return { ok: false, error: error.message };
  revalidatePath('/dashboard/students');
  return { ok: true, id: (data as { id: string }).id };
}

export async function updateStudent(formData: FormData) {
  const supabase = createClient();
  const id = String(formData.get('id') ?? '').trim();
  const full_name = String(formData.get('full_name') ?? '').trim();
  const date_of_birth = String(formData.get('date_of_birth') ?? '').trim() || null;
  const jersey_number = String(formData.get('jersey_number') ?? '').trim() || null;
  const position = (String(formData.get('position') ?? '').trim() || null) as 'F' | 'D' | 'G' | null;
  const dominant_hand = (String(formData.get('dominant_hand') ?? '').trim() || null) as 'L' | 'R' | null;
  const team_label = String(formData.get('team_label') ?? '').trim() || null;
  const notes = String(formData.get('notes') ?? '').trim() || null;

  if (!id || !full_name) return { ok: false, error: 'Missing fields' };

  const { error } = await (supabase.from('students') as Any)
    .update({ full_name, date_of_birth, jersey_number, position, dominant_hand, team_label, notes })
    .eq('id', id);

  if (error) return { ok: false, error: error.message };
  revalidatePath('/dashboard/students');
  revalidatePath(`/dashboard/students/${id}`);
  return { ok: true };
}

export async function deactivateStudent(formData: FormData) {
  const supabase = createClient();
  const id = String(formData.get('id') ?? '');
  const { error } = await (supabase.from('students') as Any).update({ active: false }).eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/dashboard/students');
  return { ok: true };
}

export async function reactivateStudent(formData: FormData) {
  const supabase = createClient();
  const id = String(formData.get('id') ?? '');
  const { error } = await (supabase.from('students') as Any).update({ active: true }).eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/dashboard/students');
  return { ok: true };
}

// Link student's profile (when a student self-registers and director links them)
export async function linkStudentProfile(formData: FormData) {
  const supabase = createClient();
  const student_id = String(formData.get('student_id') ?? '').trim();
  const profile_email = String(formData.get('profile_email') ?? '').trim().toLowerCase();

  if (!student_id || !profile_email) return { ok: false, error: 'Missing fields' };

  const { data: profileRow } = await supabase
    .from('profiles').select('id, role').eq('email', profile_email).single();

  if (!profileRow) {
    return { ok: false, error: `No account found for ${profile_email}. The student must sign up first.` };
  }

  const profile = profileRow as { id: string; role: AppRole };
  if (profile.role !== 'student') {
    return { ok: false, error: `${profile_email} has role "${profile.role}", not student.` };
  }

  const { error } = await (supabase.from('students') as Any)
    .update({ profile_id: profile.id }).eq('id', student_id);

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/dashboard/students/${student_id}`);
  return { ok: true };
}

export async function unlinkStudentProfile(formData: FormData) {
  const supabase = createClient();
  const student_id = String(formData.get('student_id') ?? '').trim();
  const { error } = await (supabase.from('students') as Any)
    .update({ profile_id: null }).eq('id', student_id);

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/dashboard/students/${student_id}`);
  return { ok: true };
}

// Family link (parent <-> student)

export async function linkParent(formData: FormData) {
  const supabase = createClient();
  const student_id = String(formData.get('student_id') ?? '').trim();
  const parent_email = String(formData.get('parent_email') ?? '').trim().toLowerCase();
  const relationship = String(formData.get('relationship') ?? 'guardian').trim() || 'guardian';
  const is_primary = formData.get('is_primary') === 'on';

  if (!student_id || !parent_email) return { ok: false, error: 'Missing fields' };

  const { data: parentRow } = await supabase
    .from('profiles').select('id, role').eq('email', parent_email).single();

  if (!parentRow) {
    return { ok: false, error: `No account found for ${parent_email}. Parent must sign up first (or invite them).` };
  }

  const parent = parentRow as { id: string; role: AppRole };
  if (parent.role !== 'parent' && parent.role !== 'admin' && parent.role !== 'director') {
    return { ok: false, error: `${parent_email} has role "${parent.role}", not parent.` };
  }

  const { error } = await (supabase.from('family_links') as Any).insert({
    parent_id: parent.id, student_id, relationship, is_primary,
  });

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/dashboard/students/${student_id}`);
  return { ok: true };
}

export async function unlinkParent(formData: FormData) {
  const supabase = createClient();
  const id = String(formData.get('id') ?? '');
  const student_id = String(formData.get('student_id') ?? '');
  const { error } = await (supabase.from('family_links') as Any).delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/dashboard/students/${student_id}`);
  return { ok: true };
}

// ============================================================================
// Phase 3a: Practice Plans (templates)
// ============================================================================

export async function createPracticePlan(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/sign-in');

  const title = String(formData.get('title') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim() || null;
  const focus = String(formData.get('focus') ?? '').trim() || null;
  const duration_str = String(formData.get('duration_minutes') ?? '').trim();
  const duration_minutes = duration_str ? parseInt(duration_str, 10) : null;

  // items[] submitted as JSON: [{ item_type: 'drill'|'skill', drill_id?, skill_title?, duration_override?, coach_notes?, sequence }]
  const itemsRaw = String(formData.get('items') ?? '').trim();
  let items: Array<{
    item_type: 'drill' | 'skill';
    drill_id?: string;
    skill_title?: string;
    duration_override?: number | null;
    coach_notes?: string | null;
    sequence: number;
  }> = [];
  if (itemsRaw) {
    try { items = JSON.parse(itemsRaw); } catch { return { ok: false, error: 'Could not parse items.' }; }
  }

  if (!title) return { ok: false, error: 'Title is required.' };

  const { data: plan, error: pErr } = await (supabase.from('practice_plans') as Any)
    .insert({ title, description, focus, duration_minutes, is_template: true, created_by: user.id })
    .select('id').single();

  if (pErr || !plan) return { ok: false, error: pErr?.message ?? 'Could not create plan.' };
  const plan_id = (plan as { id: string }).id;

  if (items.length > 0) {
    const itemRows = items.map((i, idx) => ({
      plan_id,
      sequence: i.sequence ?? idx,
      item_type: i.item_type,
      drill_id: i.item_type === 'drill' ? (i.drill_id ?? null) : null,
      skill_title: i.item_type === 'skill' ? (i.skill_title ?? null) : null,
      duration_override: i.duration_override ?? null,
      coach_notes: i.coach_notes ?? null,
    }));
    const { error: iErr } = await (supabase.from('practice_plan_items') as Any).insert(itemRows);
    if (iErr) {
      await (supabase.from('practice_plans') as Any).delete().eq('id', plan_id);
      return { ok: false, error: iErr.message };
    }
  }

  revalidatePath('/dashboard/practice-plans');
  return { ok: true, id: plan_id };
}

export async function updatePracticePlan(formData: FormData) {
  const supabase = createClient();
  const id = String(formData.get('id') ?? '').trim();
  const title = String(formData.get('title') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim() || null;
  const focus = String(formData.get('focus') ?? '').trim() || null;
  const duration_str = String(formData.get('duration_minutes') ?? '').trim();
  const duration_minutes = duration_str ? parseInt(duration_str, 10) : null;

  const itemsRaw = String(formData.get('items') ?? '').trim();
  let items: Array<{
    item_type: 'drill' | 'skill';
    drill_id?: string;
    skill_title?: string;
    duration_override?: number | null;
    coach_notes?: string | null;
    sequence: number;
  }> = [];
  if (itemsRaw) {
    try { items = JSON.parse(itemsRaw); } catch { return { ok: false, error: 'Could not parse items.' }; }
  }

  if (!id || !title) return { ok: false, error: 'Missing fields' };

  const { error: uErr } = await (supabase.from('practice_plans') as Any)
    .update({ title, description, focus, duration_minutes }).eq('id', id);
  if (uErr) return { ok: false, error: uErr.message };

  // Replace items: delete + insert
  const { error: dErr } = await (supabase.from('practice_plan_items') as Any).delete().eq('plan_id', id);
  if (dErr) return { ok: false, error: dErr.message };

  if (items.length > 0) {
    const itemRows = items.map((i, idx) => ({
      plan_id: id,
      sequence: i.sequence ?? idx,
      item_type: i.item_type,
      drill_id: i.item_type === 'drill' ? (i.drill_id ?? null) : null,
      skill_title: i.item_type === 'skill' ? (i.skill_title ?? null) : null,
      duration_override: i.duration_override ?? null,
      coach_notes: i.coach_notes ?? null,
    }));
    const { error: iErr } = await (supabase.from('practice_plan_items') as Any).insert(itemRows);
    if (iErr) return { ok: false, error: iErr.message };
  }

  revalidatePath('/dashboard/practice-plans');
  revalidatePath(`/dashboard/practice-plans/${id}`);
  return { ok: true };
}

export async function deletePracticePlan(formData: FormData) {
  const supabase = createClient();
  const id = String(formData.get('id') ?? '');
  const { error } = await (supabase.from('practice_plans') as Any).delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/dashboard/practice-plans');
  return { ok: true };
}

// ============================================================================
// Students (admin + director)
// ============================================================================

export async function createStudent(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/sign-in');

  const full_name = String(formData.get('full_name') ?? '').trim();
  const date_of_birth = String(formData.get('date_of_birth') ?? '').trim() || null;
  const jersey_number = String(formData.get('jersey_number') ?? '').trim() || null;
  const position = (String(formData.get('position') ?? '').trim() || null) as 'F' | 'D' | 'G' | null;
  const dominant_hand = (String(formData.get('dominant_hand') ?? '').trim() || null) as 'L' | 'R' | null;
  const team_label = String(formData.get('team_label') ?? '').trim() || null;
  const notes = String(formData.get('notes') ?? '').trim() || null;

  if (!full_name) return { ok: false, error: "Student's name is required." };

  const { data, error } = await (supabase.from('students') as Any)
    .insert({ full_name, date_of_birth, jersey_number, position, dominant_hand, team_label, notes })
    .select('id').single();

  if (error) return { ok: false, error: error.message };
  revalidatePath('/dashboard/students');
  return { ok: true, id: (data as { id: string }).id };
}

export async function updateStudent(formData: FormData) {
  const supabase = createClient();
  const id = String(formData.get('id') ?? '').trim();
  const full_name = String(formData.get('full_name') ?? '').trim();
  const date_of_birth = String(formData.get('date_of_birth') ?? '').trim() || null;
  const jersey_number = String(formData.get('jersey_number') ?? '').trim() || null;
  const position = (String(formData.get('position') ?? '').trim() || null) as 'F' | 'D' | 'G' | null;
  const dominant_hand = (String(formData.get('dominant_hand') ?? '').trim() || null) as 'L' | 'R' | null;
  const team_label = String(formData.get('team_label') ?? '').trim() || null;
  const notes = String(formData.get('notes') ?? '').trim() || null;

  if (!id || !full_name) return { ok: false, error: 'Missing fields' };

  const { error } = await (supabase.from('students') as Any)
    .update({ full_name, date_of_birth, jersey_number, position, dominant_hand, team_label, notes })
    .eq('id', id);

  if (error) return { ok: false, error: error.message };
  revalidatePath('/dashboard/students');
  revalidatePath(`/dashboard/students/${id}`);
  return { ok: true };
}

export async function deactivateStudent(formData: FormData) {
  const supabase = createClient();
  const id = String(formData.get('id') ?? '');
  const { error } = await (supabase.from('students') as Any)
    .update({ active: false }).eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/dashboard/students');
  return { ok: true };
}

export async function reactivateStudent(formData: FormData) {
  const supabase = createClient();
  const id = String(formData.get('id') ?? '');
  const { error } = await (supabase.from('students') as Any)
    .update({ active: true }).eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/dashboard/students');
  return { ok: true };
}

// Family link management
export async function linkParent(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/sign-in');

  const student_id = String(formData.get('student_id') ?? '').trim();
  const parent_email = String(formData.get('parent_email') ?? '').trim().toLowerCase();
  const relationship = String(formData.get('relationship') ?? 'guardian').trim() || 'guardian';
  const is_primary = formData.get('is_primary') === 'on';

  if (!student_id || !parent_email) return { ok: false, error: 'Missing student or parent email.' };

  const { data: parentRow } = await supabase
    .from('profiles').select('id, role').eq('email', parent_email).single();

  if (!parentRow) {
    return { ok: false, error: `No account found for ${parent_email}. The parent must sign up first before you can link them.` };
  }

  const { error } = await (supabase.from('family_links') as Any).insert({
    parent_id: (parentRow as { id: string }).id,
    student_id, relationship, is_primary,
  });

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/dashboard/students/${student_id}`);
  return { ok: true };
}

export async function unlinkParent(formData: FormData) {
  const supabase = createClient();
  const id = String(formData.get('id') ?? '');
  const student_id = String(formData.get('student_id') ?? '');
  const { error } = await (supabase.from('family_links') as Any).delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/dashboard/students/${student_id}`);
  return { ok: true };
}

// Link existing self-registered student profile to a student record
export async function linkStudentProfile(formData: FormData) {
  const supabase = createClient();
  const student_id = String(formData.get('student_id') ?? '').trim();
  const student_email = String(formData.get('student_email') ?? '').trim().toLowerCase();

  if (!student_id || !student_email) return { ok: false, error: 'Missing fields' };

  const { data: profileRow } = await supabase
    .from('profiles').select('id, role').eq('email', student_email).single();

  if (!profileRow) {
    return { ok: false, error: `No account found for ${student_email}. They must sign up first.` };
  }

  const profile = profileRow as { id: string; role: string };
  if (profile.role !== 'student') {
    return { ok: false, error: `${student_email} has role "${profile.role}". They must be a student to link to a student record.` };
  }

  const { error } = await (supabase.from('students') as Any)
    .update({ profile_id: profile.id }).eq('id', student_id);

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/dashboard/students/${student_id}`);
  return { ok: true };
}

export async function unlinkStudentProfile(formData: FormData) {
  const supabase = createClient();
  const student_id = String(formData.get('student_id') ?? '');
  const { error } = await (supabase.from('students') as Any)
    .update({ profile_id: null }).eq('id', student_id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/dashboard/students/${student_id}`);
  return { ok: true };
}

// ============================================================================
// Practice Plans (templates) - admin + director + coach
// ============================================================================

export async function createPracticePlan(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/sign-in');

  const title = String(formData.get('title') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim() || null;
  const focus = String(formData.get('focus') ?? '').trim() || null;
  const duration_str = String(formData.get('duration_minutes') ?? '').trim();
  const duration_minutes = duration_str ? parseInt(duration_str, 10) : null;

  // items: JSON array [{ item_type: 'drill'|'skill', drill_id?, skill_title?, duration_override?, coach_notes? }]
  const itemsRaw = String(formData.get('items') ?? '').trim();
  let items: Array<{
    item_type: 'drill' | 'skill';
    drill_id?: string | null;
    skill_title?: string | null;
    duration_override?: number | null;
    coach_notes?: string | null;
  }> = [];
  if (itemsRaw) {
    try { items = JSON.parse(itemsRaw); } catch { return { ok: false, error: 'Could not parse plan items.' }; }
  }

  if (!title) return { ok: false, error: 'Title is required.' };

  const { data: plan, error: pErr } = await (supabase.from('practice_plans') as Any)
    .insert({ title, description, focus, duration_minutes, is_template: true, created_by: user.id })
    .select('id').single();

  if (pErr || !plan) return { ok: false, error: pErr?.message ?? 'Could not create plan.' };
  const plan_id = (plan as { id: string }).id;

  if (items.length > 0) {
    const itemRows = items.map((i, idx) => ({
      plan_id,
      sequence: idx,
      item_type: i.item_type,
      drill_id: i.item_type === 'drill' ? (i.drill_id ?? null) : null,
      skill_title: i.item_type === 'skill' ? (i.skill_title ?? null) : null,
      duration_override: i.duration_override ?? null,
      coach_notes: i.coach_notes ?? null,
    }));
    const { error: iErr } = await (supabase.from('practice_plan_items') as Any).insert(itemRows);
    if (iErr) {
      await (supabase.from('practice_plans') as Any).delete().eq('id', plan_id);
      return { ok: false, error: iErr.message };
    }
  }

  revalidatePath('/dashboard/practice-plans');
  return { ok: true, id: plan_id };
}

export async function updatePracticePlan(formData: FormData) {
  const supabase = createClient();
  const id = String(formData.get('id') ?? '').trim();
  const title = String(formData.get('title') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim() || null;
  const focus = String(formData.get('focus') ?? '').trim() || null;
  const duration_str = String(formData.get('duration_minutes') ?? '').trim();
  const duration_minutes = duration_str ? parseInt(duration_str, 10) : null;
  const itemsRaw = String(formData.get('items') ?? '').trim();
  let items: Array<{
    item_type: 'drill' | 'skill';
    drill_id?: string | null;
    skill_title?: string | null;
    duration_override?: number | null;
    coach_notes?: string | null;
  }> = [];
  if (itemsRaw) {
    try { items = JSON.parse(itemsRaw); } catch { return { ok: false, error: 'Could not parse items.' }; }
  }

  if (!id || !title) return { ok: false, error: 'Missing fields' };

  const { error: uErr } = await (supabase.from('practice_plans') as Any)
    .update({ title, description, focus, duration_minutes }).eq('id', id);
  if (uErr) return { ok: false, error: uErr.message };

  // Replace items
  const { error: dErr } = await (supabase.from('practice_plan_items') as Any).delete().eq('plan_id', id);
  if (dErr) return { ok: false, error: dErr.message };

  if (items.length > 0) {
    const itemRows = items.map((i, idx) => ({
      plan_id: id,
      sequence: idx,
      item_type: i.item_type,
      drill_id: i.item_type === 'drill' ? (i.drill_id ?? null) : null,
      skill_title: i.item_type === 'skill' ? (i.skill_title ?? null) : null,
      duration_override: i.duration_override ?? null,
      coach_notes: i.coach_notes ?? null,
    }));
    const { error: iErr } = await (supabase.from('practice_plan_items') as Any).insert(itemRows);
    if (iErr) return { ok: false, error: iErr.message };
  }

  revalidatePath('/dashboard/practice-plans');
  revalidatePath(`/dashboard/practice-plans/${id}`);
  return { ok: true };
}

export async function deletePracticePlan(formData: FormData) {
  const supabase = createClient();
  const id = String(formData.get('id') ?? '');
  const { error } = await (supabase.from('practice_plans') as Any).delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/dashboard/practice-plans');
  return { ok: true };
}
