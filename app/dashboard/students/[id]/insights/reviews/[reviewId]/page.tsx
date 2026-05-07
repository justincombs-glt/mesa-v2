import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/PageHeader';
import { ReviewDetailClient } from './ReviewDetailClient';
import type { Review, ReviewGoalRating, Student, GoalPlanGoal, GoalPlan, Profile } from '@/lib/supabase/types';
import type { StudentInsights } from '@/lib/student-insights';

export const dynamic = 'force-dynamic';

export interface ResolvedRating extends ReviewGoalRating {
  goal_title: string;
  plan_title: string | null;
}

export default async function ReviewDetailPage({
  params,
}: { params: { id: string; reviewId: string } }) {
  await requireRole('admin', 'director', 'coach', 'trainer');
  const supabase = createClient();

  const { data: reviewRow } = await supabase
    .from('reviews').select('*').eq('id', params.reviewId).single();
  if (!reviewRow) notFound();
  const review = reviewRow as Review;

  // Sanity: this review must belong to this student
  if (review.student_id !== params.id) notFound();

  // Student
  const { data: studentRow } = await supabase
    .from('students').select('*').eq('id', params.id).single();
  if (!studentRow) notFound();
  const student = studentRow as unknown as Student;

  // Plan title (if attached)
  let plan: GoalPlan | null = null;
  if (review.plan_id) {
    const { data: planRow } = await supabase
      .from('goal_plans').select('*').eq('id', review.plan_id).maybeSingle();
    plan = planRow ? (planRow as unknown as GoalPlan) : null;
  }

  // Reviewer name
  let reviewerName: string | null = null;
  if (review.reviewer_id) {
    const { data: rRow } = await supabase
      .from('profiles').select('full_name, email').eq('id', review.reviewer_id).maybeSingle();
    if (rRow) {
      const r = rRow as Pick<Profile, 'full_name' | 'email'>;
      reviewerName = r.full_name ?? r.email;
    }
  }

  // Ratings + goals
  const { data: ratingRows } = await supabase
    .from('review_goal_ratings').select('*').eq('review_id', review.id);
  const ratings = (ratingRows ?? []) as ReviewGoalRating[];

  const goalIds = ratings.map((r) => r.goal_id);
  let goalsById = new Map<string, GoalPlanGoal>();
  if (goalIds.length > 0) {
    const { data: goalRows } = await supabase
      .from('goal_plan_goals').select('*').in('id', goalIds);
    ((goalRows ?? []) as GoalPlanGoal[]).forEach((g) => goalsById.set(g.id, g));
  }

  // Plan titles for ratings (needed when ratings span multiple plans)
  const planIds = Array.from(new Set(
    Array.from(goalsById.values()).map((g) => g.plan_id)
  ));
  const planTitleById = new Map<string, string>();
  if (planIds.length > 0) {
    const { data: planRows } = await supabase
      .from('goal_plans').select('id, title').in('id', planIds);
    ((planRows ?? []) as Array<{ id: string; title: string }>).forEach((p) => {
      planTitleById.set(p.id, p.title);
    });
  }

  const resolvedRatings: ResolvedRating[] = ratings.map((r) => {
    const goal = goalsById.get(r.goal_id);
    return {
      ...r,
      goal_title: goal?.title ?? '(Goal removed)',
      plan_title: goal ? (planTitleById.get(goal.plan_id) ?? null) : null,
    };
  });

  // Sort by plan title then goal title
  resolvedRatings.sort((a, b) => {
    const pa = a.plan_title ?? '';
    const pb = b.plan_title ?? '';
    if (pa !== pb) return pa.localeCompare(pb);
    return a.goal_title.localeCompare(b.goal_title);
  });

  // The frozen snapshot
  const snapshot = review.snapshot_data as StudentInsights | null;

  return (
    <>
      <PageHeader
        kicker={
          <>
            <Link href="/dashboard/students" className="hover:text-ink">Students</Link>
            <span className="mx-2">·</span>
            <Link href={`/dashboard/students/${params.id}/insights`} className="hover:text-ink">{student.full_name}</Link>
            <span className="mx-2">·</span>
            Review
          </>
        }
        title={
          <>
            <em className="italic">{student.full_name}</em>
            <span className="ml-3 text-base font-normal text-ink-faint">
              — {formatDate(review.completed_at ?? review.created_at)}
            </span>
          </>
        }
        description={
          plan
            ? `Snapshot review attached to plan: ${plan.title}.`
            : 'Snapshot review.'
        }
      />
      <ReviewDetailClient
        review={review}
        ratings={resolvedRatings}
        snapshot={snapshot}
        reviewerName={reviewerName}
        studentId={params.id}
      />
    </>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}
