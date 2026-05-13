export type CurrencyCode = 'EUR' | 'USD' | 'GBP' | 'NOK' | 'DKK';

export type RiksbankenExchange = {
  date: string;
  rates: Record<CurrencyCode, number | null>;
};

export type RiksbankenPolicyRate = {
  rate: number;
  date: string;
  last_change_date: string | null;
};

export type RiksbankenHistoryPoint = {
  date: string;
  rate: number;
};

export type RiksbankenHistory = {
  pair: string;
  from: string;
  to: string;
  observations: RiksbankenHistoryPoint[];
};
