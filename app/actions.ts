'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
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
  const linked_student_id = String(formData.get('linked_student_id') ?? '').trim() || null;

  if (!email || !role) return { ok: false, error: 'Email and role are required.' };

  const validRoles: AppRole[] = ['admin', 'director', 'coach', 'trainer', 'student', 'parent'];
  if (!validRoles.includes(role)) return { ok: false, error: 'Invalid role' };

  // Age gate: sub-13 students cannot have their own login account (Q2 = C)
  if (role === 'student' && linked_student_id) {
    const { data: studentRow } = await supabase
      .from('students').select('date_of_birth, full_name').eq('id', linked_student_id).single();
    if (studentRow) {
      const s = studentRow as { date_of_birth: string | null; full_name: string };
      if (s.date_of_birth) {
        const dob = new Date(s.date_of_birth);
        const thirteenYearsAgo = new Date();
        thirteenYearsAgo.setFullYear(thirteenYearsAgo.getFullYear() - 13);
        if (dob > thirteenYearsAgo) {
          return {
            ok: false,
            error: `${s.full_name} is under 13. Minor students can't have their own login account — link a parent instead.`,
          };
        }
      }
    }
  }

  const { error } = await (supabase.from('invites') as Any).insert({
    email, role, note, linked_student_id, invited_by: user.id,
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

  // Age gate: sub-13 students cannot have their own login account (Q2 = C)
  const { data: studentRow } = await supabase
    .from('students').select('date_of_birth, full_name').eq('id', student_id).single();
  if (studentRow) {
    const s = studentRow as { date_of_birth: string | null; full_name: string };
    if (s.date_of_birth) {
      const dob = new Date(s.date_of_birth);
      const thirteenYearsAgo = new Date();
      thirteenYearsAgo.setFullYear(thirteenYearsAgo.getFullYear() - 13);
      if (dob > thirteenYearsAgo) {
        return {
          ok: false,
          error: `${s.full_name} is under 13. Minor students can't have their own login account — link a parent to the student record instead.`,
        };
      }
    }
  }

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
// Goal plans (admin + director)
// ============================================================================

export async function createGoalPlan(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/sign-in');

  const student_id = String(formData.get('student_id') ?? '').trim();
  const title = String(formData.get('title') ?? '').trim();
  const starts_on = String(formData.get('starts_on') ?? '').trim() || null;
  const ends_on = String(formData.get('ends_on') ?? '').trim() || null;
  const agreement_notes = String(formData.get('agreement_notes') ?? '').trim() || null;
  const season_id = String(formData.get('season_id') ?? '').trim() || null;

  if (!student_id) return { ok: false, error: 'Student is required.' };
  if (!title) return { ok: false, error: 'Plan title is required.' };

  const { data, error } = await (supabase.from('goal_plans') as Any)
    .insert({ student_id, title, starts_on, ends_on, agreement_notes, season_id, status: 'draft', created_by: user.id })
    .select('id').single();

  if (error) return { ok: false, error: error.message };
  revalidatePath('/dashboard/goal-management');
  return { ok: true, id: (data as { id: string }).id };
}

export async function updateGoalPlan(formData: FormData) {
  const supabase = createClient();
  const id = String(formData.get('id') ?? '').trim();
  const title = String(formData.get('title') ?? '').trim();
  const status = String(formData.get('status') ?? '').trim() as 'draft' | 'active' | 'completed' | 'archived';
  const starts_on = String(formData.get('starts_on') ?? '').trim() || null;
  const ends_on = String(formData.get('ends_on') ?? '').trim() || null;
  const agreement_notes = String(formData.get('agreement_notes') ?? '').trim() || null;

  if (!id || !title) return { ok: false, error: 'Missing fields' };
  const validStatuses = ['draft', 'active', 'completed', 'archived'];
  if (!validStatuses.includes(status)) return { ok: false, error: 'Invalid status' };

  const { error } = await (supabase.from('goal_plans') as Any)
    .update({ title, status, starts_on, ends_on, agreement_notes })
    .eq('id', id);

  if (error) return { ok: false, error: error.message };
  revalidatePath('/dashboard/goal-management');
  revalidatePath(`/dashboard/goal-management/${id}`);
  return { ok: true };
}

export async function deleteGoalPlan(formData: FormData) {
  const supabase = createClient();
  const id = String(formData.get('id') ?? '');
  const { error } = await (supabase.from('goal_plans') as Any).delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/dashboard/goal-management');
  return { ok: true };
}

// Goals within a plan (1-3 enforced in UI)

export async function createGoalInPlan(formData: FormData) {
  const supabase = createClient();

  const plan_id = String(formData.get('plan_id') ?? '').trim();
  const template_id = String(formData.get('template_id') ?? '').trim() || null;
  const title = String(formData.get('title') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim() || null;
  const domain = (String(formData.get('domain') ?? '').trim() || null) as 'on_ice' | 'off_ice' | null;
  const category = String(formData.get('category') ?? '').trim() || null;
  const target_value = String(formData.get('target_value') ?? '').trim() || null;
  const target_unit = String(formData.get('target_unit') ?? '').trim() || null;
  const due_date = String(formData.get('due_date') ?? '').trim() || null;
  const seq_str = String(formData.get('sequence') ?? '').trim();
  const sequence = seq_str ? parseInt(seq_str, 10) : 1;

  if (!plan_id || !title) return { ok: false, error: 'Plan and title are required.' };

  const { error } = await (supabase.from('goal_plan_goals') as Any).insert({
    plan_id, template_id, title, description, domain, category,
    target_value, target_unit, due_date, sequence, status: 'active',
  });

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/dashboard/goal-management/${plan_id}`);
  return { ok: true };
}

export async function updateGoalInPlan(formData: FormData) {
  const supabase = createClient();
  const id = String(formData.get('id') ?? '').trim();
  const plan_id = String(formData.get('plan_id') ?? '').trim();
  const title = String(formData.get('title') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim() || null;
  const target_value = String(formData.get('target_value') ?? '').trim() || null;
  const target_unit = String(formData.get('target_unit') ?? '').trim() || null;
  const current_value = String(formData.get('current_value') ?? '').trim() || null;
  const progress_str = String(formData.get('progress_pct') ?? '').trim();
  const progress_pct = progress_str ? Math.min(100, Math.max(0, parseInt(progress_str, 10))) : 0;
  const due_date = String(formData.get('due_date') ?? '').trim() || null;
  const status = String(formData.get('status') ?? 'active').trim();
  const achieved_at = status === 'achieved' ? new Date().toISOString() : null;

  if (!id || !title) return { ok: false, error: 'Missing fields' };

  const { error } = await (supabase.from('goal_plan_goals') as Any).update({
    title, description, target_value, target_unit, current_value,
    progress_pct, due_date, status, achieved_at,
  }).eq('id', id);

  if (error) return { ok: false, error: error.message };
  if (plan_id) revalidatePath(`/dashboard/goal-management/${plan_id}`);
  return { ok: true };
}

export async function deleteGoalFromPlan(formData: FormData) {
  const supabase = createClient();
  const id = String(formData.get('id') ?? '');
  const plan_id = String(formData.get('plan_id') ?? '');
  const { error } = await (supabase.from('goal_plan_goals') as Any).delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  if (plan_id) revalidatePath(`/dashboard/goal-management/${plan_id}`);
  return { ok: true };
}

// Performance tests attached to a plan

export async function attachTestToPlan(formData: FormData) {
  const supabase = createClient();
  const plan_id = String(formData.get('plan_id') ?? '').trim();
  const test_id = String(formData.get('test_id') ?? '').trim();
  const baseline_str = String(formData.get('baseline_value') ?? '').trim();
  const baseline_value = baseline_str ? parseFloat(baseline_str) : null;
  const target_str = String(formData.get('target_value') ?? '').trim();
  const target_value = target_str ? parseFloat(target_str) : null;
  const target_unit = String(formData.get('target_unit') ?? '').trim() || null;

  if (!plan_id || !test_id) return { ok: false, error: 'Missing fields' };

  const { error } = await (supabase.from('goal_plan_tests') as Any).insert({
    plan_id, test_id, baseline_value, target_value, target_unit,
  });

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/dashboard/goal-management/${plan_id}`);
  return { ok: true };
}

export async function detachTestFromPlan(formData: FormData) {
  const supabase = createClient();
  const id = String(formData.get('id') ?? '');
  const plan_id = String(formData.get('plan_id') ?? '');
  const { error } = await (supabase.from('goal_plan_tests') as Any).delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  if (plan_id) revalidatePath(`/dashboard/goal-management/${plan_id}`);
  return { ok: true };
}

// Reviews

export async function createReview(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/sign-in');

  const plan_id = String(formData.get('plan_id') ?? '').trim();
  const review_type = String(formData.get('review_type') ?? 'ad_hoc').trim() as 'scheduled' | 'ad_hoc';
  const scheduled_date = String(formData.get('scheduled_date') ?? '').trim() || null;

  if (!plan_id) return { ok: false, error: 'Plan is required.' };

  const { data, error } = await (supabase.from('reviews') as Any)
    .insert({ plan_id, review_type, scheduled_date, reviewer_id: user.id })
    .select('id').single();

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/dashboard/goal-management/${plan_id}`);
  return { ok: true, id: (data as { id: string }).id };
}

export async function updateReview(formData: FormData) {
  const supabase = createClient();
  const id = String(formData.get('id') ?? '').trim();
  const plan_id = String(formData.get('plan_id') ?? '').trim();
  const summary = String(formData.get('summary') ?? '').trim() || null;
  const concerns = String(formData.get('concerns') ?? '').trim() || null;
  const next_steps = String(formData.get('next_steps') ?? '').trim() || null;
  const scheduled_date = String(formData.get('scheduled_date') ?? '').trim() || null;

  if (!id) return { ok: false, error: 'Missing id' };

  const { error } = await (supabase.from('reviews') as Any).update({
    summary, concerns, next_steps, scheduled_date,
  }).eq('id', id);

  if (error) return { ok: false, error: error.message };
  if (plan_id) revalidatePath(`/dashboard/goal-management/${plan_id}`);
  return { ok: true };
}

export async function completeReview(formData: FormData) {
  const supabase = createClient();
  const id = String(formData.get('id') ?? '').trim();
  const plan_id = String(formData.get('plan_id') ?? '').trim();

  if (!id) return { ok: false, error: 'Missing id' };

  const { error } = await (supabase.from('reviews') as Any).update({
    completed_at: new Date().toISOString(),
  }).eq('id', id);

  if (error) return { ok: false, error: error.message };
  if (plan_id) revalidatePath(`/dashboard/goal-management/${plan_id}`);
  return { ok: true };
}

export async function deleteReview(formData: FormData) {
  const supabase = createClient();
  const id = String(formData.get('id') ?? '');
  const plan_id = String(formData.get('plan_id') ?? '');
  const { error } = await (supabase.from('reviews') as Any).delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  if (plan_id) revalidatePath(`/dashboard/goal-management/${plan_id}`);
  return { ok: true };
}

// ============================================================================
// Seasons (admin + director)
// ============================================================================

export async function createSeason(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/sign-in');

  const name = String(formData.get('name') ?? '').trim();
  const starts_on = String(formData.get('starts_on') ?? '').trim();
  const ends_on = String(formData.get('ends_on') ?? '').trim();

  if (!name) return { ok: false, error: 'Season name is required.' };
  if (!starts_on || !ends_on) return { ok: false, error: 'Start and end dates are required.' };

  const { data, error } = await (supabase.from('seasons') as Any)
    .insert({ name, starts_on, ends_on, is_current: false, created_by: user.id })
    .select('id').single();

  if (error) return { ok: false, error: error.message };
  revalidatePath('/dashboard/seasons');
  return { ok: true, id: (data as { id: string }).id };
}

export async function activateSeason(formData: FormData) {
  const supabase = createClient();
  const id = String(formData.get('id') ?? '').trim();
  if (!id) return { ok: false, error: 'Missing id' };

  // Check season is not archived
  const { data: seasonRow } = await supabase.from('seasons').select('archived_at').eq('id', id).single();
  if (!seasonRow) return { ok: false, error: 'Season not found' };
  if ((seasonRow as { archived_at: string | null }).archived_at) {
    return { ok: false, error: 'Cannot activate an archived season.' };
  }

  // Unset any existing current season, then set this one
  // unique index on is_current=true means we have to unset first
  const { error: e1 } = await (supabase.from('seasons') as Any)
    .update({ is_current: false }).eq('is_current', true);
  if (e1) return { ok: false, error: e1.message };

  const { error: e2 } = await (supabase.from('seasons') as Any)
    .update({ is_current: true }).eq('id', id);
  if (e2) return { ok: false, error: e2.message };

  revalidatePath('/dashboard/seasons');
  revalidatePath('/dashboard');
  return { ok: true };
}

export async function archiveSeason(formData: FormData) {
  const supabase = createClient();
  const id = String(formData.get('id') ?? '').trim();
  if (!id) return { ok: false, error: 'Missing id' };

  // Block if there are any draft/active goal plans in this season
  const { data: drafts } = await supabase
    .from('goal_plans').select('id').eq('season_id', id).in('status', ['draft', 'active']);
  if (drafts && drafts.length > 0) {
    return {
      ok: false,
      error: `Cannot archive: ${drafts.length} goal plan${drafts.length === 1 ? '' : 's'} still draft or active. Complete or archive each plan first.`,
    };
  }

  // Block if any reviews not completed
  const { data: reviews } = await supabase
    .from('reviews').select('id, plan_id').is('completed_at', null);
  let blockingReviews = 0;
  if (reviews && reviews.length > 0) {
    const planIds = (reviews as Array<{ plan_id: string }>).map((r) => r.plan_id);
    const { data: planRows } = await supabase
      .from('goal_plans').select('id').eq('season_id', id).in('id', planIds);
    blockingReviews = planRows?.length ?? 0;
  }
  if (blockingReviews > 0) {
    return {
      ok: false,
      error: `Cannot archive: ${blockingReviews} review${blockingReviews === 1 ? '' : 's'} not completed. Complete or delete draft reviews first.`,
    };
  }

  const { error } = await (supabase.from('seasons') as Any)
    .update({ archived_at: new Date().toISOString(), is_current: false }).eq('id', id);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/dashboard/seasons');
  revalidatePath('/dashboard');
  return { ok: true };
}

export async function deleteSeason(formData: FormData) {
  const supabase = createClient();
  const id = String(formData.get('id') ?? '').trim();
  if (!id) return { ok: false, error: 'Missing id' };

  // Block if season has any plans/activities/results
  const { data: planCount } = await supabase.from('goal_plans').select('id').eq('season_id', id).limit(1);
  const { data: actCount } = await supabase.from('activities').select('id').eq('season_id', id).limit(1);
  if ((planCount && planCount.length > 0) || (actCount && actCount.length > 0)) {
    return { ok: false, error: 'Cannot delete a season that has plans or activities. Archive it instead.' };
  }

  const { error } = await (supabase.from('seasons') as Any).delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/dashboard/seasons');
  return { ok: true };
}

export async function selectSeason(formData: FormData) {
  const id = String(formData.get('id') ?? '').trim();
  if (!id) return { ok: false, error: 'Missing id' };
  cookies().set('mesa_selected_season', id, {
    httpOnly: true, sameSite: 'lax', path: '/',
    maxAge: 60 * 60 * 24 * 365, // 1 year
  });
  revalidatePath('/', 'layout');
  return { ok: true };
}

// ============================================================================
// Season enrollments (admin + director)
// ============================================================================

export async function enrollStudentInSeason(formData: FormData) {
  const supabase = createClient();
  const season_id = String(formData.get('season_id') ?? '').trim();
  const student_id = String(formData.get('student_id') ?? '').trim();
  if (!season_id || !student_id) return { ok: false, error: 'Missing fields' };

  const { error } = await (supabase.from('season_enrollments') as Any)
    .insert({ season_id, student_id });

  if (error) return { ok: false, error: error.message };
  revalidatePath('/dashboard/students');
  revalidatePath('/dashboard/seasons');
  return { ok: true };
}

export async function departStudentFromSeason(formData: FormData) {
  const supabase = createClient();
  const id = String(formData.get('id') ?? '').trim();
  if (!id) return { ok: false, error: 'Missing id' };

  const { error } = await (supabase.from('season_enrollments') as Any)
    .update({ departed_on: new Date().toISOString().slice(0, 10) }).eq('id', id);

  if (error) return { ok: false, error: error.message };
  revalidatePath('/dashboard/students');
  return { ok: true };
}

// ============================================================================
// Goal plan composites (replaces individual test attachment)
// ============================================================================

export async function attachCompositeToPlan(formData: FormData) {
  const supabase = createClient();
  const plan_id = String(formData.get('plan_id') ?? '').trim();
  const composite_id = String(formData.get('composite_id') ?? '').trim();
  if (!plan_id || !composite_id) return { ok: false, error: 'Missing fields' };

  const { error } = await (supabase.from('goal_plan_composites') as Any)
    .insert({ plan_id, composite_id });

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/dashboard/goal-management/${plan_id}`);
  return { ok: true };
}

export async function detachCompositeFromPlan(formData: FormData) {
  const supabase = createClient();
  const id = String(formData.get('id') ?? '');
  const plan_id = String(formData.get('plan_id') ?? '');
  const { error } = await (supabase.from('goal_plan_composites') as Any).delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  if (plan_id) revalidatePath(`/dashboard/goal-management/${plan_id}`);
  return { ok: true };
}

// ============================================================================
// Practices (coach + director) — activities with activity_type='practice'
// ============================================================================

export async function createPractice(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/sign-in');

  const occurred_on = String(formData.get('occurred_on') ?? '').trim();
  const starts_at = String(formData.get('starts_at') ?? '').trim() || null;
  const duration_str = String(formData.get('duration_minutes') ?? '').trim();
  const duration_minutes = duration_str ? parseInt(duration_str, 10) : null;
  const title = String(formData.get('title') ?? '').trim() || null;
  const focus = String(formData.get('focus') ?? '').trim() || null;
  const notes = String(formData.get('notes') ?? '').trim() || null;
  const source_plan_id = String(formData.get('source_practice_plan_id') ?? '').trim() || null;
  const season_id = String(formData.get('season_id') ?? '').trim() || null;
  const student_ids_raw = String(formData.get('student_ids') ?? '').trim();

  if (!occurred_on) return { ok: false, error: 'Date is required.' };
  if (!season_id) return { ok: false, error: 'No active season. Create or activate one first.' };

  let studentIds: string[] = [];
  if (student_ids_raw) {
    try { studentIds = JSON.parse(student_ids_raw); } catch { /* ignore */ }
  }

  // Create the practice activity
  const { data: actRow, error: aErr } = await (supabase.from('activities') as Any)
    .insert({
      activity_type: 'practice',
      occurred_on, starts_at, duration_minutes,
      title, focus, notes,
      source_practice_plan_id: source_plan_id,
      season_id,
      logged_by: user.id,
    })
    .select('id').single();

  if (aErr || !actRow) return { ok: false, error: aErr?.message ?? 'Could not create practice.' };
  const activity_id = (actRow as { id: string }).id;

  // Copy items from plan template (if provided)
  if (source_plan_id) {
    const { data: templateItems } = await supabase
      .from('practice_plan_items').select('*').eq('plan_id', source_plan_id).order('sequence');
    if (templateItems && templateItems.length > 0) {
      // We don't have a practice_items table for activities — items live on the plan.
      // Intentional: the practice references source_practice_plan_id; UI pulls items from that plan.
      // If coach wants to modify items for THIS practice specifically, we'd need per-activity items.
      // Skipping ad-hoc item customization for now.
    }
  }

  // Add roster
  if (studentIds.length > 0) {
    const rows = studentIds.map((sid) => ({ activity_id, student_id: sid }));
    const { error: rErr } = await (supabase.from('activity_students') as Any).insert(rows);
    if (rErr) {
      // Non-fatal — activity is created, roster just failed
      return { ok: true, id: activity_id, warning: `Activity created but roster failed: ${rErr.message}` };
    }
  }

  revalidatePath('/dashboard/practices');
  return { ok: true, id: activity_id };
}

export async function updatePractice(formData: FormData) {
  const supabase = createClient();
  const id = String(formData.get('id') ?? '').trim();
  const occurred_on = String(formData.get('occurred_on') ?? '').trim();
  const starts_at = String(formData.get('starts_at') ?? '').trim() || null;
  const duration_str = String(formData.get('duration_minutes') ?? '').trim();
  const duration_minutes = duration_str ? parseInt(duration_str, 10) : null;
  const title = String(formData.get('title') ?? '').trim() || null;
  const focus = String(formData.get('focus') ?? '').trim() || null;
  const notes = String(formData.get('notes') ?? '').trim() || null;

  if (!id) return { ok: false, error: 'Missing id' };
  if (!occurred_on) return { ok: false, error: 'Date is required.' };

  const { error } = await (supabase.from('activities') as Any)
    .update({ occurred_on, starts_at, duration_minutes, title, focus, notes })
    .eq('id', id);

  if (error) return { ok: false, error: error.message };
  revalidatePath('/dashboard/practices');
  revalidatePath(`/dashboard/practices/${id}`);
  return { ok: true };
}

export async function deletePractice(formData: FormData) {
  const supabase = createClient();
  const id = String(formData.get('id') ?? '');
  const { error } = await (supabase.from('activities') as Any).delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/dashboard/practices');
  return { ok: true };
}

// Generic roster management (works for practices AND games)

export async function addStudentToActivity(formData: FormData) {
  const supabase = createClient();
  const activity_id = String(formData.get('activity_id') ?? '').trim();
  const student_id = String(formData.get('student_id') ?? '').trim();
  if (!activity_id || !student_id) return { ok: false, error: 'Missing fields' };

  const { error } = await (supabase.from('activity_students') as Any)
    .insert({ activity_id, student_id });

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/dashboard/practices/${activity_id}`);
  revalidatePath(`/dashboard/activities/${activity_id}`);
  return { ok: true };
}

export async function removeStudentFromActivity(formData: FormData) {
  const supabase = createClient();
  const id = String(formData.get('id') ?? '');
  const activity_id = String(formData.get('activity_id') ?? '');
  const { error } = await (supabase.from('activity_students') as Any).delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  if (activity_id) {
    revalidatePath(`/dashboard/practices/${activity_id}`);
    revalidatePath(`/dashboard/activities/${activity_id}`);
  }
  return { ok: true };
}

// Attendance

export async function setAttendance(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/sign-in');

  const activity_id = String(formData.get('activity_id') ?? '').trim();
  const student_id = String(formData.get('student_id') ?? '').trim();
  const attended_str = String(formData.get('attended') ?? '').trim();
  // 'true' | 'false' | '' (clear)
  const attended = attended_str === 'true' ? true : attended_str === 'false' ? false : null;

  if (!activity_id || !student_id) return { ok: false, error: 'Missing fields' };

  const { error } = await (supabase.from('attendance') as Any).upsert({
    activity_id, student_id, attended, recorded_by: user.id,
  }, { onConflict: 'activity_id,student_id' });

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/dashboard/practices/${activity_id}`);
  return { ok: true };
}

