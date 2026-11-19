export type SvkFlowPoint = {
  /** Start of the interval, UTC ISO 8601 (`...Z`). */
  start: string;
  /** Start of the interval in Swedish local time, ISO 8601 without offset. */
  start_local: string;
  from: string;
  to: string;
  /** Net physical flow in MW from `from` to `to`. */
  power_mw: number;
};

export type SvkFlows = {
  date: string;
  flows: SvkFlowPoint[];
};

export type SvkPricePoint = {
  start: string;
  start_local: string;
  eur_per_mwh: number;
};

export type SvkDayAheadPrices = {
  area: string;
  date: string;
  points: SvkPricePoint[];
};

export type SvkDatasetList = {
  datasets: string[];
};
