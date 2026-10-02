'use client';

import { create } from 'zustand';
import { matchLocale } from '@/lib/i18n/config';
import type { I18nRuntimeConfig } from '@/types/i18n';

const LOCALE_STORAGE_KEY = 'locale-storage';

/**
 * 首屏（SSR + hydration 第一次渲染）使用的语言。
 *
 * 构建期由 next.config.ts 从 content/config.toml 的 [i18n] default_locale 注入。
 * 必须是构建期常量而非运行时探测：静态导出时没有 navigator，SSR 只能按此值渲染，
 * 若与站点默认语言不一致，预渲染出来的 DOM 就是错误的语言（爬虫读不到中文）。
 * 首屏之后仍由 initialize() 按 localStorage / navigator.language 接管。
 */
const INITIAL_LOCALE = process.env.NEXT_PUBLIC_DEFAULT_LOCALE || 'en';

interface LocaleStore {
  locale: string;
  isReady: boolean;
  locales: string[];
  defaultLocale: string;
  persistSelection: boolean;
  initialize: (config: I18nRuntimeConfig) => void;
  setLocale: (locale: string) => void;
}

function updateDocumentLocale(locale: string) {
  const root = document.documentElement;
  root.lang = locale;
  root.setAttribute('data-locale', locale);
}

function readPersistedLocale(locales: string[]): string | null {
  try {
    const raw = localStorage.getItem(LOCALE_STORAGE_KEY);
    return matchLocale(raw, locales);
  } catch {
    return null;
  }
}

function writePersistedLocale(locale: string) {
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // ignore storage errors
  }
}

function clearPersistedLocale() {
  try {
    localStorage.removeItem(LOCALE_STORAGE_KEY);
  } catch {
    // ignore storage errors
  }
}

function resolveInitialLocale(config: I18nRuntimeConfig): string {
  const bootLocale = matchLocale(document.documentElement.getAttribute('data-locale'), config.locales);
  if (bootLocale) {
    return bootLocale;
  }

  if (config.persist) {
    const persisted = readPersistedLocale(config.locales);
    if (persisted) {
      return persisted;
    }
  }

  if (config.mode === 'fixed') {
    return config.fixedLocale;
  }

  const browserLocale = matchLocale(navigator.language, config.locales);
  return browserLocale || config.defaultLocale;
}

export const useLocaleStore = create<LocaleStore>()((set, get) => ({
  locale: INITIAL_LOCALE,
  isReady: false,
  locales: ['en'],
  defaultLocale: INITIAL_LOCALE,
  persistSelection: true,

  initialize: (config: I18nRuntimeConfig) => {
    const initialLocale = resolveInitialLocale(config);

    set({
      locale: initialLocale,
      isReady: true,
      locales: config.locales,
      defaultLocale: config.defaultLocale,
      persistSelection: config.persist,
    });

    if (config.persist) {
      writePersistedLocale(initialLocale);
    } else {
      clearPersistedLocale();
    }

    updateDocumentLocale(initialLocale);
  },

  setLocale: (locale: string) => {
    const { locales, defaultLocale, persistSelection } = get();
    const nextLocale = matchLocale(locale, locales) || defaultLocale;

    set({ locale: nextLocale });

    if (persistSelection) {
      writePersistedLocale(nextLocale);
    } else {
      clearPersistedLocale();
    }

    updateDocumentLocale(nextLocale);
  },
}));