// ============================================================================
// Games (coach + director) — activities with activity_type='game'
// ============================================================================

export async function createGame(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/sign-in');

  const occurred_on = String(formData.get('occurred_on') ?? '').trim();
  const starts_at = String(formData.get('starts_at') ?? '').trim() || null;
  const opponent = String(formData.get('opponent') ?? '').trim() || null;
  const our_score_str = String(formData.get('our_score') ?? '').trim();
  const our_score = our_score_str ? parseInt(our_score_str, 10) : null;
  const opp_score_str = String(formData.get('opp_score') ?? '').trim();
  const opp_score = opp_score_str ? parseInt(opp_score_str, 10) : null;
  const home_away = String(formData.get('home_away') ?? '').trim() || null;
  const venue = String(formData.get('venue') ?? '').trim() || null;
  const notes = String(formData.get('notes') ?? '').trim() || null;
  const season_id = String(formData.get('season_id') ?? '').trim() || null;

  if (!occurred_on) return { ok: false, error: 'Date is required.' };
  if (!season_id) return { ok: false, error: 'No active season.' };

  const { data, error } = await (supabase.from('activities') as Any)
    .insert({
      activity_type: 'game',
      occurred_on, starts_at,
      opponent, our_score, opp_score, home_away, venue, notes,
      season_id, logged_by: user.id,
    })
    .select('id').single();

  if (error) return { ok: false, error: error.message };
  revalidatePath('/dashboard/activities');
  return { ok: true, id: (data as { id: string }).id };
}

