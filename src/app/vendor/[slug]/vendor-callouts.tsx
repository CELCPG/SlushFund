/**
 * Vendor-profile data-coverage callouts.
 *
 * Each function returns a JSX block that explains *why* USAspending.gov shows
 * $0 for a vendor, with links to the actual sources that DO have the data.
 *
 * Pattern: route by connection_category first, then by name token as a
 * fallback for the same category. Generic fallback at the bottom.
 */
import { AlertTriangle, ExternalLink } from 'lucide-react';

function CalloutShell({ children, color = 'amber' }: { children: React.ReactNode; color?: 'amber' | 'slate' }) {
  if (color === 'slate') {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4 text-sm text-slate-400">
        {children}
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-amber-800/60 bg-amber-950/30 p-5">
      {children}
    </div>
  );
}

function CalloutHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <AlertTriangle className="h-4 w-4 text-amber-400" />
      <h3 className="font-bold text-amber-200 text-sm">{title}</h3>
      {sub && <span className="text-xs text-amber-200/60">{sub}</span>}
    </div>
  );
}

// --- Trump family: Secret Service, emoluments, pass-through LLCs ----------

export function TrumpPropertyCallout() {
  return (
    <CalloutShell>
      <CalloutHeader title="What this section shows — and doesn't" />
      <div className="space-y-2 text-sm text-amber-100/80 leading-relaxed">
        <p>
          <strong className="text-amber-200">USAspending.gov only captures direct federal contracts and grants</strong> — money paid
          by a federal agency to a vendor. It does not include:
        </p>
        <ul className="ml-4 list-disc space-y-1 text-amber-100/70">
          <li>U.S. Secret Service lodging and per-diem reimbursements at Trump properties</li>
          <li>White House staff, Press Corps, and campaign-adjacent travel charged to Trump hotels</li>
          <li>State Department events and VIP lodging at Mar-a-Lago, Bedminster, Trump Tower, and Trump Hotel DC</li>
          <li>Trump Organization LLC operating costs that pass through other federal vendors</li>
        </ul>
        <p className="pt-1">
          <strong className="text-amber-200">The actual reported federal spending at Trump properties is in the millions — but
          it's tracked by other watchdogs, not USAspending.</strong> Better sources:
        </p>
        <ul className="ml-4 list-disc space-y-1 text-amber-100/70">
          <li>
            <a href="https://www.foreupdeal.org/" target="_blank" rel="noopener noreferrer" className="text-amber-300 underline hover:text-amber-200">
              ForeUpDeal.org
            </a>{' '}
            — aggregated Secret Service, White House, and DoD receipts at Trump properties (GovEx 2024)
          </li>
          <li>
            <a href="https://www.citizensforethics.org/" target="_blank" rel="noopener noreferrer" className="text-amber-300 underline hover:text-amber-200">
              Citizens for Responsibility and Ethics in Washington (CREW)
            </a>{' '}
            — independent Trump Organization emoluments tracking
          </li>
          <li>
            <a href="https://www.propublica.org/" target="_blank" rel="noopener noreferrer" className="text-amber-300 underline hover:text-amber-200">
              ProPublica Trump properties coverage
            </a>{' '}
            — investigative reporting on federal payments since 2017
          </li>
        </ul>
        <p className="pt-2 text-xs text-amber-200/60">
          When USAspending publishes the data they capture as direct awards, it appears here. The $0 above reflects
          USAspending's coverage gap, not the absence of federal money flowing to Trump properties.
        </p>
      </div>
    </CalloutShell>
  );
}

// --- Musk network: launch services captured, but DOGE/shell entities not ----

export function MuskNetworkCallout({ name }: { name: string }) {
  const n = name.toLowerCase();
  // xAI, Tesla, SpaceX, Starlink all have direct contracts — only show for the
  // subsidiaries that genuinely have $0
  if (n.includes('spacex') || n.includes('starlink') || n.includes('tesla') || n.includes('xai')) {
    return null;
  }
  return (
    <CalloutShell>
      <CalloutHeader title="What this section shows — and doesn't" />
      <div className="space-y-2 text-sm text-amber-100/80 leading-relaxed">
        <p>
          <strong className="text-amber-200">This entity is part of the broader Musk network</strong> — SpaceX, Tesla, xAI, and
          Starlink all have direct federal contracts visible on their own vendor pages. The Boring Company, Neuralink, and
          related shell entities (Unusual Machines, Foundation Future Industries) have no direct USAspending obligations because
          their federal work is routed through SpaceX/Tesla parent contracts or as sub-vendors.
        </p>
        <p>
          For DOGE-related advisory work, see the{' '}
          <a href="/doge" className="text-amber-300 underline hover:text-amber-200">
            DOGE spending tracker
          </a>
          .
        </p>
      </div>
    </CalloutShell>
  );
}

