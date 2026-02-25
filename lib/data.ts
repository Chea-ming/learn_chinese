import path from 'path';
import fs from 'fs';
import type { IndexData, TopicData } from './types';

const dataDir = path.join(process.cwd(), 'public', 'data');

export function getIndex(): IndexData {
  const raw = fs.readFileSync(path.join(dataDir, 'index.json'), 'utf-8');
  return JSON.parse(raw);
}

export function getTopicData(catId: string, topicId: string): TopicData {
  try {
    const raw = fs.readFileSync(
      path.join(dataDir, catId, `${topicId}.json`),
      'utf-8'
    );
    return JSON.parse(raw);
  } catch {
    return { sentences: [] };
  }
}
