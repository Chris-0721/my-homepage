import { notFound } from 'next/navigation';
import { getPageConfig, getMarkdownContent, getBibtexContent } from '@/lib/content';
import { getConfig } from '@/lib/config';
import { parseBibTeX } from '@/lib/bibtexParser';
import DynamicPageClient, { type DynamicPageLocaleData } from '@/components/pages/DynamicPageClient';
import {
  BasePageConfig,
  PublicationPageConfig,
  TextPageConfig,
  CardPageConfig,
} from '@/types/page';

import { Metadata } from 'next';
import { getRuntimeI18nConfig } from '@/lib/i18n/config';
import {
  getSeoConfig,
  buildJsonLdGraph,
  buildPublicationsJsonLd,
} from '@/lib/seo';

function loadDynamicPageData(slug: string, locale?: string): DynamicPageLocaleData | null {
  const pageConfig = getPageConfig(slug, locale) as BasePageConfig | null;

  if (!pageConfig) {
    return null;
  }

  if (pageConfig.type === 'publication') {
    const pubConfig = pageConfig as PublicationPageConfig;
    const bibtex = getBibtexContent(pubConfig.source, locale);
    return {
      type: 'publication',
      config: pubConfig,
      publications: parseBibTeX(bibtex, locale),
    };
  }

  if (pageConfig.type === 'text') {
    const textConfig = pageConfig as TextPageConfig;
    const content = getMarkdownContent(textConfig.source, locale);
    return {
      type: 'text',
      config: textConfig,
      content,
    };
  }

  if (pageConfig.type === 'card') {
    return {
      type: 'card',
      config: pageConfig as CardPageConfig,
    };
  }

  return null;
}

export function generateStaticParams() {
  const config = getConfig();
  return config.navigation
    .filter((nav) => nav.type === 'page' && nav.target !== 'about')
    .map((nav) => ({
      slug: nav.target,
    }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;

  const config = getConfig();
  const runtimeI18n = getRuntimeI18nConfig(config.i18n);
  // 站点只有单一 URL（/），页面元数据一律按 default_locale 输出。
  // 若这里不传 locale，取到的是英文页面配置（"Publications"/"Awards…"），
  // 中文查询词就匹配不到子页面标题。
  const locale = runtimeI18n.defaultLocale;
  const localeConfig = getConfig(locale);
  const pageConfig = getPageConfig(slug, locale) as BasePageConfig | null;

  if (!pageConfig) {
    return {};
  }

  const seo = getSeoConfig(config);

  const description =
    pageConfig.description ||
    `${pageConfig.title} — 谢希 (Xi Xie)，${localeConfig.author.institution}`;
  const url = `${seo.siteUrl}/${slug}/`;

  return {
    title: pageConfig.title,
    description,
    alternates: {
      canonical: `/${slug}/`,
    },
    openGraph: {
      type: 'website',
      url,
      title: `${pageConfig.title} | 谢希 (Xi Xie)`,
      description,
      siteName: `谢希 (Xi Xie) — ${localeConfig.site.title}`,
      images: [
        {
          url: seo.ogImage,
          alt: `${pageConfig.title} — 谢希 (Xi Xie)`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${pageConfig.title} | 谢希 (Xi Xie)`,
      description,
      images: [seo.ogImage],
    },
  };
}

export default async function DynamicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const baseConfig = getConfig();
  const runtimeI18n = getRuntimeI18nConfig(baseConfig.i18n);
  const targetLocales = runtimeI18n.enabled ? runtimeI18n.locales : [runtimeI18n.defaultLocale];

  const dataByLocale: Record<string, DynamicPageLocaleData> = {};

  for (const locale of targetLocales) {
    const localizedData = loadDynamicPageData(slug, locale);
    if (localizedData) {
      dataByLocale[locale] = localizedData;
    }
  }

  const defaultData = loadDynamicPageData(slug);
  if (defaultData) {
    dataByLocale[runtimeI18n.defaultLocale] = dataByLocale[runtimeI18n.defaultLocale] || defaultData;
  }

  if (Object.keys(dataByLocale).length === 0) {
    notFound();
  }

  // Emit ScholarlyArticle structured data so each paper becomes an indexable,
  // entity-resolvable node instead of plain page text.
  const seo = getSeoConfig(baseConfig);
  const publicationData = dataByLocale[runtimeI18n.defaultLocale];
  const publicationsJsonLd =
    publicationData && publicationData.type === 'publication'
      ? buildPublicationsJsonLd(
          publicationData.publications,
          seo.siteUrl,
          `${seo.siteUrl}/${slug}/`
        )
      : null;

  return (
    <>
      {publicationsJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: buildJsonLdGraph([publicationsJsonLd]),
          }}
        />
      )}
      <DynamicPageClient dataByLocale={dataByLocale} defaultLocale={runtimeI18n.defaultLocale} />
    </>
  );
}
