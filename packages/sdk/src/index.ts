import { smhi } from './sources/smhi/index.js';
import { riksbanken } from './sources/riksbanken/index.js';
import { scb } from './sources/scb/index.js';
import { riksdagen } from './sources/riksdagen/index.js';
import { nordpool } from './sources/nordpool/index.js';
import { trafikverket } from './sources/trafikverket/index.js';
import { polisen } from './sources/polisen/index.js';
import { kolada } from './sources/kolada/index.js';
import { arbetsformedlingen } from './sources/arbetsformedlingen/index.js';
import { krisinformation } from './sources/krisinformation/index.js';
import { svk } from './sources/svk/index.js';
import { skolverket } from './sources/skolverket/index.js';

export const svedata = {
  smhi,
  riksbanken,
  scb,
  riksdagen,
  nordpool,
  trafikverket,
  polisen,
  kolada,
  arbetsformedlingen,
  krisinformation,
  svk,
  skolverket,
} as const;

export type {
  Envelope,
  Meta,
  MetaError,
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
  TrafikverketTrainAnnouncement,
  TrafikverketTrainsResult,
  TrafikverketSituation,
  TrafikverketSituationsResult,
  PolisenEvent,
  PolisenEventsResult,
  KoladaKpi,
  KoladaKpiSearchResult,
  KoladaMunicipality,
  KoladaMunicipalityList,
  KoladaMunicipalityType,
  KoladaGender,
  KoladaDataPoint,
  KoladaData,
  ArbetsformedlingenJobAd,
  ArbetsformedlingenSearchResult,
  KrisinformationArea,
  KrisinformationLink,
  KrisinformationNews,
  KrisinformationNewsList,
  SvkFlowPoint,
  SvkFlows,
  SvkPricePoint,
  SvkDayAheadPrices,
  SvkDatasetList,
  SkolverketSchoolType,
  SkolverketPage,
  SkolverketEducation,
  SkolverketEducationList,
  SkolverketEventLocation,
  SkolverketEvent,
  SkolverketEventList,
  SkolverketProvider,
  SkolverketProviderList,
} from '@svedata/types';

export default svedata;
