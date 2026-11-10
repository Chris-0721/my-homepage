'use client';

import type { MouseEvent } from 'react';

export default function ResourceGuide({ guide }: { guide: string }) {
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
      lang="zh-CN"
      onClick={openGuideDialog}
      dangerouslySetInnerHTML={{ __html: guide }}
    />
  );
}
