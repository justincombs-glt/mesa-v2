'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface ConnectionSummary {
  provider: string;
  status: string;
  connected_at: string;
  scopes: string[];
}

interface DevicesSectionProps {
  connections: ConnectionSummary[];
  statusFlag: string | null;
  message: string | null;
}

/**
 * Phase 9a: shows the user's connected devices and lets them connect or
 * disconnect. Only Google Health is wired up; Whoop is shown as "Coming soon".
 *
 * The OAuth flow itself happens at /api/oauth/google-health/start (initiates)
 * and /api/oauth/google-health/callback (handles return). We don't manage
 * tokens client-side at all.
 */
export function DevicesSection({ connections, statusFlag, message }: DevicesSectionProps) {
  const router = useRouter();
  const googleConn = connections.find((c) => c.provider === 'google_health');

  // Clear the success/error query param from the URL after first render so
  // a page refresh doesn't keep showing the banner
  useEffect(() => {
    if (statusFlag) {
      const t = setTimeout(() => {
        router.replace('/dashboard/settings', { scroll: false });
      }, 6000);
      return () => clearTimeout(t);
    }
  }, [statusFlag, router]);

  return (
    <section className="pb-8 border-b border-ink-hair">
      <h2 className="font-serif text-2xl text-ink mb-1">Devices</h2>
      <p className="text-sm text-ink-dim mb-6">
        Connect a fitness tracker so MESA can capture heart rate and activity data during practice.
      </p>

      {/* Status banner */}
      {statusFlag === 'connected' && (
        <Banner kind="success">
          {'\u2713'} Connected. We&rsquo;ll pull practice data from your device automatically.
        </Banner>
      )}
      {statusFlag === 'disconnected' && (
        <Banner kind="info">
          Disconnected. MESA will no longer access your device data.
        </Banner>
      )}
      {statusFlag === 'error' && (
        <Banner kind="error">
          Couldn&rsquo;t connect. {message || 'Please try again.'}
        </Banner>
      )}

      {/* Google Health / Fitbit */}
      <DeviceRow
        name="Fitbit"
        subtitle="via Google Health"
        connection={googleConn}
        startUrl="/api/oauth/google-health/start"
        disconnectUrl="/api/oauth/google-health/disconnect"
      />

      {/* Whoop placeholder */}
      <DeviceRow
        name="Whoop"
        subtitle="Coming soon"
        connection={undefined}
        startUrl={null}
        disconnectUrl={null}
        disabled
      />
    </section>
  );
}

function DeviceRow({
  name,
  subtitle,
  connection,
  startUrl,
  disconnectUrl,
  disabled,
}: {
  name: string;
  subtitle: string;
  connection: ConnectionSummary | undefined;
  startUrl: string | null;
  disconnectUrl: string | null;
  disabled?: boolean;
}) {
  const isConnected = !!connection && connection.status === 'connected';
  const needsReconnect = !!connection && connection.status === 'reconnect_needed';

  return (
    <div className="flex items-center justify-between py-4 border-t border-ink-hair">
      <div>
        <div className="font-medium text-ink">{name}</div>
        <div className="text-[12px] text-ink-faint mt-1">
          {isConnected ? (
            <>
              Connected {connection ? _formatDate(connection.connected_at) : ''}
            </>
          ) : needsReconnect ? (
            <span className="text-crimson">Reconnect needed</span>
          ) : (
            subtitle
          )}
        </div>
      </div>
      <div>
        {disabled ? (
          <span className="text-[11px] font-mono uppercase tracking-wider text-ink-faint">
            Soon
          </span>
        ) : isConnected || needsReconnect ? (
          <form action={disconnectUrl ?? '#'} method="POST" className="inline">
            <button type="submit" className="btn-outline text-sm">
              Disconnect
            </button>
          </form>
        ) : (
          <a href={startUrl ?? '#'} className="btn-primary text-sm inline-block">
            Connect
          </a>
        )}
      </div>
    </div>
  );
}

function Banner({
  kind,
  children,
}: {
  kind: 'success' | 'error' | 'info';
  children: React.ReactNode;
}) {
  const styles = {
    success: 'bg-sage/10 border-sage/30 text-ink',
    error: 'bg-crimson/10 border-crimson/30 text-ink',
    info: 'bg-ink/5 border-ink-hair text-ink',
  } as const;
  return (
    <div className={`p-4 rounded-xl border mb-5 text-sm ${styles[kind]}`}>
      {children}
    </div>
  );
}

function _formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}