// --- DOGE: not a contractor, it's a federal entity ---------------------------

export function DOGECallout() {
  return (
    <CalloutShell>
      <CalloutHeader title="DOGE isn't a federal contractor — it's a federal entity" />
      <div className="space-y-2 text-sm text-amber-100/80 leading-relaxed">
        <p>
          The Department of Government Efficiency is an <strong className="text-amber-200">executive-branch cost-cutting body</strong>,
          not a recipient of federal contracts. DOGE-related spending flows through the agencies it operates in (GSA, OPM, USDS)
          and appears on those agencies' vendor pages.
        </p>
        <p>
          <strong className="text-amber-200">The full DOGE spend picture</strong> — including salary allocations, IT modernization
          contracts, and lease terminations — is on the{' '}
          <a href="/doge" className="text-amber-300 underline hover:text-amber-200">
            DOGE tracker
          </a>
          . Federal employees detailed to DOGE from other agencies are paid by their home agency, not by DOGE itself.
        </p>
        <ul className="ml-4 list-disc space-y-1 text-amber-100/70">
          <li>
            <a href="https://www.gsa.gov/" target="_blank" rel="noopener noreferrer" className="text-amber-300 underline hover:text-amber-200">
              GSA.gov
            </a>{' '}
            — DOGE's parent agency for real-estate and procurement actions
          </li>
          <li>
            <a href="https://www.opm.gov/" target="_blank" rel="noopener noreferrer" className="text-amber-300 underline hover:text-amber-200">
              OPM.gov
            </a>{' '}
            — federal workforce data (RIFs, deferred resignations)
          </li>
          <li>
            <a href="https://www.usds.gov/" target="_blank" rel="noopener noreferrer" className="text-amber-300 underline hover:text-amber-200">
              USDS.gov
            </a>{' '}
            — U.S. Digital Service, now merged into DOGE
          </li>
        </ul>
      </div>
    </CalloutShell>
  );
}

// --- PACs: money flows via FEC, not USAspending -----------------------------

export function PACOrOrgCallout({ name }: { name: string }) {
  const n = name.toLowerCase();
  const isPAC = n.includes('pac') || n.includes('maga') || n.includes('america first') || n.includes('save america');
  return (
    <CalloutShell>
      <CalloutHeader
        title={isPAC ? 'PAC money flows through FEC filings, not USAspending' : 'Political organization, not a federal contractor'}
      />
      <div className="space-y-2 text-sm text-amber-100/80 leading-relaxed">
        <p>
          {isPAC
            ? 'Super PACs and political committees raise and spend money on elections. That money is reported to the FEC, not USAspending.'
            : 'Political advocacy and watchdog organizations are not federal contractors. Their funding comes from donors and foundations, not direct federal awards.'}
        </p>
        <p>
          <strong className="text-amber-200">The actual money flow</strong> for this entity is on the{' '}
          <a href="/influence?tab=pacs" className="text-amber-300 underline hover:text-amber-200">
            Super PACs tracker
          </a>{' '}
          and on these public sources:
        </p>
        <ul className="ml-4 list-disc space-y-1 text-amber-100/70">
          <li>
            <a href="https://www.fec.gov/data/" target="_blank" rel="noopener noreferrer" className="text-amber-300 underline hover:text-amber-200">
              FEC.gov
            </a>{' '}
            — committee filings, donor lists, independent expenditures
          </li>
          <li>
            <a href="https://www.opensecrets.org/" target="_blank" rel="noopener noreferrer" className="text-amber-300 underline hover:text-amber-200">
              OpenSecrets.org
            </a>{' '}
            — aggregated PAC and lobby spending
          </li>
          {n.includes('opensecrets') && (
            <li>
              <a href="https://www.opensecrets.org/about" target="_blank" rel="noopener noreferrer" className="text-amber-300 underline hover:text-amber-200">
                About OpenSecrets
              </a>{' '}
              — methodology and 501(c)(3) nonprofit structure
            </li>
          )}
        </ul>
      </div>
    </CalloutShell>
  );
}

