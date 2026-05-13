import { smhi } from './sources/smhi/index.js';
import { riksbanken } from './sources/riksbanken/index.js';

export const svedata = {
  smhi,
  riksbanken,
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
} from '@svedata/types';

export default svedata;
