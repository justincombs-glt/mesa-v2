// ============================================================================
// DeviceMetricsTable (server component)
//
// Phase 9c: shown on the practice detail page when the viewer is staff.
// Renders a row per rostered athlete with their device metrics.
//
// USAGE in the practice detail page:
//
//   import { DeviceMetricsTable } from './DeviceMetricsTable';
//
//   {viewerIsStaff && (
//     <DeviceMetricsTable
//       activityId={practice.id}
//       roster={rosterArray.map(r => ({
//         student_id: r.student_id,
//         student_name: r.student_full_name,
//         profile_id: r.profile_id, // may be null
//       }))}
//     />
//   )}
//
// PROPS:
//   - activityId: the practice's activities.id
//   - roster: array of { student_id, student_name, profile_id|null }
//
// The component fetches metrics + connection status itself; caller passes
// only the IDs.
// ============================================================================

import { createClient } from '@/lib/supabase/server';
import { RefreshDeviceMetricsButton } from './RefreshDeviceMetricsButton';

interface RosterEntry {
  student_id: string;
  student_name: string;
  profile_id: string | null;
}

interface DeviceMetricsTableProps {
  activityId: string;
  roster: RosterEntry[];
}

interface MetricsRow {
  student_id: string;
  avg_hr: number | null;
  max_hr: number | null;
  zone_cardio_min: number | null;
  zone_peak_min: number | null;
  pulled_at: string;
}

interface ConnectionRow {
  profile_id: string;
  status: string;
}

export async function DeviceMetricsTable({ activityId, roster }: DeviceMetricsTableProps) {
  const supabase = createClient();

  // Load metrics for this practice across all athletes (RLS allows staff)
  const { data: metricsRaw } = await supabase
    .from('practice_device_metrics')
    .select('student_id, avg_hr, max_hr, zone_cardio_min, zone_peak_min, pulled_at')
    .eq('activity_id', activityId);
  const metrics = ((metricsRaw ?? []) as MetricsRow[]);

  // Index by student_id
  const metricsByStudent = new Map<string, MetricsRow>();
  for (const m of metrics) metricsByStudent.set(m.student_id, m);

  // Load device connections for all rostered athletes (by profile_id)
  const profileIds = roster.map((r) => r.profile_id).filter((p): p is string => !!p);
  let connections: ConnectionRow[] = [];
  if (profileIds.length > 0) {
    const { data: connsRaw } = await supabase
      .from('user_device_connections')
      .select('profile_id, status')
      .in('profile_id', profileIds)
      .eq('provider', 'google_health');
    connections = ((connsRaw ?? []) as ConnectionRow[]);
  }
  const connByProfile = new Map<string, ConnectionRow>();
  for (const c of connections) connByProfile.set(c.profile_id, c);

  // Compute "last refreshed" — newest pulled_at across all metrics rows
  let lastRefreshed: Date | null = null;
  for (const m of metrics) {
    const t = new Date(m.pulled_at);
    if (!lastRefreshed || t > lastRefreshed) lastRefreshed = t;
  }

  return (
    <section className="mt-10 pb-2">
      <div className="flex items-end justify-between mb-4 flex-wrap gap-3">
        <div>
          <h2 className="font-serif text-2xl text-ink leading-tight">Device metrics</h2>
          <p className="text-[12px] text-ink-faint mt-1">
            {lastRefreshed
              ? `Last refreshed ${_formatRelativeOrAbsolute(lastRefreshed)}`
              : 'No data pulled yet'}
          </p>
        </div>
        <RefreshDeviceMetricsButton activityId={activityId} />
      </div>

      <div className="overflow-x-auto -mx-2">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left border-b border-ink-hair">
              <th className="kicker py-2 px-2">Athlete</th>
              <th className="kicker py-2 px-2 text-right">Avg HR</th>
              <th className="kicker py-2 px-2 text-right">Max HR</th>
              <th className="kicker py-2 px-2 text-right">Time in Cardio+Peak</th>
            </tr>
          </thead>
          <tbody>
            {roster.length === 0 && (
              <tr>
                <td colSpan={4} className="py-6 text-center text-[13px] text-ink-faint italic">
                  No athletes on roster.
                </td>
              </tr>
            )}
            {roster.map((r) => {
              const m = metricsByStudent.get(r.student_id);
              const conn = r.profile_id ? connByProfile.get(r.profile_id) : undefined;
              const hasDevice = !!conn && conn.status !== 'revoked';
              const reconnectNeeded = !!conn && conn.status === 'reconnect_needed';
              const cardioPeak =
                m && (m.zone_cardio_min !== null || m.zone_peak_min !== null)
                  ? (m.zone_cardio_min ?? 0) + (m.zone_peak_min ?? 0)
                  : null;

              return (
                <tr key={r.student_id} className="border-b border-ink-hair">
                  <td className="py-3 px-2">
                    <div className="text-ink">{r.student_name}</div>
                    {!hasDevice && (
                      <div className="text-[11px] text-ink-faint mt-0.5">
                        no device connected
                      </div>
                    )}
                    {reconnectNeeded && (
                      <div className="text-[11px] text-crimson mt-0.5">
                        reconnect needed
                      </div>
                    )}
                    {hasDevice && !reconnectNeeded && !m && (
                      <div className="text-[11px] text-ink-faint mt-0.5">
                        no data for this practice
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-2 text-right text-ink tabular-nums">
                    {m?.avg_hr ?? _dash()}
                  </td>
                  <td className="py-3 px-2 text-right text-ink tabular-nums">
                    {m?.max_hr ?? _dash()}
                  </td>
                  <td className="py-3 px-2 text-right text-ink tabular-nums">
                    {cardioPeak !== null ? `${cardioPeak} min` : _dash()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function _dash() {
  return <span className="text-ink-faint">{'\u2014'}</span>;
}

/**
 * Format a Date as either relative ("12 min ago", "3 hr ago") for recent
 * times, or absolute ("Tue May 17 \u00b7 7:32 AM") for older.
 */
function _formatRelativeOrAbsolute(d: Date): string {
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hr ago`;
  // Absolute format
  const dateStr = d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const timeStr = d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
  return `${dateStr} \u00b7 ${timeStr}`;
}
