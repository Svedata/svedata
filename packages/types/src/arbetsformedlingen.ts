export type ArbetsformedlingenJobAd = {
  id: string;
  headline: string;
  description: string;
  url: string;
  employer_name: string | null;
  workplace: string | null;
  occupation: string | null;
  occupation_group: string | null;
  occupation_field: string | null;
  employment_type: string | null;
  working_hours: string | null;
  vacancies: number | null;
  municipality: string | null;
  municipality_code: string | null;
  region: string | null;
  region_code: string | null;
  latitude: number | null;
  longitude: number | null;
  /** Swedish local time, ISO 8601 without offset (as published upstream). */
  published: string;
  /** Swedish local time, ISO 8601 without offset, or null if not set. */
  application_deadline: string | null;
};

export type ArbetsformedlingenSearchResult = {
  total: number;
  offset: number;
  jobs: ArbetsformedlingenJobAd[];
};
