import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { MOCK_AWARDS } from '@/lib/mock-data-new';
import type { Award } from '@/lib/types';

// GET /api/contracts/[id] — single award by id or award_id
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Demo mode
  if (!supabase) {
    const mock = MOCK_AWARDS.find(a => a.id === id || a.award_id === id);
    if (!mock) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ award: mock, demo: true });
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