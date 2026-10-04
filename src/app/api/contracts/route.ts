import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import type { Award, AwardsResponse } from '@/lib/types';

// Edge runtime: pure PostgREST query. No Node deps.
export const runtime = 'edge';

export async function GET(request: NextRequest): Promise<NextResponse<AwardsResponse>> {
  // Database not configured. Return empty page (frontend renders "Data updating" state).
  if (!supabase) {
    return NextResponse.json({
      awards: [],
      total: 0,
      page: 1,
      limit: 50,
      pages: 0,
    });
  }

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') ?? '1');
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 200);
  const offset = (page - 1) * limit;

  // Filters
  const connection = searchParams.get('connection');
  const category = searchParams.get('category'); // contract | grant | loan | direct_payment
  // R6e renamed the 'no_bid' flag to 'not_competed'; an old link still filters the same awards.
  const flagParam = searchParams.get('flag');
  const flag = flagParam === 'no_bid' ? 'not_competed' : flagParam;
  const search = searchParams.get('search');
  // When set, the search matches against recipient_name ONLY. The vendor
  // profile pages pass this; the global search bar (dashboard, tech page,
  // congress) does not. The vendor pages want direct contracts; the search
  // bar wants any award mentioning the term in description.
  const recipientOnly = searchParams.get('recipient_only') === '1';
  const minAmount = searchParams.get('min_amount');
  const maxAmount = searchParams.get('max_amount');
  const agency = searchParams.get('agency');
  const sortKey = searchParams.get('sort') ?? 'dollar_amount';
  const sortDir = searchParams.get('dir') ?? 'desc';
  // risk_min / risk_max are ignored: awards.risk_score was dropped in R6e (it was 0 on every row).

  // count: 'estimated' uses Postgres statistics instead of a full count.
  // For a 17k-row table, the difference is 10-50x faster on paginated
  // queries. The count is only used for "X of Y" display in the UI, so
  // being off by a few hundred rows is fine.
  // Trim SELECT to just the columns the UI actually displays. The award
  // row has 59 columns; the dashboard list view only uses ~11. Less data
  // over the wire = faster response, smaller memory in Vercel edge.
  const LIST_COLS = 'id, recipient_name, description, awarding_agency, awarding_agency_code, award_category, contract_type, naics_code, dollar_amount, competition_status, connection_type, flags, posted_date, performance_start, performance_end, base_obligation_date, pop_state, pop_city, recipient_parent_name, price_premium_pct';

  let query = supabase
    .from('awards')
    .select(LIST_COLS, { count: 'estimated' })
    .range(offset, offset + limit - 1)
    .order(sortKey, { ascending: sortDir === 'asc' });

  if (connection && connection !== 'all') {
    query = query.eq('connection_type', connection);
  }

  if (category && category !== 'all') {
    query = query.eq('award_category', category);
  }

  if (flag && flag !== 'all') {
    query = query.contains('flags', [flag]);
  }

  if (search) {
    // The search param may contain a single primary name followed by
    // comma-separated aliases (used by vendor profile pages that want to OR
    // across all known names). Build a single PostgREST `.or()` filter.
    //
    // Match strategy:
    //   - PRIMARY name (first term): match against both recipient_name AND
    //     description. A vendor's name can legitimately appear in either.
    //     Use space-padded substring (` % term %`) so 3-letter terms like
    //     "Meta" or "AWS" don't match "metadata", "paws", "metadata".
    //   - ALIASES (terms 2..N): match against recipient_name ONLY. Aliases
    //     like "AWS" or "Ring" are too short to be specific in free-text
    //     descriptions (they match "paws", "laws", "haws", "draws"...),
    //     but they ARE specific as recipient names. This is the difference
    //     between "Amazon is the recipient of this award" and "the word
    //     'aws' appears in some random award description."
    //
    // Cap total terms at 12 to stay safely under PostgREST's URL filter
    // limit. Entities with 30+ aliases (Google, Amazon, Koch family)
    // silently returned 0 results when the full alias list overflowed.
    const terms = search.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 12);
    const [primary, ...aliases] = terms;
    const orParts: string[] = [];

    if (primary) {
      const safe = primary.replace(/[%_]/g, '\\$&');
      // Space-padded: `% aws %` matches the standalone word, not "paws"
      // or "draws". We also include the un-padded version for names that
      // appear at the start/end of the string (no leading/trailing space
      // in the field).
      orParts.push(
        `recipient_name.ilike.% ${safe} %`,
        `recipient_name.ilike.${safe} %`,
        `recipient_name.ilike.% ${safe}`
      );
      // Description match only for free-text search (search bar), not
      // for vendor profile lookups. Vendor pages pass recipient_only=1
      // because they want direct contracts, not "any award whose
      // description mentions this name."
      if (!recipientOnly) {
        orParts.push(
          `description.ilike.% ${safe} %`,
          `description.ilike.${safe} %`,
          `description.ilike.% ${safe}`
        );
      }
    }
    for (const alias of aliases) {
      // Skip aliases that are too short or too generic to be useful as
      // recipient-name matches. Minimum 5 chars to avoid substring noise
      // ("AWS" → "paws", "Ring" → "string", "Box" → "boxcar"). Skip pure
      // digits too — they're not vendor names.
      const trimmed = alias.trim();
      if (trimmed.length < 5) continue;
      if (/^\d+$/.test(trimmed)) continue;
      const safe = trimmed.replace(/[%_]/g, '\\$&');
      orParts.push(
        `recipient_name.ilike.% ${safe} %`,
        `recipient_name.ilike.${safe} %`,
        `recipient_name.ilike.% ${safe}`
      );
    }

    if (orParts.length > 0) {
      query = query.or(orParts.join(','));
    }
  }

  if (minAmount) {
    query = query.gte('dollar_amount', parseInt(minAmount));
  }

  if (maxAmount) {
    query = query.lte('dollar_amount', parseInt(maxAmount));
  }

  if (agency) {
    query = query.eq('awarding_agency', agency);
  }


  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message } as unknown as AwardsResponse, { status: 500 });
  }

  return NextResponse.json({
    awards: (data ?? []) as unknown as Award[],
    total: count ?? 0,
    page,
    limit,
    pages: Math.ceil((count ?? 0) / limit),
  }, {
    headers: {
      // Awards table changes infrequently. Cache for 5min on the CDN,
      // 1min in browser, with 10min SWR for cold-cache recovery.
      'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=600',
    },
  });
}

export async function POST(request: NextRequest) {
  if (!supabase) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  const body = await request.json();
  const { data, error } = await supabase
    .from('awards')
    .insert(body)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ award: data }, { status: 201 });
}