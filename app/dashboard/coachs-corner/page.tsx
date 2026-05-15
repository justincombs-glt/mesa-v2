import { requireProfile } from '@/lib/auth';
import { PageHeader } from '@/components/ui/PageHeader';
import { buildCoachsCornerListData } from '@/lib/coachs-corner';
import { touchCoachsCornerLastSeen } from '@/app/actions';
import { CoachsCornerListClient } from './CoachsCornerListClient';

export const dynamic = 'force-dynamic';

export default async function CoachsCornerPage() {
  const profile = await requireProfile();

  // Snapshot the OLD "last seen" value BEFORE bumping it, so the "new since
  // last seen" computation in the loader uses the correct cutoff.
  const oldLastSeen = profile.last_seen_coachs_corner_at ?? null;

  // Fire-and-forget the timestamp bump. Failure shouldn't block render —
  // worst case the badge stays stale until next visit.
  try { await touchCoachsCornerLastSeen(); } catch { /* swallow */ }

  const data = await buildCoachsCornerListData({
    profileId: profile.id,
    profileRole: profile.role,
    lastSeenAt: oldLastSeen,
  });

  const canPost = profile.role === 'admin' || profile.role === 'director' || profile.role === 'coach';
  const isStudent = profile.role === 'student';

  return (
    <>
      <PageHeader
        kicker={canPost ? 'Coach\u2019s Corner \u00b7 Editor' : 'Coach\u2019s Corner'}
        title={<>Coach&rsquo;s <em className="italic text-crimson">Corner</em>.</>}
        description={
          canPost
            ? 'Post videos for athletes and parents to watch. Organize by date \u2014 anything older than today is still visible.'
            : 'Videos posted by your coaches. Tap any to watch.'
        }
      />
      <CoachsCornerListClient
        days={data.days.map((d) => ({
          date: d.date,
          videos: d.videos.map((v) => ({
            ...v,
            posterName: v.posted_by ? data.posterNames.get(v.posted_by) ?? null : null,
            watched: data.myWatchedIds.has(v.id),
          })),
        }))}
        canPost={canPost}
        isStudent={isStudent}
      />
    </>
  );
}