export async function updateGame(formData: FormData) {
  const supabase = createClient();
  const id = String(formData.get('id') ?? '').trim();
  const occurred_on = String(formData.get('occurred_on') ?? '').trim();
  const opponent = String(formData.get('opponent') ?? '').trim() || null;
  const our_score_str = String(formData.get('our_score') ?? '').trim();
  const our_score = our_score_str ? parseInt(our_score_str, 10) : null;
  const opp_score_str = String(formData.get('opp_score') ?? '').trim();
  const opp_score = opp_score_str ? parseInt(opp_score_str, 10) : null;
  const home_away = String(formData.get('home_away') ?? '').trim() || null;
  const venue = String(formData.get('venue') ?? '').trim() || null;
  const notes = String(formData.get('notes') ?? '').trim() || null;

  if (!id || !occurred_on) return { ok: false, error: 'Missing fields' };

  const { error } = await (supabase.from('activities') as Any)
    .update({ occurred_on, opponent, our_score, opp_score, home_away, venue, notes })
    .eq('id', id);

  if (error) return { ok: false, error: error.message };
  revalidatePath('/dashboard/activities');
  revalidatePath(`/dashboard/activities/${id}`);
  return { ok: true };
}

export async function deleteGame(formData: FormData) {
  const supabase = createClient();
  const id = String(formData.get('id') ?? '');
  const { error } = await (supabase.from('activities') as Any).delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/dashboard/activities');
  return { ok: true };
}

