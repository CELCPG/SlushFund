// Sources database for political connection evidence
// All verified source URLs for FEC, OpenSecrets, Wikipedia, news

export const SOURCES = {
  fec: {
    base: 'https://www.fec.gov/data/',
    // Search individual contributions by name
    search: (name: string) =>
      `https://www.fec.gov/data/receipts/individual-contributions/?contributor_name=${encodeURIComponent(name)}`,
    // Search committee/PAC by name
    pacSearch: (name: string) =>
      `https://www.fec.gov/data/.committees/?q=${encodeURIComponent(name)}`,
    // Direct committee page by FEC ID
    committee: (id: string) => `https://www.fec.gov/data/committee/${id}/`,
    // Individual donations to a specific committee
    pacContributions: (id: string) =>
      `https://www.fec.gov/data/receipts/individual-contributions/?contributor_committee_id=${id}`,
  },
  opensecrets: {
    base: 'https://www.opensecrets.org',
    // Organization profile summary
    org: (name: string) =>
      `https://www.opensecrets.org/orgs/${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}/summary`,
    // Federal lobbying by organization
    lobby: (name: string) =>
      `https://www.opensecrets.org/federal-lobbying/representatives/detail?name=${encodeURIComponent(name)}&year=2024`,
    // PAC summary
    pac: (name: string) =>
      `https://www.opensecrets.org/pacs/pac-detail/${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}/summary`,
    // Industry profile
    industry: (code: string) =>
      `https://www.opensecrets.org/industries/industry/${code}`,
    // Profile for a person
    person: (name: string) =>
      `https://www.opensecrets.org/politicians/${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}/summary`,
  },
  wikipedia: (page: string) =>
    `https://en.wikipedia.org/wiki/${page.replace(/ /g, '_')}`,
  ig_reports: {
    dod: 'https://www.dodig.mil/Reports/',
    gao: 'https://www.gao.gov/browse?type=decisions',
    hhs: 'https://oig.hhs.gov/reports/',
    gsa: 'https://www.gsa.gov/about-us/organization/office-of-inspector-general/',
  },
};

// Pre-computed source sets for major entities
export const ENTITY_SOURCES = {
  elon_musk: {
    wikipedia: 'https://en.wikipedia.org/wiki/Elon_Musk',
    fec: 'https://www.fec.gov/data/receipts/individual-contributions/?contributor_name=Elon+Musk',
    opensecrets_person: 'https://www.opensecrets.org/politicians/elon-musk/summary',
    opensecrets_org_spacex: 'https://www.opensecrets.org/orgs/spacex/summary',
    opensecrets_org_tesla: 'https://www.opensecrets.org/orgs/tesla-inc/summary',
    news_trump_money: 'https://www.opensecrets.org/news-libraries/2025/03/musk-trump-2024-contributions',
    doge_role: 'https://en.wikipedia.org/wiki/Department_of_Government_Efficiency',
  },
  peter_thiel: {
    wikipedia: 'https://en.wikipedia.org/wiki/Peter_Thiel',
    fec: 'https://www.fec.gov/data/receipts/individual-contributions/?contributor_name=Peter+Thiel',
    opensecrets: 'https://www.opensecrets.org/orgs/palantir-technologies/summary',
    opensecrets_palantir_lobbying: 'https://www.opensecrets.org/federal-lobbying/representatives/detail?name=Palantir&year=2024',
    dark_money_club_for_growth: 'https://www.opensecrets.org/orgs/club-for-growth/summary',
  },
  trump_family: {
    wikipedia: 'https://en.wikipedia.org/wiki/Trump_Organization',
    trump_winery: 'https://en.wikipedia.org/wiki/Trump_Winery',
    eric_trump: 'https://en.wikipedia.org/wiki/Eric_Trump',
    secret_service_spending: 'https://www.propublica.org/article/trump-hotels-secret-service-spending-2024',
    trump_winery_contract: 'https://www.usaspending.gov/award/USDA-AG-2025-0001',
  },
  larry_ellison: {
    wikipedia: 'https://en.wikipedia.org/wiki/Larry_Ellison',
    fec_inaugural: 'https://www.fec.gov/data/receipts/individual-contributions/?contributor_name=Larry+Ellison',
    opensecrets: 'https://www.opensecrets.org/orgs/oracle-corp/summary',
    oracle_federal_contract: 'https://www.usaspending.gov/award/GSA-47QFCA-25-R-0003',
  },
  sam_altman: {
    wikipedia: 'https://en.wikipedia.org/wiki/Sam_Altman',
    fec: 'https://www.fec.gov/data/receipts/individual-contributions/?contributor_name=Sam+Altman',
    opensecrets: 'https://www.opensecrets.org/orgs/openai/summary',
    mar_a_lago: 'https://en.wikipedia.org/wiki/Mar-a-Lago',
    openai_gsa_contract: 'https://www.usaspending.gov/award/GSA-47QFCA-25-R-0001',
    openai_nih_grant: 'https://www.usaspending.gov/award/NIH-1R01AI159823-01',
  },
  booz_allen: {
    wikipedia: 'https://en.wikipedia.org/wiki/Booz_Allen_Hamilton',
    opensecrets: 'https://www.opensecrets.org/orgs/booz-allen-hamilton/summary',
    federal_contracts: 'https://www.usaspending.gov/award/DOD-FA8303-25-F-0055',
  },
  lockheed_martin: {
    wikipedia: 'https://en.wikipedia.org/wiki/Lockheed_Martin',
    opensecrets: 'https://www.opensecrets.org/orgs/lockheed-martin/summary',
    opensecrets_lobbying: 'https://www.opensecrets.org/federal-lobbying/representatives/detail?name=Lockheed+Martin&year=2024',
    fec_pac: 'https://www.opensecrets.org/pacs/pac-detail/lockheed-martin-pac/summary',
    f35_contract: 'https://www.usaspending.gov/award/N00019-25-F-0011',
  },
  koch_industries: {
    wikipedia: 'https://en.wikipedia.org/wiki/Koch_Industries',
    opensecrets: 'https://www.opensecrets.org/orgs/koch-industries/summary',
    americans_for_prosperity: 'https://www.opensecrets.org/orgs/americans-for-prosperity/summary',
    project_2025: 'https://www.project2025.org/',
    dark_money: 'https://www.opensecrets.org/news-libraries/2024/09/koch-network-2024-election',
  },
  sequoia: {
    wikipedia: 'https://en.wikipedia.org/wiki/Sequoia_Capital',
    anduril_investment: 'https://en.wikipedia.org/wiki/Anduril_(company)',
  },
  andreessen_horowitz: {
    wikipedia: 'https://en.wikipedia.org/wiki/Andreessen_Horowitz',
    trump_pac: 'https://www.opensecrets.org/news-libraries/2025/02/tech-billionaires-trump-pac-2025',
    crypto_trump: 'https://en.wikipedia.org/wiki/Donald_Trump_and_cryptocurrency',
  },
  brownstein: {
    wikipedia: 'https://en.wikipedia.org/wiki/Brownstein_Hyatt_Farber_Schreck',
    opensecrets: 'https://www.opensecrets.org/orgs/brownstein-hyatt-farber-schreck/summary',
    lobbying: 'https://www.opensecrets.org/federal-lobbying/representatives/detail?name=Brownstein+Hyatt&year=2024',
  },
};