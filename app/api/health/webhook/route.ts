import { NextResponse } from 'next/server';

// ============================================================================
// Apple Health / Health Auto Export webhook
//
// This endpoint will receive POST requests from the "Health Auto Export" iOS
// app (or any HealthKit-aware shortcut) with heart rate / workout data. It
// authenticates via a shared secret from env vars, then writes rows to the
// `activities` table via the admin (service-role) Supabase client.
//
// The full implementation arrives in Batch 6, which will:
//   - Validate the shared secret
//   - Parse Health Auto Export's JSON schema (workouts[], heart_rate[], etc.)
//   - Look up student by an external mapping (Apple Health doesn't know who
//     is who — families map a device to a student in settings)
//   - Insert into `activities` with source='apple_health' and a stable
//     external_id to dedupe reruns
//
// For Batch 1, this endpoint exists so the URL is deployable and testable,
// but it just acknowledges the ping.
// ============================================================================

export async function POST(request: Request) {
  const secret = request.headers.get('x-mesa-webhook-secret');

  if (!process.env.HEALTH_WEBHOOK_SECRET) {
    return NextResponse.json(
      { ok: false, error: 'Webhook not configured on server' },
      { status: 503 }
    );
  }

  if (secret !== process.env.HEALTH_WEBHOOK_SECRET) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  // Ack only for now. Batch 6 implements the insert logic.
  return NextResponse.json({
    ok: true,
    message: 'Webhook received. Full processing ships in Batch 6.',
  });
}

export async function GET() {
  return NextResponse.json({
    service: 'MESA Apple Health webhook',
    status: 'ready',
    note: 'POST your payload with the x-mesa-webhook-secret header.',
  });
}
