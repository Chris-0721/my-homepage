import type { SiteConfig } from '@/lib/config';
import type { Publication } from '@/types/publication';

/** Canonical production origin. All canonical / sitemap URLs derive from this. */
export const SITE_URL = 'https://xxlab.org';

/** Stable identifiers used across JSON-LD, meta tags and llms.txt. */
export const IDENTITY = {
  nameEn: 'Xi Xie',
  nameZh: '谢希',
  jobTitleEn: 'Associate Researcher, College of Physics',
  jobTitleZh: '成都理工大学物理学院副研究员',
  institutionEn: 'College of Physics, Chengdu University of Technology',
  institutionZh: '成都理工大学物理学院',
  orcid: 'https://orcid.org/0000-0003-2748-7974',
  scholar: 'https://scholar.google.com.hk/citations?user=61xHj8MAAAAJ',
  faculty: 'https://faculty.cdut.edu.cn/xiexi/zh_CN/index.htm',
  email: 'xixie0721@163.com',
};

/**
 * Topical entities the site should be associated with. Feeds `knowsAbout`
 * in the Person graph, which search engines use for entity disambiguation.
 */
export const KNOWS_ABOUT = [
  'Optical skyrmions',
  'Structured light',
  'Topological photonics',
  'Optical tweezers',
  'Optical manipulation',
  'Nanophotonics',
  'Spin-orbit coupling of light',
  'Photonic spin Hall effect',
  'Metasurfaces',
  'Surface plasmon polaritons',
  'Vortex beams',
  'Bloch surface waves',
  '光学斯格明子',
  '结构光场调控',
  '拓扑结构光',
  '光镊技术',
  '纳米光子学',
];

interface SeoSection {
  site_url?: string;
  title?: string;
  description?: string;
  keywords?: string;
  og_image?: string;
  verification_google?: string;
  verification_bing?: string;
  verification_baidu?: string;
}

export function getSeoConfig(config: SiteConfig): {
  siteUrl: string;
  title: string;
  description: string;
  keywords: string[];
  ogImage: string;
} {
  const seo = (config as SiteConfig & { seo?: SeoSection }).seo;

  const siteUrl = (seo?.site_url || SITE_URL).replace(/\/$/, '');

  const title =
    seo?.title ||
    `${config.author.name} — ${config.author.title}, ${config.author.institution}`;

  const description = seo?.description || config.site.description;

  const keywords = (seo?.keywords || '')
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);

  const ogImage = seo?.og_image || config.author.avatar || '/bio.jpg';

  return {
    siteUrl,
    title,
    description,
    keywords: keywords.length > 0
      ? keywords
      : [
          config.author.name,
          '谢希',
          config.author.institution,
          'optical skyrmions',
          'structured light',
        ],
    ogImage: ogImage.startsWith('http') ? ogImage : `${siteUrl}${ogImage}`,
  };
}

export function getVerification(config: SiteConfig): {
  google?: string;
  other: Record<string, string>;
} {
  const seo = (config as SiteConfig & { seo?: SeoSection }).seo;
  const other: Record<string, string> = {};
  if (seo?.verification_bing) other['msvalidate.01'] = seo.verification_bing;
  if (seo?.verification_baidu) other['baidu-site-verification'] = seo.verification_baidu;
  return { google: seo?.verification_google, other };
}

interface JsonLdNode {
  [key: string]: unknown;
}

