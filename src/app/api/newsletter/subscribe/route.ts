import { NextResponse } from 'next/server';
import { supabase, supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase';
import { subscribeToButtondown } from '@/lib/buttondown';

// Edge runtime: PostgREST + Buttondown fetch. No Node deps.
export const runtime = 'edge';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  try {
    const { email, source } = await req.json();

    if (typeof email !== 'string' || !EMAIL_RE.test(email)) {
      return NextResponse.json({ error: 'Invalid email address.' }, { status: 400 });
    }
    if (email.length > 254) {
      return NextResponse.json({ error: 'Email too long.' }, { status: 400 });
    }

    const normalized = email.toLowerCase().trim();
    const src = typeof source === 'string' ? source.slice(0, 40) : undefined;

    // Sending layer: sync to Buttondown (sends the confirmation email and
    // manages unsubscribes). Non-fatal so a hiccup never loses a subscriber.
    const bd = await subscribeToButtondown(normalized, { source: src, tags: ['slushfund'] });
    if (!bd.ok) console.error('Newsletter Buttondown sync failed:', bd.error);

    // Source of truth: persist to Supabase when configured.
    if (!isSupabaseConfigured) {
      // Never report "subscribed" unless a store actually kept the address.
      if (bd.ok && !bd.skipped) return NextResponse.json({ ok: true });
      return NextResponse.json({ error: 'Signups are not available right now.' }, { status: 503 });
    }

    const client = supabaseAdmin ?? supabase;
    if (!client) {
      return NextResponse.json({ error: 'Database not available.' }, { status: 503 });
    }

    const { error } = await client
      .from('newsletter_subscribers')
      .upsert(
        { email: normalized, source: src ?? null },
        { onConflict: 'email', ignoreDuplicates: true }
      );

    if (error) {
      console.error('Newsletter subscribe error:', error);
      return NextResponse.json({ error: 'Could not save subscription.' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Newsletter subscribe exception:', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
