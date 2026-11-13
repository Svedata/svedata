export type KoladaKpi = {
  id: string;
  title: string;
  description: string;
  operating_area: string;
  is_divided_by_gender: boolean;
  /** 'K' = municipalities, 'L' = regions, 'A' = both. */
  municipality_type: string;
  publication_date: string | null;
};

export type KoladaKpiSearchResult = {
  query: string;
  total: number;
  kpis: KoladaKpi[];
};

export type KoladaMunicipalityType = 'municipality' | 'region';

export type KoladaMunicipality = {
  /** Four-digit code: kommunkod (e.g. '1281' Lund) or region code (e.g. '0012' Region Skåne). */
  id: string;
  title: string;
  type: KoladaMunicipalityType;
};

export type KoladaMunicipalityList = {
  total: number;
  municipalities: KoladaMunicipality[];
};

export type KoladaGender = 'total' | 'male' | 'female';

export type KoladaDataPoint = {
  municipality: string;
  period: number;
  gender: KoladaGender;
  value: number | null;
  /** Upstream status flag, e.g. '' (ok) or 'Missing'. */
  status: string;
};

export type KoladaData = {
  kpi: string;
  points: KoladaDataPoint[];
};