// Game stats

export async function upsertGameStat(formData: FormData) {
  const supabase = createClient();
  const activity_id = String(formData.get('activity_id') ?? '').trim();
  const student_id = String(formData.get('student_id') ?? '').trim();
  if (!activity_id || !student_id) return { ok: false, error: 'Missing fields' };

  const intFromForm = (key: string) => {
    const v = String(formData.get(key) ?? '').trim();
    return v ? parseInt(v, 10) : 0;
  };
  const nullableIntFromForm = (key: string) => {
    const v = String(formData.get(key) ?? '').trim();
    return v ? parseInt(v, 10) : null;
  };

  const payload = {
    activity_id,
    student_id,
    goals: intFromForm('goals'),
    assists: intFromForm('assists'),
    plus_minus: intFromForm('plus_minus'),
    shots: intFromForm('shots'),
    penalty_mins: intFromForm('penalty_mins'),
    time_on_ice: String(formData.get('time_on_ice') ?? '').trim() || null,
    saves: nullableIntFromForm('saves'),
    shots_against: nullableIntFromForm('shots_against'),
    goals_against: nullableIntFromForm('goals_against'),
    notes: String(formData.get('notes') ?? '').trim() || null,
  };

  const { error } = await (supabase.from('game_stats') as Any).upsert(payload, {
    onConflict: 'activity_id,student_id',
  });

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/dashboard/activities/${activity_id}`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Phase 5a: CPT Session recording
// ---------------------------------------------------------------------------

export async function createCptSession(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/sign-in');

  const composite_id = String(formData.get('composite_id') ?? '').trim();
  const session_date = String(formData.get('session_date') ?? '').trim();
  const conditions_notes = String(formData.get('conditions_notes') ?? '').trim() || null;
  const is_baseline = formData.get('is_baseline') === 'on' || formData.get('is_baseline') === 'true';
  const season_id = String(formData.get('season_id') ?? '').trim() || null;

  if (!composite_id) return { ok: false, error: 'Composite test is required.' };
  if (!session_date) return { ok: false, error: 'Session date is required.' };
  if (!season_id) return { ok: false, error: 'No active season.' };

  // If marking this as baseline, first unset any existing baseline for this composite+season
  if (is_baseline) {
    await (supabase.from('cpt_sessions') as Any)
      .update({ is_baseline: false })
      .eq('composite_id', composite_id)
      .eq('season_id', season_id)
      .eq('is_baseline', true);
  }

  const { data, error } = await (supabase.from('cpt_sessions') as Any)
    .insert({
      composite_id,
      session_date,
      conditions_notes,
      is_baseline,
      season_id,
      administered_by: user.id,
    })
    .select('id').single();

  if (error) return { ok: false, error: error.message };
  revalidatePath('/dashboard/cpt-sessions');
  return { ok: true, id: (data as { id: string }).id };
}

export async function updateCptSession(formData: FormData) {
  const supabase = createClient();
  const id = String(formData.get('id') ?? '').trim();
  const session_date = String(formData.get('session_date') ?? '').trim();
  const conditions_notes = String(formData.get('conditions_notes') ?? '').trim() || null;

  if (!id || !session_date) return { ok: false, error: 'Missing fields' };

  const { error } = await (supabase.from('cpt_sessions') as Any)
    .update({ session_date, conditions_notes })
    .eq('id', id);

  if (error) return { ok: false, error: error.message };
  revalidatePath('/dashboard/cpt-sessions');
  revalidatePath(`/dashboard/cpt-sessions/${id}`);
  return { ok: true };
}

export async function deleteCptSession(formData: FormData) {
  const supabase = createClient();
  const id = String(formData.get('id') ?? '');
  // Delete the session — ON DELETE SET NULL on results means results remain but unlinked
  // For Phase 5a semantics, we also want to remove the results that were PART of this session
  // Policy: results are bound to the session. Delete them.
  await (supabase.from('performance_test_results') as Any)
    .delete().eq('cpt_session_id', id);
  const { error } = await (supabase.from('cpt_sessions') as Any).delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/dashboard/cpt-sessions');
  return { ok: true };
}

export async function toggleCptBaseline(formData: FormData) {
  const supabase = createClient();
  const id = String(formData.get('id') ?? '').trim();
  const next = formData.get('next') === 'true';

  if (!id) return { ok: false, error: 'Missing session id.' };

  // Get the session so we know its composite + season
  const { data: sess } = await supabase
    .from('cpt_sessions')
    .select('composite_id, season_id')
    .eq('id', id).single();
  if (!sess) return { ok: false, error: 'Session not found.' };
  const { composite_id, season_id } = sess as { composite_id: string; season_id: string | null };

  if (next && season_id) {
    // Clear any existing baseline in the same (composite, season)
    await (supabase.from('cpt_sessions') as Any)
      .update({ is_baseline: false })
      .eq('composite_id', composite_id)
      .eq('season_id', season_id)
      .eq('is_baseline', true)
      .neq('id', id);
  }

  const { error } = await (supabase.from('cpt_sessions') as Any)
    .update({ is_baseline: next })
    .eq('id', id);

  if (error) return { ok: false, error: error.message };
  revalidatePath('/dashboard/cpt-sessions');
  revalidatePath(`/dashboard/cpt-sessions/${id}`);
  return { ok: true };
}

export async function upsertCptResult(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/sign-in');

  const cpt_session_id = String(formData.get('cpt_session_id') ?? '').trim();
  const student_id = String(formData.get('student_id') ?? '').trim();
  const test_id = String(formData.get('test_id') ?? '').trim();
  const value_str = String(formData.get('value') ?? '').trim();
  const season_id = String(formData.get('season_id') ?? '').trim() || null;
  const is_baseline = formData.get('is_baseline') === 'true';
  const recorded_at = String(formData.get('session_date') ?? '').trim();

  if (!cpt_session_id || !student_id || !test_id) {
    return { ok: false, error: 'Missing fields' };
  }

  // Empty value -> delete any existing result for this cell
  if (value_str === '') {
    const { error: delErr } = await (supabase.from('performance_test_results') as Any)
      .delete()
      .eq('cpt_session_id', cpt_session_id)
      .eq('student_id', student_id)
      .eq('test_id', test_id);
    if (delErr) return { ok: false, error: delErr.message };
    revalidatePath(`/dashboard/cpt-sessions/${cpt_session_id}`);
    return { ok: true };
  }

  const value = parseFloat(value_str);
  if (Number.isNaN(value)) return { ok: false, error: 'Value must be a number.' };

  // Check if a row exists for this cell
  const { data: existing } = await supabase
    .from('performance_test_results').select('id')
    .eq('cpt_session_id', cpt_session_id)
    .eq('student_id', student_id)
    .eq('test_id', test_id).maybeSingle();

  const payload = {
    student_id,
    test_id,
    value,
    cpt_session_id,
    is_baseline,
    season_id,
    recorded_at: recorded_at ? `${recorded_at}T00:00:00` : new Date().toISOString(),
    recorded_by: user.id,
  };

  if (existing) {
    const { error } = await (supabase.from('performance_test_results') as Any)
      .update({ value, is_baseline, season_id })
      .eq('id', (existing as { id: string }).id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await (supabase.from('performance_test_results') as Any).insert(payload);
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath(`/dashboard/cpt-sessions/${cpt_session_id}`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Phase 5b: Workout plans + scheduled workouts + per-set logging
// ---------------------------------------------------------------------------

// -- Workout plans ----------------------------------------------------------

export async function createWorkoutPlan(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/sign-in');

  const title = String(formData.get('title') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim() || null;
  const focus = String(formData.get('focus') ?? '').trim() || null;
  const duration_str = String(formData.get('duration_minutes') ?? '').trim();
  const duration_minutes = duration_str ? parseInt(duration_str, 10) : null;

  if (!title) return { ok: false, error: 'Title is required.' };

  const { data, error } = await (supabase.from('workout_plans') as Any)
    .insert({ title, description, focus, duration_minutes, is_template: true, created_by: user.id })
    .select('id').single();

  if (error) return { ok: false, error: error.message };
  revalidatePath('/dashboard/workout-plans');
  return { ok: true, id: (data as { id: string }).id };
}

export async function updateWorkoutPlan(formData: FormData) {
  const supabase = createClient();
  const id = String(formData.get('id') ?? '').trim();
  const title = String(formData.get('title') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim() || null;
  const focus = String(formData.get('focus') ?? '').trim() || null;
  const duration_str = String(formData.get('duration_minutes') ?? '').trim();
  const duration_minutes = duration_str ? parseInt(duration_str, 10) : null;

  if (!id || !title) return { ok: false, error: 'Missing fields' };

  const { error } = await (supabase.from('workout_plans') as Any)
    .update({ title, description, focus, duration_minutes })
    .eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/dashboard/workout-plans');
  revalidatePath(`/dashboard/workout-plans/${id}`);
  return { ok: true };
}

export async function deleteWorkoutPlan(formData: FormData) {
  const supabase = createClient();
  const id = String(formData.get('id') ?? '');
  const { error } = await (supabase.from('workout_plans') as Any).delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/dashboard/workout-plans');
  return { ok: true };
}

// -- Workout plan items -----------------------------------------------------

export async function addWorkoutPlanItem(formData: FormData) {
  const supabase = createClient();
  const plan_id = String(formData.get('plan_id') ?? '').trim();
  const exercise_id = String(formData.get('exercise_id') ?? '').trim();
  if (!plan_id || !exercise_id) return { ok: false, error: 'Missing fields' };

  const nInt = (k: string) => {
    const v = String(formData.get(k) ?? '').trim();
    return v ? parseInt(v, 10) : null;
  };
  const nNum = (k: string) => {
    const v = String(formData.get(k) ?? '').trim();
    return v ? parseFloat(v) : null;
  };

  // Find the next sequence
  const { data: existing } = await supabase
    .from('workout_plan_items').select('sequence')
    .eq('plan_id', plan_id).order('sequence', { ascending: false }).limit(1);
  const rows = (existing ?? []) as Array<{ sequence: number }>;
  const sequence = rows.length > 0 ? rows[0].sequence + 1 : 0;

  const { error } = await (supabase.from('workout_plan_items') as Any).insert({
    plan_id, exercise_id, sequence,
    default_sets: nInt('default_sets'),
    default_reps: nInt('default_reps'),
    default_weight_lbs: nNum('default_weight_lbs'),
    default_duration_seconds: nInt('default_duration_seconds'),
    default_rest_seconds: nInt('default_rest_seconds'),
    coach_notes: String(formData.get('coach_notes') ?? '').trim() || null,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/dashboard/workout-plans/${plan_id}`);
  return { ok: true };
}

