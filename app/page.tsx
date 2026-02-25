import Link from 'next/link';
import { getIndex } from '@/lib/data';
import { SiteHeader } from '@/app/layout';

export default function HomePage() {
  const { categories } = getIndex();

  return (
    <>
      <SiteHeader />
      <div className="home-wrap page-enter">
        <div className="home-hero">
          <h1>Learn Mandarin,<br /><i>phrase by phrase.</i></h1>
          <p>
            Choose a category below. Read the characters, hear the audio,<br />
            hover words to see their meanings.
          </p>
        </div>

        <div className="cat-grid">
          {categories.map(cat => {
            const preview =
              cat.topics.slice(0, 3).map(t => t.name).join(', ') +
              (cat.topics.length > 3 ? ` +${cat.topics.length - 3}` : '');
            return (
              <Link key={cat.id} href={`/${cat.id}`} className="cat-tile">
                <div className="cat-tile-name">{cat.name}</div>
                <div className="cat-tile-count">{cat.topics.length} topics</div>
                <div className="cat-tile-preview">{preview}</div>
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}
