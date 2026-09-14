import type { Metadata } from 'next';
import './globals.css';
import Navigation from '@/components/layout/Navigation';
import Footer from '@/components/layout/Footer';
import { ThemeProvider } from '@/components/ui/ThemeProvider';
import { LocaleProvider } from '@/components/ui/LocaleProvider';
import { getConfig } from '@/lib/config';
import { getRuntimeI18nConfig } from '@/lib/i18n/config';
import type { SiteConfig } from '@/lib/config';
import {
  getSeoConfig,
  getVerification,
  buildJsonLdGraph,
  buildPersonJsonLd,
  buildWebSiteJsonLd,
  buildPersonProfilePageJsonLd,
} from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  const config = getConfig();
  const runtimeI18n = getRuntimeI18nConfig(config.i18n);
  const openGraphLocale = runtimeI18n.defaultLocale === 'zh' ? 'zh_CN' : 'en_US';

  const seo = getSeoConfig(config);
  const verification = getVerification(config);

  // Merge keyword sets from every locale so Chinese terms reach Baidu / Bing CN
  // even though the static HTML is shipped in the default locale.
  const localizedKeywords = (runtimeI18n.enabled ? runtimeI18n.locales : [])
    .filter((locale) => locale !== runtimeI18n.defaultLocale)
    .flatMap((locale) => getSeoConfig(getConfig(locale)).keywords);
  const keywords = Array.from(new Set([...seo.keywords, ...localizedKeywords]));

  return {
    metadataBase: new URL(seo.siteUrl),
    title: {
      default: seo.title,
      template: `%s | ${config.author.name} (谢希) · X² Lab`,
    },
    description: seo.description,
    keywords,
    authors: [{ name: config.author.name, url: seo.siteUrl }],
    creator: config.author.name,
    publisher: config.author.name,
    category: 'Science',
    applicationName: `${config.site.title} — ${config.author.name}`,
    alternates: {
      canonical: '/',
      languages: {
        en: seo.siteUrl,
        'zh-CN': seo.siteUrl,
        'x-default': seo.siteUrl,
      },
    },
    icons: {
      icon: config.site.favicon,
      apple: config.author.avatar,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-image-preview': 'large',
        'max-snippet': -1,
        'max-video-preview': -1,
      },
    },
    verification: {
      google: verification.google,
      other: verification.other,
    },
    openGraph: {
      type: 'website',
      locale: openGraphLocale,
      alternateLocale: ['zh_CN', 'en_US'].filter(
        (locale) => locale !== openGraphLocale
      ),
      url: seo.siteUrl,
      title: seo.title,
      description: seo.description,
      siteName: `${config.author.name} (谢希) — ${config.site.title}`,
      images: [
        {
          url: seo.ogImage,
          width: 1200,
          height: 630,
          alt: `${config.author.name} (谢希) — ${config.author.institution}`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: seo.title,
      description: seo.description,
      images: [seo.ogImage],
    },
  };
}

function buildLocaleBootstrapScript(config: ReturnType<typeof getRuntimeI18nConfig>): string {
  const serializedConfig = JSON.stringify(config).replace(/</g, '\\u003c');

  return `
    try {
      const cfg = ${serializedConfig};
      const storageKey = 'locale-storage';
      const normalize = (value) => typeof value === 'string' ? value.trim().replace('_', '-').toLowerCase() : '';
      const matchLocale = (candidate) => {
        const normalized = normalize(candidate);
        if (!normalized) return null;
        if (cfg.locales.includes(normalized)) return normalized;
        const language = normalized.split('-')[0];
        if (cfg.locales.includes(language)) return language;
        return null;
      };

      let resolved = null;

      if (cfg.persist) {
        resolved = matchLocale(localStorage.getItem(storageKey));
      }

      if (!resolved) {
        if (cfg.mode === 'fixed') {
          resolved = cfg.fixedLocale;
        } else {
          resolved = matchLocale(navigator.language);
        }
      }

      if (!resolved) {
        resolved = cfg.defaultLocale;
      }

      const root = document.documentElement;
      root.lang = resolved;
      root.setAttribute('data-locale', resolved);

      if (cfg.persist) {
        localStorage.setItem(storageKey, resolved);
      }
    } catch (e) {
      const root = document.documentElement;
      root.lang = '${config.defaultLocale}';
      root.setAttribute('data-locale', '${config.defaultLocale}');
    }
  `;
}