export async function updateWorkoutPlanItem(formData: FormData) {
  const supabase = createClient();
  const id = String(formData.get('id') ?? '').trim();
  const plan_id = String(formData.get('plan_id') ?? '').trim();
  if (!id) return { ok: false, error: 'Missing id' };

  const nInt = (k: string) => {
    const v = String(formData.get(k) ?? '').trim();
    return v ? parseInt(v, 10) : null;
  };
  const nNum = (k: string) => {
    const v = String(formData.get(k) ?? '').trim();
    return v ? parseFloat(v) : null;
  };

  const { error } = await (supabase.from('workout_plan_items') as Any).update({
    default_sets: nInt('default_sets'),
    default_reps: nInt('default_reps'),
    default_weight_lbs: nNum('default_weight_lbs'),
    default_duration_seconds: nInt('default_duration_seconds'),
    default_rest_seconds: nInt('default_rest_seconds'),
    coach_notes: String(formData.get('coach_notes') ?? '').trim() || null,
  }).eq('id', id);
  if (error) return { ok: false, error: error.message };
  if (plan_id) revalidatePath(`/dashboard/workout-plans/${plan_id}`);
  return { ok: true };
}

export async function deleteWorkoutPlanItem(formData: FormData) {
  const supabase = createClient();
  const id = String(formData.get('id') ?? '').trim();
  const plan_id = String(formData.get('plan_id') ?? '').trim();
  if (!id) return { ok: false, error: 'Missing id' };

  const { error } = await (supabase.from('workout_plan_items') as Any).delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  if (plan_id) revalidatePath(`/dashboard/workout-plans/${plan_id}`);
  return { ok: true };
}

