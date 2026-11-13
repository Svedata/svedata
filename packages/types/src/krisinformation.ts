export type KrisinformationArea = {
  /** 'Country', 'County' or 'Municipality'. */
  type: string;
  name: string;
};

export type KrisinformationLink = {
  text: string;
  url: string;
};

export type KrisinformationNews = {
  id: string;
  headline: string;
  preamble: string;
  body: string;
  published: string;
  updated: string;
  url: string | null;
  language: string;
  areas: KrisinformationArea[];
  links: KrisinformationLink[];
};

export type KrisinformationNewsList = {
  total: number;
  news: KrisinformationNews[];
};
