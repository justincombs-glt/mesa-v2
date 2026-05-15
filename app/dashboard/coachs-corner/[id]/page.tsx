import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/PageHeader';
import { buildVideoWatchersData } from '@/lib/coachs-corner';
import { buildEmbedUrl, providerLabel } from '@/lib/video-url';
import { VideoPlayerWithWatch } from './VideoPlayerWithWatch';
import type { CoachsCornerVideo } from '@/lib/supabase/types';

export const dynamic = 'force-dynamic';

export default async function CoachsCornerVideoPage({ params }: { params: { id: string } }) {
  const profile = await requireProfile();
  const supabase = createClient();

  const { data: vRow } = await supabase
    .from('coachs_corner_videos').select('*').eq('id', params.id).single();
  if (!vRow) notFound();
  const video = vRow as unknown as CoachsCornerVideo;

  // Poster attribution
  let posterName: string | null = null;
  if (video.posted_by) {
    const { data: posterRow } = await supabase
      .from('profiles').select('full_name').eq('id', video.posted_by).maybeSingle();
    posterName = (posterRow as { full_name: string | null } | null)?.full_name ?? null;
  }

  // For students: determine current watched state
  let watched = false;
  if (profile.role === 'student') {
    const { data: selfRow } = await supabase
      .from('students').select('id').eq('profile_id', profile.id).maybeSingle();
    const selfStudentId = (selfRow as { id: string } | null)?.id;
    if (selfStudentId) {
      const { data: viewRow } = await supabase
        .from('coachs_corner_views')
        .select('id')
        .eq('video_id', video.id)
        .eq('student_id', selfStudentId)
        .maybeSingle();
      watched = !!viewRow;
    }
  }

  // Watchers roll-up — only loaded for coach/director/admin (Q7 = A)
  const showWatchers = profile.role === 'admin' || profile.role === 'director' || profile.role === 'coach';
  const watchers = showWatchers ? await buildVideoWatchersData(video.id) : null;

  const embedUrl = video.embed_id ? buildEmbedUrl(video.provider, video.embed_id) : null;
  const dateLabel = new Date(video.for_date + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });

  return (
    <>
      <PageHeader
        kicker={
          <>
            <Link href="/dashboard/coachs-corner" className="hover:text-ink">Coach&rsquo;s Corner</Link>
            <span className="mx-2">&middot;</span>
            {dateLabel}
          </>
        }
        title={<em className="italic">{video.title}</em>}
        description={video.description ?? undefined}
      />

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main: player + actions */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <VideoPlayerWithWatch
            videoId={video.id}
            embedUrl={embedUrl}
            url={video.url}
            provider={video.provider}
            initiallyWatched={watched}
            isStudent={profile.role === 'student'}
          />

          {video.description && (
            <section>
              <div className="kicker mb-2">Description</div>
              <div className="card-base p-4 text-sm text-ink whitespace-pre-wrap leading-relaxed">
                {video.description}
              </div>
            </section>
          )}
        </div>

        {/* Sidebar: meta + watchers (staff only) */}
        <aside className="flex flex-col gap-6">
          <section>
            <div className="kicker mb-2">About</div>
            <div className="card-base p-4 text-sm flex flex-col gap-2">
              <div className="flex justify-between">
                <span className="text-ink-faint">Source</span>
                <span className="text-ink font-medium">{providerLabel(video.provider)}</span>
              </div>
              {posterName && (
                <div className="flex justify-between">
                  <span className="text-ink-faint">Posted by</span>
                  <span className="text-ink font-medium">{posterName}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-ink-faint">Posted on</span>
                <span className="text-ink font-mono text-xs">
                  {new Date(video.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </div>
              <div className="pt-2 border-t border-ink-hair">
                <a
                  href={video.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-ink-faint hover:text-crimson break-all"
                >
                  Open in {providerLabel(video.provider)} &rarr;
                </a>
              </div>
            </div>
          </section>

          {watchers && (
            <section>
              <div className="kicker mb-2">
                Watched &middot; {watchers.watched.length} of {watchers.total}
              </div>
              <div className="card-base p-4">
                {watchers.total === 0 ? (
                  <div className="text-sm text-ink-dim">No active students in the academy.</div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {watchers.watched.length > 0 && (
                      <div>
                        <div className="text-[10px] font-mono uppercase tracking-wider text-sage-dark mb-1.5">
                          Watched ({watchers.watched.length})
                        </div>
                        <ul className="text-sm text-ink flex flex-col gap-0.5">
                          {watchers.watched.map((w) => (
                            <li key={w.student_id} className="flex items-center justify-between gap-2">
                              <span className="truncate">{w.full_name}</span>
                              <span className="font-mono text-[10px] text-ink-faint flex-shrink-0">
                                {new Date(w.watched_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {watchers.notWatched.length > 0 && (
                      <div className={watchers.watched.length > 0 ? 'pt-3 border-t border-ink-hair' : ''}>
                        <div className="text-[10px] font-mono uppercase tracking-wider text-ink-faint mb-1.5">
                          Not yet watched ({watchers.notWatched.length})
                        </div>
                        <ul className="text-sm text-ink-dim flex flex-col gap-0.5">
                          {watchers.notWatched.map((w) => (
                            <li key={w.student_id} className="truncate">{w.full_name}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>
          )}
        </aside>
      </div>
    </>
  );
}
