'use client';

import type { MouseEvent } from 'react';
import { useLocaleStore } from '@/lib/stores/localeStore';

export default function ResourceGuide({ chinese, english }: { chinese: string; english: string }) {
  const locale = useLocaleStore((state) => state.locale);
  const isEnglish = locale === 'en';

  function openGuideDialog(event: MouseEvent<HTMLDivElement>) {
    if (!(event.target instanceof Element)) return;

    const trigger = event.target.closest<HTMLButtonElement>('button[data-dialog]');
    if (!trigger?.dataset.dialog) return;

    const dialog = document.getElementById(trigger.dataset.dialog);
    if (dialog instanceof HTMLDialogElement && event.currentTarget.contains(dialog)) {
      dialog.showModal();
      dialog.scrollTop = 0;
    }
  }

  return (
    <div
      className="resource-guide"
      lang={isEnglish ? 'en' : 'zh-CN'}
      onClick={openGuideDialog}
      dangerouslySetInnerHTML={{ __html: isEnglish ? english : chinese }}
    />
  );
}
