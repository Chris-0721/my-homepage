'use client';

import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

export interface ResearchNewsItem {
  title: string;
  journal: string;
  image: string;
  description: string;
}

interface ResearchNewsProps {
  items: ResearchNewsItem[];
  title?: string;
  /** 图框版式：默认 landscape（4:3 裁切）；期刊封面等竖版图用 'portrait'（3:4 + 完整显示） */
  shape?: 'landscape' | 'portrait';
}

export default function ResearchNews({ items, title, shape = 'landscape' }: ResearchNewsProps) {
  const isPortrait = shape === 'portrait';
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const close = useCallback(() => setActiveIndex(null), []);
  const step = useCallback(
    (delta: number) =>
      setActiveIndex((current) => {
        if (current === null) return current;
        return (current + delta + items.length) % items.length;
      }),
    [items.length]
  );

  // 灯箱打开时：Esc 关闭、左右键切换，并锁定页面滚动
  useEffect(() => {
    if (activeIndex === null) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
      else if (event.key === 'ArrowLeft') step(-1);
      else if (event.key === 'ArrowRight') step(1);
    };

    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [activeIndex, close, step]);

  if (!items || items.length === 0) return null;

  const active = activeIndex === null ? null : items[activeIndex];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="space-y-4"
    >
      {title && (
        <h2 className="text-2xl font-serif font-bold text-primary mb-4 pb-2 border-b-2 border-accent inline-block">
          {title}
        </h2>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {items.map((item, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.06 * index }}
            className="group bg-neutral-100 dark:bg-neutral-800 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 hover:scale-[1.02]"
          >
            {/* Cover Image —— 点击放大 */}
            <button
              type="button"
              onClick={() => setActiveIndex(index)}
              aria-label={`放大查看：${item.title}`}
              className={`relative block w-full overflow-hidden cursor-zoom-in focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                isPortrait
                  ? 'aspect-[3/4] bg-white dark:bg-neutral-800'
                  : 'aspect-[4/3] bg-neutral-200 dark:bg-neutral-700'
              }`}
            >
              <Image
                src={item.image}
                alt={item.title}
                fill
                className={`${isPortrait ? 'object-contain' : 'object-cover'} group-hover:scale-105 transition-transform duration-500`}
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              />
            </button>

            {/* Card Content */}
            <div className="p-2.5 space-y-1">
              <h3 className="font-semibold text-primary text-xs leading-snug line-clamp-2 group-hover:text-accent transition-colors duration-200">
                {item.title}
              </h3>
              <p className="text-[10px] font-medium text-accent line-clamp-1">
                {item.journal}
              </p>
              <p className="text-[11px] text-neutral-600 dark:text-neutral-400 leading-relaxed line-clamp-2">
                {item.description}
              </p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {active && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={close}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-label={active.title}
          >
            <button
              type="button"
              onClick={close}
              aria-label="关闭"
              className="absolute top-4 right-4 z-10 rounded-full p-2 text-white/80 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>

            {items.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    step(-1);
                  }}
                  aria-label="上一张"
                  className="absolute left-2 sm:left-6 z-10 rounded-full p-2 text-white/80 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <ChevronLeft className="w-8 h-8" />
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    step(1);
                  }}
                  aria-label="下一张"
                  className="absolute right-2 sm:right-6 z-10 rounded-full p-2 text-white/80 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <ChevronRight className="w-8 h-8" />
                </button>
              </>
            )}

            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={(event) => event.stopPropagation()}
              className="flex flex-col items-center max-h-full"
            >
              <div className="relative w-[88vw] h-[70vh] max-w-5xl">
                <Image
                  src={active.image}
                  alt={active.title}
                  fill
                  className="object-contain"
                  sizes="88vw"
                  priority
                />
              </div>
              <div className="mt-3 max-w-3xl text-center px-4">
                <p className="text-sm font-semibold text-white">{active.title}</p>
                <p className="mt-1 text-xs text-accent">{active.journal}</p>
                <p className="mt-1.5 text-xs leading-relaxed text-neutral-300">
                  {active.description}
                </p>
                <p className="mt-2 text-[11px] text-neutral-500">
                  {activeIndex! + 1} / {items.length} · 点击空白处或按 Esc 关闭
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
