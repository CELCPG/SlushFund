import { notFound } from 'next/navigation';
import { FlagChip } from '@/components/v2/MoneyChip';
import { Wrap } from '@/components/v2/PageBand';
import {
  Cite,
  FigureSlot,
  Footnotes,
  Highlight,
  RailNote,
  SourceList,
  StoryFooter,
  StoryHeader,
  StorySection,
  type FootnoteItem,
  type SourceItem,
} from '@/components/v2/story/Story';
import { designPagesEnabled } from '@/lib/v2/flags';

// Story template (D5): Direction B's reading layout in the C system. EVERY word below is
// labelled placeholder text. No real or made-up claim appears here: when a real story adopts the
// template it replaces the placeholders and supplies a real footnote for every figure.
// noindex comes from the segment layout. Behind designPagesEnabled(): 404 on the production deployment (A8 L2).

const PH = '[Placeholder]';

const FOOTNOTES: FootnoteItem[] = [
  { n: 1, text: `${PH} The sentence or figure being cited, quoted as it appears in the story.`, record: `${PH} Publisher · record ID · date retrieved`, href: '#' },
  { n: 2, text: `${PH} A second cited figure. Every number in the text gets its own numbered note.`, record: `${PH} Publisher · record ID · date retrieved`, href: '#' },
  { n: 3, text: `${PH} A cited sentence from a primary document, such as a filing or a statute.`, record: `${PH} Publisher · record ID · date retrieved`, href: '#' },
];

const SOURCES: SourceItem[] = [
  { title: `${PH} Title of the official record`, publisher: `${PH} Publisher`, id: `${PH} ID`, retrieved: `${PH} date`, href: '#' },
  { title: `${PH} Title of a second record`, publisher: `${PH} Publisher`, id: `${PH} ID`, retrieved: `${PH} date`, href: '#' },
  { title: `${PH} Title of a third record`, publisher: `${PH} Publisher`, id: `${PH} ID`, retrieved: `${PH} date`, href: '#' },
];

export default function StoryTemplatePage() {
  if (!designPagesEnabled()) notFound();
  return (
    <div data-v2>
      <div role="note" className="bg-stale-tint text-stale-ink">
        <Wrap className="py-3 text-[14px]">
          <b className="font-extrabold uppercase tracking-[0.06em]">Template, not a story.</b>{' '}
          This page shows the reading layout for investigations. Every word on it is placeholder text and none of it is a claim. It is not indexed by search engines.
        </Wrap>
      </div>

      <StoryHeader
        kicker={`${PH} Kicker · Investigation`}
        headline={`${PH} A headline that states the finding, not the topic`}
        dek={`${PH} One or two sentences under the headline that say what the records show and what they do not. Plain words, no accusation.`}
        meta={{
          published: `${PH} date`,
          updated: `${PH} date, or "not updated"`,
          verified: `${PH} date every figure was last checked`,
          audit: `${PH} Auditor sign-off and date`,
        }}
      />

      <StorySection
        kicker={`${PH} The finding`}
        title={`${PH} Takeaway first: the section title says what was found`}
        rail={
          <>
            <RailNote title="What this is, and isn't">
              {PH} A short note on what the records can and cannot show. For example: a sequence of events is a reason to ask questions, not proof of wrongdoing.
            </RailNote>
            <RailNote title="Response from the people named">
              <p className="italic">{PH} Each person or company named gets a slot here. Their response is published in full, or this slot says &ldquo;did not respond&rdquo; with the date we asked.</p>
            </RailNote>
            <RailNote title="Sources">
              <a href="#fn-1" className="font-semibold text-trades-ink hover:underline">Note 1</a> · <a href="#fn-2" className="font-semibold text-trades-ink hover:underline">Note 2</a>
            </RailNote>
          </>
        }
      >
        <p>
          {PH} This paragraph states the finding in plain words. Every figure in a story is followed by a numbered note<Cite n={1} /> that opens the official record it came from<Cite n={2} />. The one phrase a reader must not miss gets the <Highlight>highlighter, once per section</Highlight>.
        </p>
        <p>
          {PH} Body text runs in a measured column of about 680 pixels, with generous line spacing, so a long read stays comfortable. A pattern the data shows can carry the <FlagChip /> tag, which means worth a look and never an accusation.
        </p>
      </StorySection>

      <StorySection
        kicker={`${PH} The evidence`}
        title={`${PH} A figure drawn from the explorers, with its own source line`}
        rail={
          <RailNote title="Reading the figures">
            {PH} Ranges stay ranges. Dollar amounts show whether they are disclosed bands or obligated amounts, and the date they are current to.
          </RailNote>
        }
      >
        <p>{PH} Text introducing the figure and saying what to look at. A chart or table is embedded live from the data explorers, so it can&rsquo;t drift from the data.</p>
        <FigureSlot
          title={`${PH} Figure title that states the measure`}
          source={`${PH} Source line: dataset · coverage · as-of date · method link. Same wording as the source bar on the data pages.`}
        >
          <span>{PH} Chart or table goes here.</span>
        </FigureSlot>
        <p>{PH} Text after the figure that reads the result and points to the record behind it<Cite n={3} />.</p>
      </StorySection>

      <StorySection
        kicker={`${PH} Method`}
        title={`${PH} How we know, in a few lines`}
        rail={
          <RailNote title="Methodology">
            {PH} Link to the dataset method pages used by this story.
          </RailNote>
        }
      >
        <p>{PH} A short paragraph on which datasets were used, which rule selected the rows, what was left out, and the date the data was pulled. Stories do not repeat the whole method; they link to it.</p>
      </StorySection>

      <Footnotes items={FOOTNOTES} />
      <SourceList items={SOURCES} verified={`${PH} date`} />
      <StoryFooter corrections={<p className="text-muted">{PH} None, or a dated list of corrections to this story with what changed.</p>} />
    </div>
  );
}
