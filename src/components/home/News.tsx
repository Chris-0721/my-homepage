'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useMessages } from '@/lib/i18n/useMessages';

export interface NewsItem {
    date: string;
    content: string;
}

interface NewsProps {
    items: NewsItem[];
    title?: string;
    /** 折叠状态下显示的条数，缺省 6 */
    initialCount?: number;
}

export default function News({ items, title, initialCount = 6 }: NewsProps) {
    const messages = useMessages();
    const resolvedTitle = title || messages.home.news;
    const [expanded, setExpanded] = useState(false);

    const hasMore = items.length > initialCount;
    const visibleItems = expanded || !hasMore ? items : items.slice(0, initialCount);

    return (
        <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
        >
            <h2 className="text-2xl font-serif font-bold text-primary mb-4">{resolvedTitle}</h2>
            <div className="space-y-3">
                {visibleItems.map((item, index) => (
                    <div key={index} className="flex items-start space-x-3">
                        <span className="text-xs text-neutral-500 mt-1 w-16 flex-shrink-0">{item.date}</span>
                        <p className="text-sm text-neutral-700 dark:text-neutral-300">{item.content}</p>
                    </div>
                ))}
            </div>
            {hasMore && (
                <div className="mt-4 flex justify-end">
                    <button
                        type="button"
                        onClick={() => setExpanded((value) => !value)}
                        aria-expanded={expanded}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-accent hover:bg-accent/10 transition-colors"
                    >
                        {expanded
                            ? messages.home.collapse
                            : `${messages.home.expand} · ${items.length}`}
                        {expanded ? (
                            <ChevronUp className="w-3.5 h-3.5" />
                        ) : (
                            <ChevronDown className="w-3.5 h-3.5" />
                        )}
                    </button>
                </div>
            )}
        </motion.section>
    );
}