export async function reorderWorkoutPlanItems(formData: FormData) {
  const supabase = createClient();
  const plan_id = String(formData.get('plan_id') ?? '').trim();
  const ordered_ids_raw = String(formData.get('ordered_ids') ?? '').trim();
  if (!plan_id || !ordered_ids_raw) return { ok: false, error: 'Missing fields' };

  let orderedIds: string[] = [];
  try { orderedIds = JSON.parse(ordered_ids_raw); } catch { /* ignore */ }
  if (orderedIds.length === 0) return { ok: false, error: 'No items to reorder' };

  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await (supabase.from('workout_plan_items') as Any)
      .update({ sequence: i }).eq('id', orderedIds[i]);
    if (error) return { ok: false, error: error.message };
  }
  revalidatePath(`/dashboard/workout-plans/${plan_id}`);
  return { ok: true };
}

// -- Scheduled workouts (activity_type = 'off_ice_workout') ----------------

export async function createWorkout(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/sign-in');

  const occurred_on = String(formData.get('occurred_on') ?? '').trim();
  const starts_at = String(formData.get('starts_at') ?? '').trim() || null;
  const duration_str = String(formData.get('duration_minutes') ?? '').trim();
  const duration_minutes = duration_str ? parseInt(duration_str, 10) : null;
  const title = String(formData.get('title') ?? '').trim() || null;
  const focus = String(formData.get('focus') ?? '').trim() || null;
  const notes = String(formData.get('notes') ?? '').trim() || null;
  const off_ice_category = String(formData.get('off_ice_category') ?? '').trim() || null;
  const custom_category_name = String(formData.get('custom_category_name') ?? '').trim() || null;
  const source_workout_plan_id = String(formData.get('source_workout_plan_id') ?? '').trim() || null;
  const season_id = String(formData.get('season_id') ?? '').trim() || null;
  const student_ids_raw = String(formData.get('student_ids') ?? '').trim();

  if (!occurred_on) return { ok: false, error: 'Date is required.' };
  if (!season_id) return { ok: false, error: 'No active season. Create or activate one first.' };

  let studentIds: string[] = [];
  if (student_ids_raw) {
    try { studentIds = JSON.parse(student_ids_raw); } catch { /* ignore */ }
  }

  // Create the workout activity
  const { data: actRow, error: aErr } = await (supabase.from('activities') as Any)
    .insert({
      activity_type: 'off_ice_workout',
      occurred_on, starts_at, duration_minutes,
      title, focus, notes,
      off_ice_category, custom_category_name,
      source_workout_plan_id,
      season_id, logged_by: user.id,
    })
    .select('id').single();

  if (aErr || !actRow) return { ok: false, error: aErr?.message ?? 'Could not create workout.' };
  const activity_id = (actRow as { id: string }).id;

  // Copy roster
  if (studentIds.length > 0) {
    const rosterRows = studentIds.map((sid) => ({ activity_id, student_id: sid }));
    await (supabase.from('activity_students') as Any).insert(rosterRows);
  }

  // If a plan is attached, copy the plan items into workout_exercises
  if (source_workout_plan_id) {
    const { data: planItems } = await supabase
      .from('workout_plan_items')
      .select('exercise_id, sequence, default_sets, coach_notes')
      .eq('plan_id', source_workout_plan_id)
      .order('sequence');
    const items = (planItems ?? []) as Array<{
      exercise_id: string; sequence: number;
      default_sets: number | null; coach_notes: string | null;
    }>;
    if (items.length > 0) {
      const exerciseRows = items.map((it) => ({
        activity_id,
        exercise_id: it.exercise_id,
        sequence: it.sequence,
        sets: it.default_sets,
        coach_notes: it.coach_notes,
      }));
      await (supabase.from('workout_exercises') as Any).insert(exerciseRows);
    }
  }

  revalidatePath('/dashboard/workouts');
  return { ok: true, id: activity_id };
}

