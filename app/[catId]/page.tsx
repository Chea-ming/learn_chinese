import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getIndex } from '@/lib/data';
import { SiteHeader } from '@/app/layout';

interface Props {
  params: Promise<{ catId: string }>;
}

export function generateStaticParams() {
  const { categories } = getIndex();
  return categories.map(cat => ({ catId: cat.id }));
}

export async function generateMetadata({ params }: Props) {
  const { catId } = await params;
  const { categories } = getIndex();
  const cat = categories.find(c => c.id === catId);
  return { title: cat ? `${cat.name} – 汉语` : '汉语' };
}

export default async function CategoryPage({ params }: Props) {
  const { catId } = await params;
  const { categories } = getIndex();
  const cat = categories.find(c => c.id === catId);
  if (!cat) notFound();

  return (
    <>
      <SiteHeader crumbs={[{ label: cat.name }]} />
      <div className="cat-wrap page-enter">
        <div className="page-title">{cat.name}</div>
        <div className="page-sub">{cat.topics.length} topics</div>

        {cat.topics.map(topic => (
          <Link key={topic.id} href={`/${cat.id}/${topic.id}`} className="topic-row">
            <span className="tr-name">{topic.name}</span>
            <span className="tr-arrow">→</span>
          </Link>
        ))}
      </div>
    </>
  );
}
