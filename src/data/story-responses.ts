/**
 * D12 (G7, Colin's Option A, 2026-10-20): replies to the right-of-reply letters, printed verbatim on the investigation posts.
 * Keyed by the company name used in story-figures.ts `asked`. Add a reply exactly as received (no edits, no trimming), with
 * the date it arrived; the page then prints it under "Response" in place of the "We asked ..." line, with that date.
 * Plain TypeScript with no imports, so scripts/verify-gates.mjs can load it too.
 */
export interface StoryReply {
  /** The date the reply arrived, as the page prints it ("Oct 22, 2026"). */
  received: string;
  /** The reply, verbatim. Paragraphs are separated by a blank line. */
  text: string;
}

export const STORY_RESPONSES: Readonly<Record<string, StoryReply | undefined>> = {
  // 'SpaceX': { received: 'Oct 22, 2026', text: '...' },
};