export async function updateWorkout(formData: FormData) {
  const supabase = createClient();
  const id = String(formData.get('id') ?? '').trim();
  const occurred_on = String(formData.get('occurred_on') ?? '').trim();
  const starts_at = String(formData.get('starts_at') ?? '').trim() || null;
  const duration_str = String(formData.get('duration_minutes') ?? '').trim();
  const duration_minutes = duration_str ? parseInt(duration_str, 10) : null;
  const title = String(formData.get('title') ?? '').trim() || null;
  const focus = String(formData.get('focus') ?? '').trim() || null;
  const notes = String(formData.get('notes') ?? '').trim() || null;
  const off_ice_category = String(formData.get('off_ice_category') ?? '').trim() || null;
  const custom_category_name = String(formData.get('custom_category_name') ?? '').trim() || null;

  if (!id || !occurred_on) return { ok: false, error: 'Missing fields' };

  const { error } = await (supabase.from('activities') as Any)
    .update({ occurred_on, starts_at, duration_minutes, title, focus, notes, off_ice_category, custom_category_name })
    .eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/dashboard/workouts');
  revalidatePath(`/dashboard/workouts/${id}`);
  return { ok: true };
}

export async function deleteWorkout(formData: FormData) {
  const supabase = createClient();
  const id = String(formData.get('id') ?? '');
  const { error } = await (supabase.from('activities') as Any).delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/dashboard/workouts');
  return { ok: true };
}

