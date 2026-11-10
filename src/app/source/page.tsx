import type { Metadata } from 'next';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import ResourceGuide from './ResourceGuide';
import './source.css';

const description = 'X² 实验室资源页，汇集学术网站、文献检索、科研软件和光学书签。';

export const metadata: Metadata = {
  title: '资源',
  description,
  alternates: { canonical: '/source/' },
  openGraph: {
    title: '资源 · X² Lab',
    description,
    url: '/source/',
  },
};

export default function SourcePage() {
  const guide = readFileSync(join(process.cwd(), 'src/app/source/guide.html'), 'utf8');
  return <ResourceGuide guide={guide} />;
}
