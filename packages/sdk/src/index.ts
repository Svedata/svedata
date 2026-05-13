import { smhi } from './sources/smhi/index.js';
import { riksbanken } from './sources/riksbanken/index.js';
import { scb } from './sources/scb/index.js';

export const svedata = {
  smhi,
  riksbanken,
  scb,
} as const;

export type {
  Envelope,
  Meta,
  Money,
  Lang,
  SmhiCurrentWeather,
  CurrencyCode,
  RiksbankenExchange,
  RiksbankenPolicyRate,
  RiksbankenHistory,
  RiksbankenHistoryPoint,
  ScbLang,
  ScbTableSummary,
  ScbTable,
  ScbSearchResult,
  ScbDataset,
} from '@svedata/types';

export default svedata;
