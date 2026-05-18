import type {
  Envelope,
  TrafikverketSituation,
  TrafikverketSituationsResult,
  TrafikverketTrainAnnouncement,
  TrafikverketTrainsResult,
} from '@svedata/types';
import { empty, makeMeta, ok } from '../../lib/envelope.js';
import { svedataFetch } from '../../lib/http.js';

const SOURCE = 'trafikverket';
const BASE_URL = 'https://api.trafikinfo.trafikverket.se/v2/data.json';

const TRAIN_SCHEMA = '1.9';
const SITUATION_SCHEMA = '1.5';

let configuredApiKey: string | undefined;

export function configure(config: { apiKey: string }): void {
  configuredApiKey = config.apiKey;
}

function readEnv(name: string): string | undefined {
  const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
  return proc?.env?.[name];
}

function getApiKey(): string {
  const key = configuredApiKey ?? readEnv('TRAFIKVERKET_API_KEY');
  if (!key) {
    throw new Error(
      'Trafikverket API key not configured. Call svedata.trafikverket.configure({ apiKey }) or set TRAFIKVERKET_API_KEY.',
    );
  }
  return key;
}

type TvResult = Record<string, unknown> & {
  ERROR?: { SOURCE?: string; MESSAGE?: string };
};

type TvResponse = {
  RESPONSE: { RESULT: TvResult[] };
};

type PostResult<T> =
  | { kind: 'ok'; rows: T[] }
  | { kind: 'not_found' }
  | { kind: 'rate_limited' }
  | { kind: 'upstream_error' };

async function postQuery<T>(query: string): Promise<PostResult<T>> {
  const apiKey = getApiKey();
  const body = `<REQUEST><LOGIN authenticationkey="${apiKey}"/>${query}</REQUEST>`;
  let res: Response;
  try {
    res = await svedataFetch(BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml' },
      body,
    });
  } catch {
    return { kind: 'upstream_error' };
  }

  if (res.status === 401 || res.status === 403) {
    throw new Error(`Trafikverket auth failed (HTTP ${res.status})`);
  }
  if (res.status === 404) return { kind: 'not_found' };
  if (res.status === 429) return { kind: 'rate_limited' };
  if (!res.ok) return { kind: 'upstream_error' };

  let json: TvResponse;
  try {
    json = (await res.json()) as TvResponse;
  } catch {
    return { kind: 'upstream_error' };
  }
  const result = json.RESPONSE?.RESULT?.[0];
  if (!result) return { kind: 'upstream_error' };
  if (result.ERROR) throw new Error(`Trafikverket error: ${result.ERROR.MESSAGE ?? 'unknown'}`);

  for (const value of Object.values(result)) {
    if (Array.isArray(value)) return { kind: 'ok', rows: value as T[] };
  }
  return { kind: 'ok', rows: [] };
}

function emptyTv<T>(kind: 'not_found' | 'rate_limited' | 'upstream_error'): Envelope<T> {
  if (kind === 'rate_limited') return empty(makeMeta(SOURCE, 0, false, 'rate_limited'));
  return empty(makeMeta(SOURCE, null, false, kind));
}

type RawTrain = {
  ActivityId: string;
  ActivityType?: string;
  AdvertisedTrainIdent?: string;
  FromLocation?: string[];
  ToLocation?: string[];
  AdvertisedTimeAtLocation?: string;
  EstimatedTimeAtLocation?: string;
  TimeAtLocation?: string;
  Canceled?: boolean;
  Deviation?: { Description?: string }[];
};

type RawSituation = {
  Id: string;
  ModifiedTime?: string;
  Deviation?: {
    CountyNo?: number[];
    Message?: string;
    RoadNumber?: string;
    SeverityText?: string;
  }[];
};

function mapTrain(t: RawTrain): TrafikverketTrainAnnouncement {
  return {
    activity_id: t.ActivityId,
    activity_type: t.ActivityType ?? '',
    advertised_train_ident: t.AdvertisedTrainIdent ?? '',
    from_location: t.FromLocation ?? [],
    to_location: t.ToLocation ?? [],
    advertised_time_at_location: t.AdvertisedTimeAtLocation ?? null,
    estimated_time_at_location: t.EstimatedTimeAtLocation ?? null,
    time_at_location: t.TimeAtLocation ?? null,
    canceled: t.Canceled === true,
    deviation: (t.Deviation ?? []).map((d) => d.Description ?? '').filter(Boolean),
  };
}

function mapSituation(s: RawSituation): TrafikverketSituation {
  const d = s.Deviation?.[0];
  return {
    id: s.Id,
    modified_time: s.ModifiedTime ?? '',
    county_no: d?.CountyNo ?? [],
    message: d?.Message ?? null,
    road_number: d?.RoadNumber ?? null,
    severity_text: d?.SeverityText ?? null,
  };
}

export type TrafikverketTrainsOptions = {
  limit?: number;
  station?: string;
};

export type TrafikverketSituationsOptions = {
  limit?: number;
  county?: number;
};

export const trafikverket = {
  configure,

  async trains(
    options: TrafikverketTrainsOptions = {},
  ): Promise<Envelope<TrafikverketTrainsResult>> {
    const limit = options.limit ?? 20;
    const filter = options.station
      ? `<FILTER><OR><EQ name="FromLocation.LocationSignature" value="${options.station}"/><EQ name="ToLocation.LocationSignature" value="${options.station}"/></OR></FILTER>`
      : '<FILTER/>';
    const query = `<QUERY objecttype="TrainAnnouncement" schemaversion="${TRAIN_SCHEMA}" limit="${limit}" orderby="AdvertisedTimeAtLocation">${filter}</QUERY>`;

    const result = await postQuery<RawTrain>(query);
    if (result.kind !== 'ok') return emptyTv<TrafikverketTrainsResult>(result.kind);

    return ok(
      { total: result.rows.length, trains: result.rows.map(mapTrain) },
      makeMeta(SOURCE),
    );
  },

  async situations(
    options: TrafikverketSituationsOptions = {},
  ): Promise<Envelope<TrafikverketSituationsResult>> {
    const limit = options.limit ?? 20;
    const filter =
      options.county !== undefined
        ? `<FILTER><EQ name="Deviation.CountyNo" value="${options.county}"/></FILTER>`
        : '<FILTER/>';
    const query = `<QUERY objecttype="Situation" schemaversion="${SITUATION_SCHEMA}" limit="${limit}">${filter}</QUERY>`;

    const result = await postQuery<RawSituation>(query);
    if (result.kind !== 'ok') return emptyTv<TrafikverketSituationsResult>(result.kind);

    return ok(
      { total: result.rows.length, situations: result.rows.map(mapSituation) },
      makeMeta(SOURCE),
    );
  },
};

export { BASE_URL };
