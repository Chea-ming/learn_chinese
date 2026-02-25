export interface Word {
  zh: string;
  py: string;
  meaning: string;
}

export interface Sentence {
  chinese: string;
  pinyin: string;
  translation: string;
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