// -- Workout exercises (the list of exercises within a scheduled workout) --

export async function addWorkoutExercise(formData: FormData) {
  const supabase = createClient();
  const activity_id = String(formData.get('activity_id') ?? '').trim();
  const exercise_id = String(formData.get('exercise_id') ?? '').trim();
  if (!activity_id || !exercise_id) return { ok: false, error: 'Missing fields' };

  const nInt = (k: string) => {
    const v = String(formData.get(k) ?? '').trim();
    return v ? parseInt(v, 10) : null;
  };

  const { data: existing } = await supabase
    .from('workout_exercises').select('sequence')
    .eq('activity_id', activity_id).order('sequence', { ascending: false }).limit(1);
  const rows = (existing ?? []) as Array<{ sequence: number }>;
  const sequence = rows.length > 0 ? rows[0].sequence + 1 : 0;

  const { error } = await (supabase.from('workout_exercises') as Any).insert({
    activity_id, exercise_id, sequence,
    sets: nInt('sets'),
    coach_notes: String(formData.get('coach_notes') ?? '').trim() || null,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/dashboard/workouts/${activity_id}`);
  return { ok: true };
}

export async function updateWorkoutExercise(formData: FormData) {
  const supabase = createClient();
  const id = String(formData.get('id') ?? '').trim();
  const activity_id = String(formData.get('activity_id') ?? '').trim();
  if (!id) return { ok: false, error: 'Missing id' };

  const nInt = (k: string) => {
    const v = String(formData.get(k) ?? '').trim();
    return v ? parseInt(v, 10) : null;
  };

  const { error } = await (supabase.from('workout_exercises') as Any).update({
    sets: nInt('sets'),
    coach_notes: String(formData.get('coach_notes') ?? '').trim() || null,
  }).eq('id', id);
  if (error) return { ok: false, error: error.message };
  if (activity_id) revalidatePath(`/dashboard/workouts/${activity_id}`);
  return { ok: true };
}

export async function deleteWorkoutExercise(formData: FormData) {
  const supabase = createClient();
  const id = String(formData.get('id') ?? '').trim();
  const activity_id = String(formData.get('activity_id') ?? '').trim();
  if (!id) return { ok: false, error: 'Missing id' };

  const { error } = await (supabase.from('workout_exercises') as Any).delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  if (activity_id) revalidatePath(`/dashboard/workouts/${activity_id}`);
  return { ok: true };
}

// -- Per-set logging (the hero of Phase 5b) --------------------------------

export async function upsertWorkoutSet(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/sign-in');

  const workout_exercise_id = String(formData.get('workout_exercise_id') ?? '').trim();
  const student_id = String(formData.get('student_id') ?? '').trim();
  const set_number_str = String(formData.get('set_number') ?? '').trim();
  const activity_id = String(formData.get('activity_id') ?? '').trim();

  if (!workout_exercise_id || !student_id || !set_number_str) {
    return { ok: false, error: 'Missing fields' };
  }
  const set_number = parseInt(set_number_str, 10);
  if (Number.isNaN(set_number)) return { ok: false, error: 'Invalid set number' };

  const nNum = (k: string) => {
    const v = String(formData.get(k) ?? '').trim();
    return v === '' ? null : parseFloat(v);
  };
  const nInt = (k: string) => {
    const v = String(formData.get(k) ?? '').trim();
    return v === '' ? null : parseInt(v, 10);
  };

  const weight = nNum('weight');
  const reps = nInt('reps');
  const rpe = nInt('rpe');
  const notes = String(formData.get('notes') ?? '').trim() || null;

  // Check if a row already exists for this (workout_exercise_id, student_id, set_number)
  const { data: existing } = await supabase
    .from('workout_exercise_sets').select('id')
    .eq('workout_exercise_id', workout_exercise_id)
    .eq('student_id', student_id)
    .eq('set_number', set_number)
    .maybeSingle();

  // Delete-on-empty: if ALL logged fields are blank, delete the row
  const allBlank = weight === null && reps === null && rpe === null && !notes;

  if (allBlank) {
    if (existing) {
      const { error } = await (supabase.from('workout_exercise_sets') as Any)
        .delete().eq('id', (existing as { id: string }).id);
      if (error) return { ok: false, error: error.message };
    }
    if (activity_id) revalidatePath(`/dashboard/workouts/${activity_id}`);
    return { ok: true };
  }

  if (existing) {
    const { error } = await (supabase.from('workout_exercise_sets') as Any)
      .update({ weight, reps, rpe, notes })
      .eq('id', (existing as { id: string }).id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await (supabase.from('workout_exercise_sets') as Any).insert({
      workout_exercise_id, student_id, set_number,
      weight, reps, rpe, notes,
    });
    if (error) return { ok: false, error: error.message };
  }

  if (activity_id) revalidatePath(`/dashboard/workouts/${activity_id}`);
  return { ok: true };
}

export async function deleteWorkoutSet(formData: FormData) {
  const supabase = createClient();
  const id = String(formData.get('id') ?? '').trim();
  const activity_id = String(formData.get('activity_id') ?? '').trim();
  if (!id) return { ok: false, error: 'Missing id' };
  const { error } = await (supabase.from('workout_exercise_sets') as Any).delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  if (activity_id) revalidatePath(`/dashboard/workouts/${activity_id}`);
  return { ok: true };
}
