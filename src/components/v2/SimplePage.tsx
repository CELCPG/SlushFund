import type { ReactNode } from 'react';
import { PageBand, Wrap } from '@/components/v2/PageBand';

/** Title band + body for simple v2 pages (section landings, trust pages). */
export default function SimplePage({ eyebrow, title, dek, nav, sourceBar, children }: {
  eyebrow?: string;
  title: string;
  dek?: ReactNode;
  /** Optional tabs shown at the bottom of the title band. */
  nav?: ReactNode;
  /** Usually a <SourceBar/>, shown directly under the title band. */
  sourceBar?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div data-v2>
      <PageBand>
        {eyebrow && <p className="mt-8 text-[13px] font-bold uppercase tracking-[0.06em] text-on-deep max-md:mt-5">{eyebrow}</p>}
        <h1 className={`${eyebrow ? 'mt-1' : 'mt-8 max-md:mt-5'} max-w-[880px] font-display text-[44px] font-extrabold leading-[1.06] tracking-[-1px] max-md:text-[30px]`}>{title}</h1>
        {dek && <p className="mt-3 max-w-[720px] text-[17px] text-on-deep max-md:text-[15px]">{dek}</p>}
        {nav}
      </PageBand>
      <Wrap className="pb-12 pt-6">
        {sourceBar && <div className="mb-6">{sourceBar}</div>}
        {children}
      </Wrap>
    </div>
  );
}
