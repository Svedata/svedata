export type ScbLang = 'en' | 'sv';

export type ScbTableSummary = {
  id: string;
  label: string;
  description: string;
  updated: string;
  first_period: string;
  last_period: string;
  variable_names: string[];
  source: string;
  subject_code: string;
  time_unit: string;
};

export type ScbSearchResult = {
  query: string | null;
  page: number;
  page_size: number;
  total: number;
  tables: ScbTableSummary[];
};

export type ScbTable = ScbTableSummary & {
  paths: { id: string; label: string }[][];
};

export type ScbDataset = {
  table_id: string;
  label: string;
  source: string;
  updated: string;
  jsonstat: unknown;
};
