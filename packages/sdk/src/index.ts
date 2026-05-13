import { smhi } from './sources/smhi/index.js';

export const svedata = {
  smhi,
} as const;

export type { Envelope, Meta, Money, Lang, SmhiCurrentWeather } from '@svedata/types';

export default svedata;
