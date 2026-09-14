/**
 * Generates public/sitemap.xml from the site navigation config.
 *
 * Runs automatically via the `prebuild` npm script so the sitemap can never
 * drift out of sync with the routes that actually exist. Defensive by design:
 * if anything goes wrong the build still proceeds, because a stale sitemap is
 * strictly better than a failed deploy.
 */
import fs from 'node:fs';
import path from 'node:path';

const SITE_URL = 'https://xxlab.org';
const root = process.cwd();

function latestMtime(dirs) {
  let newest = 0;
  for (const dir of dirs) {
    const abs = path.join(root, dir);
    if (!fs.existsSync(abs)) continue;
    const stack = [abs];
    while (stack.length) {
      const current = stack.pop();
      let entries = [];
      try {
        entries = fs.readdirSync(current, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const entry of entries) {
        const full = path.join(current, entry.name);
        if (entry.isDirectory()) {
          stack.push(full);
        } else {
          try {
            const { mtimeMs } = fs.statSync(full);
            if (mtimeMs > newest) newest = mtimeMs;
          } catch {
            /* ignore */
          }
        }
      }
    }
  }
  return newest;
}

function collectRoutes() {
  const routes = new Set(['/']);

  for (const localeDir of ['content', 'content_zh']) {
    const configPath = path.join(root, localeDir, 'config.toml');
    if (!fs.existsSync(configPath)) continue;

    let navigation = [];
    try {
      const raw = fs.readFileSync(configPath, 'utf-8');
      // Minimal navigation extraction to avoid an ESM/CJS interop dependency.
      navigation = [...raw.matchAll(/\[\[navigation\]\]([\s\S]*?)(?=\n\[\[|\s*$)/g)].map(
        (match) => {
          const href = match[1].match(/^\s*href\s*=\s*"([^"]*)"/m);
          const type = match[1].match(/^\s*type\s*=\s*"([^"]*)"/m);
          return { href: href?.[1], type: type?.[1] };
        }
      );
    } catch {
      continue;
    }

    for (const item of navigation) {
      if (!item.href || item.href.startsWith('http')) continue;
      if (item.type === 'link') {
        routes.add(item.href);
        continue;
      }
      const normalized = item.href.endsWith('/') ? item.href : `${item.href}/`;
      routes.add(normalized);
    }
  }

  return [...routes].sort((a, b) => (a === '/' ? -1 : b === '/' ? 1 : a.localeCompare(b)));
}

function buildSitemap(routes, lastmod) {
  const entries = routes.map((route) => {
    const isAsset = /\.[a-z0-9]+$/i.test(route);
    const priority = route === '/' ? '1.0' : isAsset ? '0.4' : '0.8';
    const changefreq = route === '/' ? 'monthly' : 'yearly';
    return [
      '  <url>',
      `    <loc>${SITE_URL}${route}</loc>`,
      `    <lastmod>${lastmod}</lastmod>`,
      `    <changefreq>${changefreq}</changefreq>`,
      `    <priority>${priority}</priority>`,
      '  </url>',
    ].join('\n');
  });

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries,
    '</urlset>',
    '',
  ].join('\n');
}

try {
  const routes = collectRoutes();
  const mtime = latestMtime(['content', 'content_zh']);
  const lastmod = new Date(mtime || Date.now()).toISOString().slice(0, 10);

  const outDir = path.join(root, 'public');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'sitemap.xml'), buildSitemap(routes, lastmod), 'utf-8');

  console.log(`[sitemap] ${routes.length} URLs written (lastmod ${lastmod})`);
} catch (error) {
  console.warn('[sitemap] skipped:', error instanceof Error ? error.message : error);
}
