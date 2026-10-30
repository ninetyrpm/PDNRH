import { NextResponse } from 'next/server';
import { openExperimentSession } from '@/lib/experiment';

export const runtime = 'nodejs';
export async function POST() {
  try {
    const session = await openExperimentSession();
    return NextResponse.json(session, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Session service temporarily unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