function buildLocalizedConfigMaps(
  locales: string[]
): {
  navigationByLocale: Record<string, SiteConfig['navigation']>;
  siteTitleByLocale: Record<string, string>;
  lastUpdatedByLocale: Record<string, string | undefined>;
} {
  const navigationByLocale: Record<string, SiteConfig['navigation']> = {};
  const siteTitleByLocale: Record<string, string> = {};
  const lastUpdatedByLocale: Record<string, string | undefined> = {};

  for (const locale of locales) {
    const localizedConfig = getConfig(locale);
    navigationByLocale[locale] = localizedConfig.navigation;
    siteTitleByLocale[locale] = localizedConfig.site.title;
    lastUpdatedByLocale[locale] = localizedConfig.site.last_updated;
  }

  return {
    navigationByLocale,
    siteTitleByLocale,
    lastUpdatedByLocale,
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const config = getConfig();
  const runtimeI18n = getRuntimeI18nConfig(config.i18n);
  const targetLocales = runtimeI18n.enabled ? runtimeI18n.locales : [runtimeI18n.defaultLocale];

  const {
    navigationByLocale,
    siteTitleByLocale,
    lastUpdatedByLocale,
  } = buildLocalizedConfigMaps(targetLocales);

  const seo = getSeoConfig(config);
  const structuredData = buildJsonLdGraph([
    buildPersonJsonLd(config, seo.siteUrl),
    buildWebSiteJsonLd(config, seo.siteUrl),
    buildPersonProfilePageJsonLd(seo.siteUrl),
  ]);

  return (
    <html lang={runtimeI18n.defaultLocale} className="scroll-smooth" suppressHydrationWarning>
      <head>
        <link rel="icon" href={config.site.favicon} type="image/svg+xml" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: structuredData }}
        />
        <link rel="dns-prefetch" href="https://jialeliu.com" />
        <link rel="preconnect" href="https://jialeliu.com" crossOrigin="" />
        <link
          rel="preload"
          as="font"
          type="font/woff2"
          href="https://jialeliu.com/fonts/georgiab.woff2"
          crossOrigin=""
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const theme = localStorage.getItem('theme-storage');
                const parsed = theme ? JSON.parse(theme) : null;
                const setting = parsed?.state?.theme || 'system';
                const prefersDark = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
                const effective = setting === 'dark' ? 'dark' : (setting === 'light' ? 'light' : (prefersDark ? 'dark' : 'light'));
                var root = document.documentElement;
                root.classList.add(effective);
                root.setAttribute('data-theme', effective);
              } catch (e) {
                var root = document.documentElement;
                root.classList.add('light');
                root.setAttribute('data-theme', 'light');
              }
            `,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: buildLocaleBootstrapScript(runtimeI18n),
          }}
        />
      </head>
      <body className="font-sans antialiased">
        <ThemeProvider>
          <LocaleProvider config={runtimeI18n}>
            <Navigation
              items={config.navigation}
              siteTitle={config.site.title}
              enableOnePageMode={config.features.enable_one_page_mode}
              i18n={runtimeI18n}
              itemsByLocale={navigationByLocale}
              siteTitleByLocale={siteTitleByLocale}
            />
            <main className="min-h-screen pt-16 lg:pt-20">
              {children}
            </main>
            <Footer
              lastUpdated={config.site.last_updated}
              lastUpdatedByLocale={lastUpdatedByLocale}
              defaultLocale={runtimeI18n.defaultLocale}
            />
          </LocaleProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
