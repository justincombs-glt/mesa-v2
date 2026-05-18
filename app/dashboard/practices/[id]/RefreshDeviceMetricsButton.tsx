'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface RefreshButtonProps {
  activityId: string;
}

/**
 * Phase 9c: synchronous refresh button.
 *
 * Click -> POST /api/devices/refresh-practice with activityId in body.
 * Wait for response (could take several seconds depending on roster size).
 * On success: router.refresh() to re-render the server component with fresh data.
 * On error: show inline message.
 *
 * Stays disabled and shows spinner state while in-flight to prevent
 * double-clicks.
 */
export function RefreshDeviceMetricsButton({ activityId }: RefreshButtonProps) {
  const router = useRouter();
  const [state, setState] = useState<'idle' | 'refreshing' | 'error'>('idle');
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);

  const handleClick = async () => {
    setState('refreshing');
    setErrMsg(null);
    setSummary(null);
    try {
      const res = await fetch('/api/devices/refresh-practice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activity_id: activityId }),
      });
      if (!res.ok) {
        const text = await res.text();
        let parsed: { error?: string } = {};
        try { parsed = JSON.parse(text); } catch { /* keep raw */ }
        const detail = parsed.error || text.slice(0, 120);
        setState('error');
        setErrMsg(`${res.status}: ${detail}`);
        return;
      }
      const json = await res.json() as {
        total: number;
        results: Array<{ status: string }>;
      };
      const success = json.results.filter((r) => r.status === 'success').length;
      const noData = json.results.filter((r) => r.status === 'no_data').length;
      const noConn = json.results.filter((r) => r.status === 'no_connection').length;
      const errors = json.results.filter(
        (r) => r.status !== 'success' && r.status !== 'no_data' && r.status !== 'no_connection',
      ).length;
      const bits: string[] = [];
      if (success > 0) bits.push(`${success} updated`);
      if (noData > 0) bits.push(`${noData} no data`);
      if (noConn > 0) bits.push(`${noConn} no device`);
      if (errors > 0) bits.push(`${errors} error${errors === 1 ? '' : 's'}`);
      setSummary(bits.join(' \u00b7 ') || 'No athletes processed');
      setState('idle');
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setState('error');
      setErrMsg(msg);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={state === 'refreshing'}
        className="btn-outline text-sm"
      >
        {state === 'refreshing' ? 'Refreshing\u2026' : 'Refresh device data'}
      </button>
      {summary && (
        <div className="text-[11px] text-ink-faint">{summary}</div>
      )}
      {errMsg && (
        <div className="text-[11px] text-crimson max-w-[280px] text-right">{errMsg}</div>
      )}
    </div>
  );
}
