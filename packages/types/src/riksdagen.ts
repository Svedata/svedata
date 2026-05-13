export type RiksdagenDocumentType =
  | 'mot'
  | 'prop'
  | 'sou'
  | 'bet'
  | 'skr'
  | 'fr'
  | 'frs'
  | 'ip'
  | string;

export type RiksdagenDocument = {
  id: string;
  doc_id: string;
  type: string;
  title: string;
  subtitle: string;
  date: string;
  published: string;
  rm: string;
  organ: string;
  url_html: string | null;
  url_text: string | null;
};

export type RiksdagenDocumentList = {
  query: string | null;
  type: string | null;
  year: string | null;
  page: number;
  page_size: number;
  total: number;
  documents: RiksdagenDocument[];
};

export type RiksdagenMember = {
  id: string;
  first_name: string;
  last_name: string;
  sort_name: string;
  party: string;
  constituency: string;
  status: string;
  gender: string;
  born_year: number | null;
  image_url: string | null;
};

export type RiksdagenMemberList = {
  party: string | null;
  constituency: string | null;
  total: number;
  members: RiksdagenMember[];
};
