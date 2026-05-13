export type NordpoolArea = 'SE1' | 'SE2' | 'SE3' | 'SE4';

export type NordpoolPricePoint = {
  start: string;
  end: string;
  sek_per_kwh: number;
  eur_per_kwh: number;
  exr: number;
};

export type NordpoolDailyPrices = {
  area: NordpoolArea;
  date: string;
  prices: NordpoolPricePoint[];
};
