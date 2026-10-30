import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashCredential } from '@/lib/experiment';

export const runtime = 'nodejs';
const reasons = ['blur', 'hidden', 'pagehide', 'concede', 'reload'] as const;
type LossReason = typeof reasons[number];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function count(n: unknown, max: number) {
  return typeof n === 'number' && Number.isSafeInteger(n) && n >= 0 && n <= max ? n : null;
}
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const token = request.headers.get('authorization')?.replace(/^Bearer /i, '');
  if (!uuid.test(id) || !token || !/^[a-zA-Z0-9_-]{43}$/.test(token)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  let body: Record<string, unknown>;
  try {
    if (Number(request.headers.get('content-length') || 0) > 2048) return NextResponse.json({ error: 'Too large' }, { status: 413 });
    body = await request.json();
  } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const type = body.type;
  const seq = count(body.sequence, 100000);
  const elapsed = count(body.elapsedMs, 86400000);
  const clicks = count(body.clicks, 1000000);
  const scrolls = count(body.scrolls, 1000000);
  const idle = count(body.idleMs, 86400000);
  const reason = body.reason;
  if ((type !== 'heartbeat' && type !== 'loss') || seq === null || elapsed === null ||
      clicks === null || scrolls === null || idle === null ||
      (type === 'loss' && !reasons.includes(reason as LossReason)) ||
      (type === 'heartbeat' && reason !== undefined)) return NextResponse.json({ error: 'Invalid event' }, { status: 400 });
  try {
    const sql = db();
    const auth = await sql`SELECT id,status FROM sessions WHERE id=${id} AND credential_hash=${hashCredential(token)}`;
    if (!auth.length) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (auth[0].status !== 'active') return NextResponse.json({ accepted: true, terminal: true }, { headers: { 'Cache-Control': 'no-store' } });
    if (type === 'heartbeat') {
      // One ordered key per client event; duplicate delivery remains idempotent.
      await sql`INSERT INTO events(session_id,event_key,type,payload)
        VALUES(${id},${'heartbeat-'+seq},'heartbeat',${JSON.stringify({ elapsedMs: elapsed, clicks, scrolls, idleMs: idle })}::jsonb)
        ON CONFLICT(session_id,event_key) DO NOTHING`;
      await sql`UPDATE sessions SET last_seen_at=now() WHERE id=${id} AND status='active'`;
    } else {
      const updated = await sql`UPDATE sessions SET status='confirmed_loss',ended_at=now(),last_seen_at=now(),
        loss_reason=${reason as string},elapsed_ms=${elapsed}
        WHERE id=${id} AND status='active' RETURNING id`;
      if (updated.length) {
        await sql`INSERT INTO outcomes(session_id,classification,observed_reason,evidence)
          VALUES(${id},'confirmed_loss',${reason as string},${JSON.stringify({ elapsedMs:elapsed,clicks,scrolls,idleMs:idle })}::jsonb)
          ON CONFLICT(session_id) DO NOTHING`;
        await sql`INSERT INTO events(session_id,event_key,type,payload)
          VALUES(${id},${'loss-'+seq},'loss',${JSON.stringify({reason,elapsedMs:elapsed,clicks,scrolls,idleMs:idle})}::jsonb)
          ON CONFLICT(session_id,event_key) DO NOTHING`;
      }
    }
    return NextResponse.json({ accepted: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Telemetry unavailable' }, { status: 503 });
  }
}
