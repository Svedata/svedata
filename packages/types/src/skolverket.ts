export type SkolverketSchoolType =
  | 'AU'
  | 'AUB'
  | 'FHS'
  | 'FKLASS'
  | 'FTH'
  | 'GR'
  | 'GRAN'
  | 'GY'
  | 'GYAN'
  | 'HS'
  | 'KKU'
  | 'KU'
  | 'NY'
  | 'OPPFTH'
  | 'SAM'
  | 'SP'
  | 'STF'
  | 'VUXGR'
  | 'VUXGRAN'
  | 'VUXGY'
  | 'VUXGYAN'
  | 'VUXSFI'
  | 'YH';

export type SkolverketPage = {
  page: number;
  page_size: number;
  total: number;
};

export type SkolverketEducation = {
  id: string;
  code: string | null;
  title: string;
  description: string;
  school_type: string | null;
  education_levels: string[];
  url: string | null;
  status: string;
  last_edited: string | null;
};

export type SkolverketEducationList = SkolverketPage & {
  educations: SkolverketEducation[];
};

export type SkolverketEventLocation = {
  town: string | null;
  /** Four-digit kommunkod, e.g. '1283'. */
  municipality_code: string | null;
};

export type SkolverketEvent = {
  id: string;
  education_id: string | null;
  provider_ids: string[];
  start: string | null;
  end: string | null;
  application_deadline: string | null;
  places: number | null;
  pace_percent: number | null;
  locations: SkolverketEventLocation[];
  languages: string[];
  url: string | null;
  status: string;
  last_edited: string | null;
};

export type SkolverketEventList = SkolverketPage & {
  events: SkolverketEvent[];
};

export type SkolverketProvider = {
  id: string;
  name: string;
  url: string | null;
  town: string | null;
  responsible_body: string | null;
  status: string;
  last_edited: string | null;
};

export type SkolverketProviderList = SkolverketPage & {
  providers: SkolverketProvider[];
};
