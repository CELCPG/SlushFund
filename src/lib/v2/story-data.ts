import 'server-only';
import { supabase } from '@/lib/supabase';
import { memo, readAll } from '@/lib/v2/reads';
import {
  ENTITY_COLUMNS,
  SUMMARY_COLUMNS,
  TXN_COLUMNS,
  driftOf,
  retrievedOf,
  storySentences,
  viewMatches,
  withEvidenceFixes,
  type Sentences,
  type StoryEntity,
  type StoryGroup,
  type StoryTxn,
} from '@/lib/v2/story-figures';

/**
 * D12: live reads for the four investigation posts (anon key). Every figure on the pages is computed from these rows in
 * story-figures.ts; nothing is typed in. null means the database did not answer: the page then says the figures are
 * unavailable, never a zero.
 */
export interface StoryData {
  rows: StoryTxn[];
  entities: StoryEntity[];
  sentences: Sentences;
  /** Sentence keys that differ from the audited text; empty when the page matches the audit. */
  drift: string[];
  /** subject_money_summary (the view) equals the transaction rows, per award type and fiscal year. */
  viewOk: boolean;
  retrieved: string;
}

async function load(group: StoryGroup): Promise<StoryData | null> {
  if (!supabase) return null;
  const db = supabase;
  const [rows, entities, summary] = await Promise.all([
    readAll<StoryTxn>((from, to) => db.from('subject_award_transactions').select(TXN_COLUMNS, { count: 'exact' }).eq('subject_group', group).order('transaction_key').range(from, to)),
    readAll<StoryEntity>((from, to) => db.from('subject_entities').select(ENTITY_COLUMNS, { count: 'exact' }).eq('subject_group', group).order('entity_name').range(from, to)),
    readAll<{ fiscal_year: number; award_category: string; net_obligations: number | null }>((from, to) =>
      db.from('subject_money_summary').select(SUMMARY_COLUMNS, { count: 'exact' }).eq('subject_group', group).order('fiscal_year').range(from, to),
    ),
  ]);
  if (!rows || !entities || !summary || rows.length === 0) return null;
  const retrieved = retrievedOf(rows);
  if (!retrieved) return null;
  const sentences = storySentences(group, rows);
  return { rows, entities: withEvidenceFixes(entities), sentences, drift: driftOf(group, sentences), viewOk: viewMatches(rows, summary), retrieved };
}

const loaders = {
  musk: memo(() => load('musk')),
  bloomberg: memo(() => load('bloomberg')),
  oracle: memo(() => load('oracle')),
  bezos: memo(() => load('bezos')),
} satisfies Record<StoryGroup, () => Promise<StoryData | null>>;

export const getStoryData = (group: StoryGroup): Promise<StoryData | null> => loaders[group]();
