import { createClient } from '@/lib/supabase/server';
import type {
  CoachsCornerVideo, CoachsCornerView,
} from '@/lib/supabase/types';

export interface CoachsCornerDay {
  date: string;                       // YYYY-MM-DD (for_date)
  videos: CoachsCornerVideo[];        // sorted by created_at desc within the day
}

export interface CoachsCornerListData {
  days: CoachsCornerDay[];            // sorted by date desc (most recent first)
  /** Set of video IDs the calling student has marked watched. Empty for non-students. */
  myWatchedIds: Set<string>;
  /** Count of videos created since the user last visited (for sidebar badge). */
  newSinceLastSeen: number;
  /** Names of posters keyed by profile_id, for "Posted by Coach X" attribution. */
  posterNames: Map<string, string>;
}

/**
 * Load all Coach's Corner videos for the list view. Groups by for_date,
 * sorts newest-first. Also computes per-caller state: which videos the
 * calling student has marked watched, and how many new videos exist since
 * the user last visited.
 *
 * RLS handles access control — every signed-in user can read videos, so this
 * loader simply fetches everything and lets the caller scope further if
 * needed.
 */
export async function buildCoachsCornerListData({
  profileId, profileRole, lastSeenAt,
}: {
  profileId: string;
  profileRole: string;
  lastSeenAt: string | null;
}): Promise<CoachsCornerListData> {
  const supabase = createClient();

  const { data: videoRows } = await supabase
    .from('coachs_corner_videos')
    .select('*')
    .order('for_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(500);
  const videos = (videoRows ?? []) as CoachsCornerVideo[];

  // Group by for_date (preserves order since input is already sorted)
  const byDate = new Map<string, CoachsCornerVideo[]>();
  for (const v of videos) {
    if (!byDate.has(v.for_date)) byDate.set(v.for_date, []);
    byDate.get(v.for_date)!.push(v);
  }
  const days: CoachsCornerDay[] = Array.from(byDate.entries()).map(([date, dayVideos]) => ({
    date, videos: dayVideos,
  }));

  // Watched IDs — only relevant for students. Parents see nothing per Q7 = A.
  let myWatchedIds = new Set<string>();
  if (profileRole === 'student' && videos.length > 0) {
    const { data: selfRow } = await supabase
      .from('students').select('id').eq('profile_id', profileId).maybeSingle();
    const selfStudentId = (selfRow as { id: string } | null)?.id;
    if (selfStudentId) {
      const videoIds = videos.map((v) => v.id);
      const { data: viewRows } = await supabase
        .from('coachs_corner_views')
        .select('video_id')
        .eq('student_id', selfStudentId)
        .in('video_id', videoIds);
      myWatchedIds = new Set(((viewRows ?? []) as Array<{ video_id: string }>).map((r) => r.video_id));
    }
  }

  // New since last seen — count of videos.created_at > lastSeenAt
  let newSinceLastSeen = 0;
  if (lastSeenAt) {
    newSinceLastSeen = videos.filter((v) => v.created_at > lastSeenAt).length;
  } else {
    // Never visited — every video is "new" but cap display in the UI side
    newSinceLastSeen = videos.length;
  }

  // Poster names for attribution
  const posterIds = Array.from(new Set(videos.map((v) => v.posted_by).filter((x): x is string => !!x)));
  const posterNames = new Map<string, string>();
  if (posterIds.length > 0) {
    const { data: posterRows } = await supabase
      .from('profiles').select('id, full_name').in('id', posterIds);
    for (const p of (posterRows ?? []) as Array<{ id: string; full_name: string | null }>) {
      posterNames.set(p.id, p.full_name ?? 'Coach');
    }
  }

  return { days, myWatchedIds, newSinceLastSeen, posterNames };
}

/**
 * For the detail page — coach/director view of "who watched" for a single
 * video. Returns the list of students with their watch state. Empty when
 * the caller is a student or parent (they don't get this view).
 */
export interface VideoWatchersData {
  watched: Array<{ student_id: string; full_name: string; watched_at: string }>;
  notWatched: Array<{ student_id: string; full_name: string }>;
  total: number;
}

export async function buildVideoWatchersData(videoId: string): Promise<VideoWatchersData> {
  const supabase = createClient();

  // All active students
  const { data: studentRows } = await supabase
    .from('students')
    .select('id, full_name')
    .eq('active', true)
    .order('full_name');
  const students = (studentRows ?? []) as Array<{ id: string; full_name: string }>;

  // Watch records for this video
  const { data: viewRows } = await supabase
    .from('coachs_corner_views')
    .select('student_id, watched_at')
    .eq('video_id', videoId);
  const views = (viewRows ?? []) as CoachsCornerView[];
  const watchedMap = new Map(views.map((v) => [v.student_id, v.watched_at]));

  const watched: VideoWatchersData['watched'] = [];
  const notWatched: VideoWatchersData['notWatched'] = [];
  for (const s of students) {
    const wAt = watchedMap.get(s.id);
    if (wAt) watched.push({ student_id: s.id, full_name: s.full_name, watched_at: wAt });
    else notWatched.push({ student_id: s.id, full_name: s.full_name });
  }

  // Sort watched by most-recent-first
  watched.sort((a, b) => b.watched_at.localeCompare(a.watched_at));

  return { watched, notWatched, total: students.length };
}