// --- Lobbying firms: money flows via LDA disclosures, not contracts --------

export function LobbyistCallout() {
  return (
    <CalloutShell>
      <CalloutHeader title="Lobbying firm — federal work flows through LDA disclosures, not contracts" />
      <div className="space-y-2 text-sm text-amber-100/80 leading-relaxed">
        <p>
          Lobbying firms are paid by their private clients (corporations, trade associations, foreign governments) to influence
          federal policy. Their compensation is reported to Congress under the Lobbying Disclosure Act, not USAspending.
        </p>
        <p>
          <strong className="text-amber-200">To see this firm's actual federal footprint</strong>, search their client list and
          issue areas:
        </p>
        <ul className="ml-4 list-disc space-y-1 text-amber-100/70">
          <li>
            <a href="https://lda.senate.gov/" target="_blank" rel="noopener noreferrer" className="text-amber-300 underline hover:text-amber-200">
              LDA Senate Database
            </a>{' '}
            — official lobbying registrations, quarterly activity reports, and income
          </li>
          <li>
            <a href="https://www.opensecrets.org/federal-lobbying" target="_blank" rel="noopener noreferrer" className="text-amber-300 underline hover:text-amber-200">
              OpenSecrets Federal Lobbying
            </a>{' '}
            — searchable by registrant, client, or issue
          </li>
        </ul>
      </div>
    </CalloutShell>
  );
}

// --- VC firms: pass-through to portfolio companies --------------------------

export function VCCallout({ name }: { name: string }) {
  return (
    <CalloutShell>
      <CalloutHeader title="Venture capital firm — federal money flows through portfolio companies" />
      <div className="space-y-2 text-sm text-amber-100/80 leading-relaxed">
        <p>
          <strong className="text-amber-200">{name}</strong> is a venture capital firm. It doesn't directly receive federal
          contracts — the federal money flows to its portfolio companies (SpaceX, Palantir, Anduril, etc.) under their own
          vendor profiles.
        </p>
        <p>
          For the VC's actual influence footprint, see the{' '}
          <a href="/influence?tab=pacs" className="text-amber-300 underline hover:text-amber-200">
            Super PACs tracker
          </a>{' '}
          (VC political spending) and the public sources below.
        </p>
        <ul className="ml-4 list-disc space-y-1 text-amber-100/70">
          <li>
            <a href="https://www.sec.gov/edgar/searchedgar/companysearch.html" target="_blank" rel="noopener noreferrer" className="text-amber-300 underline hover:text-amber-200">
              SEC EDGAR
            </a>{' '}
            — Form ADV (RIA filings), Form D (private placements), Form 13F (large holdings)
          </li>
          <li>
            <a href="https://www.opensecrets.org/political-action-committees-pacs" target="_blank" rel="noopener noreferrer" className="text-amber-300 underline hover:text-amber-200">
              OpenSecrets PAC database
            </a>{' '}
            — affiliated PACs and political donations
          </li>
        </ul>
      </div>
    </CalloutShell>
  );
}

// --- Healthcare: federal money via CMS, not USAspending contracts -----------

