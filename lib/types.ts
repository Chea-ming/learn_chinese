export interface Word {
  zh: string;
  py: string;
  meaning: string;
}

export interface Sentence {
  chinese: string;
  pinyin: string;
  translation: string;
  usage?: string;
  formality?: string;
  words?: Word[];
}

export interface Topic {
  id: string;
  name: string;
}

export interface Category {
  id: string;
  name: string;
  topics: Topic[];
}

export interface IndexData {
  categories: Category[];
}

export interface TopicData {
  sentences: Sentence[];
}

// Rotating Mandarin neural voices (must match whitelist in /api/tts/route.ts)
export const TTS_VOICES = [
  'zh-CN-XiaoxiaoNeural', // female, warm
  'zh-CN-YunxiNeural',    // male, youthful
  'zh-CN-YunyangNeural',  // male, neutral
  'zh-CN-XiaoyiNeural',   // female, youthful
  'zh-CN-XiaoxuanNeural'
] as const;

export type TtsVoice = (typeof TTS_VOICES)[number];