/** Person graph — the single highest-value structured data for an academic site. */
export function buildPersonJsonLd(config: SiteConfig, siteUrl: string): JsonLdNode {
  return {
    '@type': 'Person',
    '@id': `${siteUrl}/#person`,
    name: config.author.name,
    alternateName: [IDENTITY.nameZh, 'Xie Xi'],
    givenName: 'Xi',
    familyName: 'Xie',
    jobTitle: config.author.title,
    description: config.site.description,
    url: siteUrl,
    image: `${siteUrl}${config.author.avatar}`,
    email: `mailto:${config.social.email || IDENTITY.email}`,
    affiliation: {
      '@type': 'CollegeOrUniversity',
      name: 'Chengdu University of Technology',
      alternateName: '成都理工大学',
      department: {
        '@type': 'Organization',
        name: 'College of Physics',
        alternateName: '物理学院',
      },
      url: 'https://www.cdut.edu.cn/',
    },
    alumniOf: [
      { '@type': 'CollegeOrUniversity', name: 'Shenzhen University', alternateName: '深圳大学' },
      { '@type': 'CollegeOrUniversity', name: 'Nanyang Technological University', alternateName: '南洋理工大学' },
    ],
    knowsAbout: KNOWS_ABOUT,
    sameAs: [
      IDENTITY.orcid,
      IDENTITY.scholar,
      IDENTITY.faculty,
      ...(config.social.github ? [config.social.github] : []),
      ...(config.social.linkedin ? [config.social.linkedin] : []),
    ],
  };
}

export function buildWebSiteJsonLd(config: SiteConfig, siteUrl: string): JsonLdNode {
  return {
    '@type': 'WebSite',
    '@id': `${siteUrl}/#website`,
    url: siteUrl,
    name: `${config.author.name} (${IDENTITY.nameZh}) — ${config.site.title}`,
    alternateName: ['X² Lab', 'X² 实验室', 'xxlab.org'],
    description: config.site.description,
    inLanguage: ['en', 'zh-CN'],
    publisher: { '@id': `${siteUrl}/#person` },
    about: { '@id': `${siteUrl}/#person` },
  };
}

export function buildPersonProfilePageJsonLd(siteUrl: string): JsonLdNode {
  return {
    '@type': 'ProfilePage',
    '@id': `${siteUrl}/#profilepage`,
    url: siteUrl,
    name: `${IDENTITY.nameEn} (${IDENTITY.nameZh}) Academic Homepage`,
    isPartOf: { '@id': `${siteUrl}/#website` },
    about: { '@id': `${siteUrl}/#person` },
    mainEntity: { '@id': `${siteUrl}/#person` },
  };
}

/** ScholarlyArticle list for the publications page. */
export function buildPublicationsJsonLd(
  publications: Publication[],
  siteUrl: string,
  pageUrl: string
): JsonLdNode | null {
  const articles = publications.filter((p) => p.title).slice(0, 60);
  if (articles.length === 0) return null;

  return {
    '@type': 'ItemList',
    '@id': `${pageUrl}#publications`,
    name: 'Publications',
    numberOfItems: articles.length,
    itemListElement: articles.map((p, index) => {
      const node: JsonLdNode = {
        '@type': 'ScholarlyArticle',
        position: index + 1,
        headline: p.title,
        name: p.title,
        datePublished: p.year ? String(p.year) : undefined,
        inLanguage: 'en',
        author: (p.authors || []).map((a) =>
          a.name === IDENTITY.nameEn || a.name === IDENTITY.nameZh
            ? { '@type': 'Person', '@id': `${siteUrl}/#person`, name: a.name }
            : { '@type': 'Person', name: a.name }
        ),
      };

      if (p.journal) {
        const periodical: JsonLdNode = {
          '@type': 'Periodical',
          name: p.journal,
        };
        if (p.volume) periodical.volumeNumber = p.volume;
        node.isPartOf = periodical;
      }
      if (p.doi) {
        node.sameAs = `https://doi.org/${p.doi.replace(/^https?:\/\/doi\.org\//, '')}`;
      }
      if (p.url) node.url = p.url;

      // Strip undefined so the emitted JSON stays clean.
      return JSON.parse(JSON.stringify(node));
    }),
  };
}

/** Serializable <script type="application/ld+json"> payload. */
export function buildJsonLdGraph(nodes: Array<JsonLdNode | null>): string {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': nodes.filter(Boolean),
  });
}
