import { requireRole } from '@/lib/auth';
import { PageHeader } from '@/components/ui/PageHeader';
import { getLinkedStudentForProfile } from '@/lib/student-dashboard';
import { buildNutritionData } from '@/lib/nutrition';
import { NutritionTracker } from '@/components/nutrition/NutritionTracker';

export const dynamic = 'force-dynamic';

export default async function NutritionPage() {
  const profile = await requireRole('student');

  const student = await getLinkedStudentForProfile(profile.id);
  if (!student) {
    return (
      <>
        <PageHeader
          kicker="Student"
          title={<>My <em className="italic text-crimson">nutrition</em>.</>}
          description="Calorie tracking is paused until your account is linked to a student record."
        />
        <div className="card-base p-8 text-center">
          <p className="text-sm text-ink-dim max-w-md mx-auto">
            Your account isn&apos;t linked to a student record yet. Ask the academy office to link you.
          </p>
        </div>
      </>
    );
  }

  const data = await buildNutritionData(student.id);

  // Q3 = B: students 16+ can self-set their daily goal; younger ones see a
  // "ask a parent" message instead. Age computed from date_of_birth; if
  // missing, default to NOT allowing self-set (safe default).
  let allowGoalSelfSet = false;
  if (student.date_of_birth) {
    const dob = new Date(student.date_of_birth);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age -= 1;
    }
    allowGoalSelfSet = age >= 16;
  }

  return (
    <>
      <PageHeader
        kicker="Student"
        title={<>My <em className="italic text-crimson">nutrition</em>.</>}
        description="Track what you eat and stay fueled for training."
      />
      <NutritionTracker
        studentId={student.id}
        studentName={student.full_name}
        data={data}
        viewerRole="student"
        allowGoalSelfSet={allowGoalSelfSet}
      />
    </>
  );
}
