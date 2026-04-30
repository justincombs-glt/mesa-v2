import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/PageHeader';
import { StudentAdminClient } from './StudentAdminClient';
import type { Student, Profile, FamilyLink } from '@/lib/supabase/types';

export const dynamic = 'force-dynamic';

export interface LinkedParent {
  link_id: string;
  relationship: string | null;
  is_primary: boolean;
  profile: Pick<Profile, 'id' | 'full_name' | 'email' | 'phone'>;
}

export default async function StudentAdminPage({ params }: { params: { id: string } }) {
  await requireRole('admin', 'director');
  const supabase = createClient();

  const { data: studentRow } = await supabase.from('students').select('*').eq('id', params.id).single();
  if (!studentRow) notFound();
  const student = studentRow as Student;

  // Linked parents
  const { data: linkRows } = await supabase
    .from('family_links').select('id, relationship, is_primary, parent_id').eq('student_id', student.id);
  const links = (linkRows ?? []) as Array<Pick<FamilyLink, 'id' | 'relationship' | 'is_primary'> & { parent_id: string }>;

  let linkedParents: LinkedParent[] = [];
  if (links.length > 0) {
    const { data: parentRows } = await supabase
      .from('profiles').select('id, full_name, email, phone')
      .in('id', links.map((l) => l.parent_id));
    const parents = (parentRows ?? []) as Pick<Profile, 'id' | 'full_name' | 'email' | 'phone'>[];
    linkedParents = links.map((l) => ({
      link_id: l.id,
      relationship: l.relationship,
      is_primary: l.is_primary,
      profile: parents.find((p) => p.id === l.parent_id) ?? {
        id: l.parent_id, full_name: '(unknown)', email: '', phone: null,
      },
    }));
  }

  // Linked student profile (if any)
  let linkedStudentProfile: Pick<Profile, 'id' | 'full_name' | 'email'> | null = null;
  if (student.profile_id) {
    const { data } = await supabase
      .from('profiles').select('id, full_name, email').eq('id', student.profile_id).single();
    linkedStudentProfile = data
      ? (data as unknown as Pick<Profile, 'id' | 'full_name' | 'email'>)
      : null;
  }

  return (
    <>
      <PageHeader
        kicker={
          <>
            <Link href="/dashboard/students" className="hover:text-ink">Students</Link>
            <span className="mx-2">·</span>
            Manage
          </>
        }
        title={
          <>
            {student.jersey_number && <span className="text-crimson mr-2">#{student.jersey_number}</span>}
            <em className="italic">{student.full_name}</em>
          </>
        }
        description="Edit student details, manage parent links, and link a student account."
        actions={
          <Link href={`/dashboard/students/${student.id}/insights`}
            className="btn-secondary !h-10 !px-4 text-[13px]">
            View insights →
          </Link>
        }
      />

      <StudentAdminClient
        student={student}
        linkedParents={linkedParents}
        linkedStudentProfile={linkedStudentProfile}
      />
    </>
  );
}
