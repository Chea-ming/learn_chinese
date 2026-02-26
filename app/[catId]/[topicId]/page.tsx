import { notFound } from 'next/navigation';
import { getIndex, getTopicData } from '@/lib/data';
import { TTS_VOICES } from '@/lib/types';
import { SiteHeader } from '@/app/layout';
import SentenceBlock from '@/app/components/SentenceBlock';

interface Props {
  params: Promise<{ catId: string; topicId: string }>;
}

export function generateStaticParams() {
  const { categories } = getIndex();
  return categories.flatMap(cat =>
    cat.topics.map(topic => ({ catId: cat.id, topicId: topic.id }))
  );
}

export async function generateMetadata({ params }: Props) {
  const { catId, topicId } = await params;
  const { categories } = getIndex();
  const cat = categories.find(c => c.id === catId);
  const topic = cat?.topics.find(t => t.id === topicId);
  return { title: topic ? `${topic.name} – 汉语` : '汉语' };
}

export default async function TopicPage({ params }: Props) {
  const { catId, topicId } = await params;
  const { categories } = getIndex();
  const cat = categories.find(c => c.id === catId);
  if (!cat) notFound();
  const topic = cat.topics.find(t => t.id === topicId);
  if (!topic) notFound();

  const { sentences } = getTopicData(catId, topicId);

  return (
    <>
      <SiteHeader
        crumbs={[
          { label: cat.name, href: `/${catId}` },
          { label: topic.name },
        ]}
      />
      <div className="topic-wrap page-enter">
        <div className="topic-head">
          <h2>{topic.name}</h2>
          <div className="topic-count-label">
            {sentences.length} sentence{sentences.length !== 1 ? 's' : ''}
          </div>
        </div>
        <div className="topic-divider" />

        {sentences.length === 0 ? (
          <div className="empty-state">
            <span className="ez">暂无</span>
            <p>
              No sentences yet.<br />
              Add them to <code>public/data/{catId}/{topicId}.json</code>
            </p>
          </div>
        ) : (
          sentences.map((s, i) => (
            <SentenceBlock key={i} sentence={s} index={i} voice={TTS_VOICES[i % TTS_VOICES.length]} />
          ))
        )}
      </div>
    </>
  );
}
