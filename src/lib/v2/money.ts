/**
 * The four kinds of money, one color each (design rule 1).
 *
 * Every visual use of a money color goes through this map so the label and
 * letter icon always travel with the color. Class strings are written out in
 * full so Tailwind can see them.
 */
export type MoneyType = 'contracts' | 'trades' | 'campaign' | 'lobbying';

export interface MoneyTypeStyle {
  type: MoneyType;
  label: string;
  /** Letter icon: C / T / $ / L. */
  letter: string;
  /** One-line plain-English description and its primary source. */
  description: string;
  source: string;
  /** Solid tile: white text on the money color. */
  tile: string;
  /** Chip: money ink on the money tint. */
  chip: string;
  /** Letter icon square. */
  icon: string;
  /** Text in the money ink (for links and numbers on white). */
  text: string;
  /** Border/top accent. */
  border: string;
  /** Raw hex for charts and OG images. */
  hex: string;
  tintHex: string;
}

export const MONEY_TYPES: Record<MoneyType, MoneyTypeStyle> = {
  contracts: {
    type: 'contracts',
    label: 'Contracts',
    letter: 'C',
    description: 'Agency → company awards',
    source: 'USAspending',
    tile: 'bg-contracts text-white',
    chip: 'bg-contracts-tint text-contracts-ink',
    icon: 'bg-contracts text-white',
    text: 'text-contracts-ink',
    border: 'border-contracts',
    hex: '#0B7A84',
    tintHex: '#DDF3F4',
  },
  trades: {
    type: 'trades',
    label: 'Disclosed trades',
    letter: 'T',
    description: "Members' disclosed trades (stocks, options and other assets), as ranges",
    source: 'STOCK Act filings',
    tile: 'bg-trades text-white',
    chip: 'bg-trades-tint text-trades-ink',
    icon: 'bg-trades text-white',
    text: 'text-trades-ink',
    border: 'border-trades',
    hex: '#6534D9',
    tintHex: '#ECE6FD',
  },
  campaign: {
    type: 'campaign',
    label: 'Campaign money',
    letter: '$',
    description: 'PACs and donors',
    source: 'FEC',
    tile: 'bg-campaign text-white',
    chip: 'bg-campaign-tint text-campaign-ink',
    icon: 'bg-campaign text-white',
    text: 'text-campaign-ink',
    border: 'border-campaign',
    hex: '#C2410C',
    tintHex: '#FDE9DD',
  },
  lobbying: {
    type: 'lobbying',
    label: 'Lobbying',
    letter: 'L',
    description: 'Who paid to lobby, on what',
    source: 'Senate LDA',
    tile: 'bg-lobbying text-white',
    chip: 'bg-lobbying-tint text-lobbying-ink',
    icon: 'bg-lobbying text-white',
    text: 'text-lobbying-ink',
    border: 'border-lobbying',
    hex: '#A61E4D',
    tintHex: '#FBE4EE',
  },
};

export const MONEY_TYPE_ORDER: MoneyType[] = ['contracts', 'trades', 'campaign', 'lobbying'];
