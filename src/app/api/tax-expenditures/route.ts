import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  if (!supabase) {
    return NextResponse.json({ error: 'DB not configured' }, { status: 503 });
  }
  
  const { data, error } = await supabase
    .from('tax_expenditures')
    .select('*')
    .order('dollar_amount', { ascending: false });
    
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  return NextResponse.json({ 
    tax_expenditures: data, 
    total: data.length,
    total_value: data.reduce((sum, te) => sum + Number(te.dollar_amount), 0)
  });
}
