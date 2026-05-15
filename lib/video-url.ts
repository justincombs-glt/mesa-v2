/**
 * Phase 17: video URL parsing for Coach's Corner.
 *
 * Strict validation (Q12 = B): only YouTube, Vimeo, and Hudl URLs are
 * accepted. Anything else returns null (parse failure) and the server action
 * surfaces a clear error to the coach.
 *
 * Each parser returns:
 *   - provider: which platform
 *   - embed_id: the platform-specific ID we can use to construct the embed URL
 *
 * Embed URL construction is done separately by `buildEmbedUrl` since it
 * varies per provider and may need updating if YouTube/Vimeo change their
 * iframe paths.
 */

import type { CoachsCornerProvider } from './supabase/types';

export interface ParsedVideoUrl {
  provider: CoachsCornerProvider;
  embed_id: string;
}

/**
 * Parse a video URL pasted by a coach. Returns null when the URL doesn't
 * match any supported provider OR is malformed.
 *
 * Supported patterns (case-insensitive on host):
 *   YouTube
 *     - youtube.com/watch?v=VIDEO_ID
 *     - youtu.be/VIDEO_ID
 *     - youtube.com/embed/VIDEO_ID
 *     - youtube.com/shorts/VIDEO_ID
 *   Vimeo
 *     - vimeo.com/VIDEO_ID
 *     - player.vimeo.com/video/VIDEO_ID
 *   Hudl
 *     - hudl.com/video/VIDEO_ID
 *     - hudl.com/v/VIDEO_ID
 *     - hudl.com/video/3/<TEAM>/VIDEO_ID
 *     - For Hudl, the embed ID is the trailing video ID segment from the URL.
 */
export function parseVideoUrl(raw: string): ParsedVideoUrl | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;

  const host = url.hostname.toLowerCase().replace(/^www\./, '');

  // ----- YouTube -----
  if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
    // /watch?v=ID
    if (url.pathname === '/watch') {
      const v = url.searchParams.get('v');
      if (v && /^[\w-]{6,}$/.test(v)) return { provider: 'youtube', embed_id: v };
    }
    // /embed/ID, /shorts/ID, /v/ID
    const m = url.pathname.match(/^\/(?:embed|shorts|v)\/([\w-]{6,})/);
    if (m) return { provider: 'youtube', embed_id: m[1] };
  }
  if (host === 'youtu.be') {
    const id = url.pathname.replace(/^\//, '');
    if (/^[\w-]{6,}$/.test(id)) return { provider: 'youtube', embed_id: id };
  }

  // ----- Vimeo -----
  if (host === 'vimeo.com') {
    // /VIDEO_ID  or  /VIDEO_ID/h:hash
    const m = url.pathname.match(/^\/(\d{6,})(?:\/|$)/);
    if (m) return { provider: 'vimeo', embed_id: m[1] };
  }
  if (host === 'player.vimeo.com') {
    const m = url.pathname.match(/^\/video\/(\d{6,})/);
    if (m) return { provider: 'vimeo', embed_id: m[1] };
  }

  // ----- Hudl -----
  if (host === 'hudl.com' || host.endsWith('.hudl.com')) {
    // /video/ID, /v/ID, /video/3/<TEAM>/VIDEO_ID
    // Hudl's URL structure is inconsistent; we take the LAST non-empty path
    // segment as the embed ID. Validated as a non-empty token.
    const segments = url.pathname.split('/').filter(Boolean);
    const last = segments[segments.length - 1];
    if (last && /^[\w-]{4,}$/.test(last)) {
      return { provider: 'hudl', embed_id: last };
    }
  }

  return null;
}

/**
 * Build the embed URL for a stored video. Used by the player UI.
 *
 * YouTube:  https://www.youtube.com/embed/{id}
 * Vimeo:    https://player.vimeo.com/video/{id}
 * Hudl:     https://www.hudl.com/embed/video/{id}
 *           (Hudl embeds depend on the video being public-shared. Private
 *           team-account videos won't render; the UI shows an "open in
 *           Hudl" fallback link in that case.)
 */
export function buildEmbedUrl(provider: CoachsCornerProvider, embedId: string): string {
  if (provider === 'youtube') return `https://www.youtube.com/embed/${embedId}`;
  if (provider === 'vimeo')   return `https://player.vimeo.com/video/${embedId}`;
  if (provider === 'hudl')    return `https://www.hudl.com/embed/video/${embedId}`;
  // Exhaustiveness check — TS will flag if a new provider is added without
  // a branch here.
  const never_: never = provider;
  return never_;
}

/**
 * Human-readable provider name for UI labels.
 */
export function providerLabel(provider: CoachsCornerProvider): string {
  if (provider === 'youtube') return 'YouTube';
  if (provider === 'vimeo')   return 'Vimeo';
  if (provider === 'hudl')    return 'Hudl';
  return provider;
}