export function HealthcareCallout({ name }: { name: string }) {
  return (
    <CalloutShell>
      <CalloutHeader title="Healthcare network — federal money flows through CMS, not direct contracts" />
      <div className="space-y-2 text-sm text-amber-100/80 leading-relaxed">
        <p>
          <strong className="text-amber-200">{name}</strong> is a healthcare provider/supplier whose primary federal exposure is
          Medicare/Medicaid reimbursements, not direct USAspending contract obligations. CMS payments to providers are tracked
          separately:
        </p>
        <ul className="ml-4 list-disc space-y-1 text-amber-100/70">
          <li>
            <a href="https://data.cms.gov/" target="_blank" rel="noopener noreferrer" className="text-amber-300 underline hover:text-amber-200">
              CMS Open Data
            </a>{' '}
            — Medicare provider utilization and payment data
          </li>
          <li>
            <a href="https://www.cms.gov/medicare/medicare-fee-service-payment" target="_blank" rel="noopener noreferrer" className="text-amber-300 underline hover:text-amber-200">
              CMS Fee Schedules
            </a>{' '}
            — Medicare/Medicaid reimbursement rates
          </li>
          <li>
            <a href="https://oig.hhs.gov/exclusions/" target="_blank" rel="noopener noreferrer" className="text-amber-300 underline hover:text-amber-200">
              HHS OIG exclusions
            </a>{' '}
            — providers excluded from federal healthcare programs
          </li>
          <li>
            <a href="https://www.phe.gov/" target="_blank" rel="noopener noreferrer" className="text-amber-300 underline hover:text-amber-200">
              PHE.gov
            </a>{' '}
            — pandemic-related provider relief funding (PRF, ARP)
          </li>
        </ul>
        <p className="pt-1 text-xs text-amber-200/60">
          If this vendor also has direct federal contracts (defense, research, supply chain), they'll show under their legal
          subsidiary name on the broader{' '}
          <a href="/contracts" className="text-amber-300 underline hover:text-amber-200">
            contracts search
          </a>
          .
        </p>
      </div>
    </CalloutShell>
  );
}

// --- Generic fallback -------------------------------------------------------

export function GenericVendorCallout() {
  return (
    <CalloutShell color="slate">
      <div className="mb-1 flex items-center gap-2 font-semibold text-slate-300">
        <AlertTriangle className="h-3.5 w-3.5" />
        No direct federal contracts found for this vendor
      </div>
      <p>
        USAspending.gov covers direct federal contracts and grants. If this vendor receives federal money
        through other channels (sub-contracts, reimbursements, pass-throughs, lobbying income, FEC-reported
        PAC money), it won't show up here.
      </p>
      <p className="mt-2 text-xs text-slate-500 flex items-center gap-1">
        <ExternalLink className="h-3 w-3" />
        Try the full{' '}
        <a href="/contracts" className="underline hover:text-slate-300">
          contracts search
        </a>{' '}
        if you know a subsidiary or DBA name.
      </p>
    </CalloutShell>
  );
}

/**
 * Route to the right callout. Order matters: check specific name patterns
 * first, then connection_category, then generic.
 */
export function pickVendorCallout({
  name,
  connectionCategory,
}: {
  name: string;
  connectionCategory: string;
}): React.ReactNode {
  const n = name.toLowerCase();

  // --- Trump family (properties, hotels, family pass-throughs) ---
  if (
    n.includes('trump') ||
    n.includes('mar-a-lago') ||
    n.includes('hotel') ||
    n.includes('bedminster') ||
    n.includes('affinity partners') ||
    n.includes('unusual machines') ||
    n.includes('foundation future')
  ) {
    return <TrumpPropertyCallout />;
  }

  // --- DOGE: not a contractor, it's a federal entity ---
  if (n === 'doge' || n.includes('department of government efficiency')) {
    return <DOGECallout />;
  }

  // --- Musk network subsidiaries (xAI/Tesla/SpaceX/Starlink return null) ---
  if (connectionCategory === 'elon_musk') {
    return <MuskNetworkCallout name={name} />;
  }

  // --- PACs and political orgs ---
  if (connectionCategory === 'mar-a-lago' || n.includes('pac') || n.includes('maga') || n === 'opensecrets') {
    return <PACOrOrgCallout name={name} />;
  }

  // --- Lobbying firms ---
  if (connectionCategory === 'lobbyist' || n.includes('brownstein') || n.includes('lobby')) {
    return <LobbyistCallout />;
  }

  // --- VC firms ---
  if (
    n.includes('sequoia') ||
    n.includes('andreessen') ||
    n.includes('a16z') ||
    n.includes('cross river')
  ) {
    return <VCCallout name={name} />;
  }

  // --- Healthcare networks ---
  if (
    n.includes('hca') ||
    n.includes('cardinal health') ||
    n.includes('medline') ||
    n.includes('change healthcare') ||
    n.includes('mckesson') ||
    n.includes('puritan')
  ) {
    return <HealthcareCallout name={name} />;
  }

  // --- Generic fallback ---
  return <GenericVendorCallout />;
}
