export type HavAdvice = {
  starts_at: string;
  reason: string;
  description: string;
};

export type HavAbnormalSituation = {
  starts_at: string;
  ends_at: string | null;
  description: string;
};

export type HavBathingWater = {
  /** EU bathing water id, e.g. 'SE0441264000000306'. */
  id: string;
  name: string;
  description: string;
  municipality: string | null;
  /** Four-digit kommunkod, e.g. '1264'. */
  municipality_code: string | null;
  /** 'Hav', 'Sjö', 'Vattendrag' or 'Delta'. */
  water_type: string | null;
  eu_bathing_water: boolean;
  latitude: number | null;
  longitude: number | null;
  advice_against_bathing: HavAdvice[];
  abnormal_situations: HavAbnormalSituation[];
};

export type HavBathingWaterList = {
  total: number;
  bathing_waters: HavBathingWater[];
};

export type HavMeasurement = {
  count: number | null;
  /** '<', '=' or '>' relative to `count`. */
  prefix: string | null;
  assessment: string | null;
};

export type HavSampleResult = {
  taken_at: string;
  assessment: string | null;
  e_coli: HavMeasurement;
  intestinal_enterococci: HavMeasurement;
  algae: string | null;
  water_temp: number | null;
  weather: string | null;
};

export type HavResults = {
  id: string;
  results: HavSampleResult[];
};

export type HavForecastPoint = {
  /** Hour of day (0–23) in Swedish local time that the forecast refers to. */
  hour: number;
  water_temp: number;
};

export type HavForecast = {
  bathing_water_id: string;
  points: HavForecastPoint[];
};

export type HavForecastList = {
  forecasts: HavForecast[];
};
