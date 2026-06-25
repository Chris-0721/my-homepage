'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';

export interface ResearchNewsItem {
  title: string;
  journal: string;
  image: string;
  description: string;
}

interface ResearchNewsProps {
  items: ResearchNewsItem[];
  title?: string;
}

export default function ResearchNews({ items, title }: ResearchNewsProps) {
  if (!items || items.length === 0) return null;

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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {items.map((item, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 * index }}
            className="group bg-neutral-100 dark:bg-neutral-800 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 hover:scale-[1.02]"
          >
            {/* Cover Image */}
            <div className="relative w-full aspect-[4/3] overflow-hidden bg-neutral-200 dark:bg-neutral-700">
              <Image
                src={item.image}
                alt={item.title}
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-500"
                sizes="(max-width: 640px) 100vw, 50vw"
              />
            </div>

            {/* Card Content */}
            <div className="p-4 space-y-2">
              <h3 className="font-semibold text-primary text-sm leading-snug line-clamp-2 group-hover:text-accent transition-colors duration-200">
                {item.title}
              </h3>
              <p className="text-xs font-medium text-accent">
                {item.journal}
              </p>
              <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed line-clamp-2">
                {item.description}
              </p>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
