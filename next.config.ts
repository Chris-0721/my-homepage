import type { NextConfig } from "next";
import fs from "node:fs";
import path from "node:path";

/**
 * 站点默认语言的唯一事实来源是 content/config.toml 的 [i18n] default_locale。
 *
 * 为什么要在构建期注入：客户端语言状态（src/lib/stores/localeStore.ts）在模块初始化时
 * 就要有一个 locale 初值，而它无法在浏览器包里读 fs。若初值写死 'en'，静态导出时
 * SSR 会按 'en' 预渲染 DOM —— 爬虫只看到英文正文，中文查询词就永远命中不了
 * （正文里的中文只存在于 RSC payload 的 <script> 中，搜索引擎不计入页面正文）。
 *
 * 故此处读一次真值注入为 NEXT_PUBLIC_DEFAULT_LOCALE，保证 SSR 与首屏客户端渲染一致。
 */
function readDefaultLocale(): string {
  try {
    const raw = fs.readFileSync(
      path.join(process.cwd(), "content", "config.toml"),
      "utf8"
    );
    const match = raw.match(/^\s*default_locale\s*=\s*["']([^"']+)["']/m);
    return match?.[1]?.trim() || "en";
  } catch {
    return "en";
  }
}

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  env: {
    // 见上方 readDefaultLocale 的说明。改 content/config.toml 的 [i18n] 即可，无需改这里。
    NEXT_PUBLIC_DEFAULT_LOCALE: readDefaultLocale(),
  },
  /* config options here */
  webpack: (config) => {
    config.module.rules.push({
      test: /\.bib$/,
      type: 'asset/source',
    });
    return config;
  },
};

export default nextConfig;
