import { smhi } from './sources/smhi/index.js';
import { riksbanken } from './sources/riksbanken/index.js';
import { scb } from './sources/scb/index.js';
import { riksdagen } from './sources/riksdagen/index.js';
import { nordpool } from './sources/nordpool/index.js';

export const svedata = {
  smhi,
  riksbanken,
  scb,
  riksdagen,
  nordpool,
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
  RiksdagenDocument,
  RiksdagenDocumentList,
  RiksdagenMember,
  RiksdagenMemberList,
  RiksdagenDocumentType,
  NordpoolArea,
  NordpoolPricePoint,
  NordpoolDailyPrices,
} from '@svedata/types';

export default svedata;
