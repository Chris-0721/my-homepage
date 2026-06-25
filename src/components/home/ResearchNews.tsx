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

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {items.map((item, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.08 * index }}
            className="group rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 hover:scale-[1.03] bg-neutral-100 dark:bg-neutral-800"
          >
            <div className="relative w-full aspect-[3/4] overflow-hidden">
              <Image
                src={item.image}
                alt={item.title}
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-500"
                sizes="(max-width: 640px) 50vw, 25vw"
              />
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
