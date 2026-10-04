// SlushFund JSON-LD structured data for blog posts
export const articleSchema = (post: {
  title: string;
  description: string;
  date: string;
  author: string;
  slug: string;
  category: string;
  readTime: string;
}) => ({
  '@context': 'https://schema.org',
  '@type': 'NewsArticle',
  headline: post.title,
  description: post.description,
  datePublished: post.date,
  dateModified: post.date,
  author: {
    '@type': 'Organization',
    name: 'SlushFund Research',
    url: 'https://slushfund.net',
  },
  publisher: {
    '@type': 'Organization',
    name: 'SlushFund',
    logo: {
      '@type': 'ImageObject',
      url: 'https://slushfund.net/og-image.png',
    },
  },
  mainEntityOfPage: {
    '@type': 'WebPage',
    '@id': `https://slushfund.net/blog/${post.slug}`,
  },
  articleSection: post.category,
  timeRequired: post.readTime,
  wordCount: Math.round(parseInt(post.readTime) * 200),
});

export const websiteSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'SlushFund',
  url: 'https://slushfund.net',
  description: 'Tracking federal contracts, grants, and congressional stock trades linked to political connections.',
  publisher: {
    '@type': 'Organization',
    name: 'SlushFund',
    logo: {
      '@type': 'ImageObject',
      url: 'https://slushfund.net/og-image.png',
    },
  },
  potentialAction: {
    '@type': 'SearchAction',
    target: 'https://slushfund.net/congress/trades?member={search_term_string}',
    'query-input': 'required name=search_term_string',
  },
};

export const datasetSchema = {
  '@context': 'https://schema.org',
  '@type': 'Dataset',
  name: 'Congressional Stock Trade Database',
  description: 'Real-time database of congressional stock trades linked to federal contractor overlap.',
  url: 'https://slushfund.net/congress/trades',
  publisher: {
    '@type': 'Organization',
    name: 'SlushFund',
  },
  temporalCoverage: '2019-01-01/2026-12-31',
};