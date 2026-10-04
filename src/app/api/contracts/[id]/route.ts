import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import type { Award } from '@/lib/types';

// Edge runtime: PostgREST query.
export const runtime = 'edge';

// GET /api/contracts/[id] — single award by id or award_id
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Database not configured. Return 404 with a clean error.
  if (!supabase) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Try to find by our internal id first, then by award_id
  const { data, error } = await supabase
    .from('awards')
    .select('*')
    .or(`id.eq.${id},award_id.eq.${id}`)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ award: data as Award });
}