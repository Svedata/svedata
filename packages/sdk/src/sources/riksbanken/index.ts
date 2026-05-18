import type {
  CurrencyCode,
  Envelope,
  RiksbankenExchange,
  RiksbankenHistory,
  RiksbankenPolicyRate,
} from '@svedata/types';
import { empty, makeMeta, ok } from '../../lib/envelope.js';

const SOURCE = 'riksbanken';
const BASE_URL = 'https://api.riksbank.se/swea/v1';
const POLICY_SERIES = 'SECBREPOEFF';
const FX_GROUP_ID = 130;

const FX_SERIES: Record<CurrencyCode, string> = {
  EUR: 'SEKEURPMI',
  USD: 'SEKUSDPMI',
  GBP: 'SEKGBPPMI',
  NOK: 'SEKNOKPMI',
  DKK: 'SEKDKKPMI',
};

const SERIES_TO_CODE: Record<string, CurrencyCode> = Object.fromEntries(
  (Object.entries(FX_SERIES) as [CurrencyCode, string][]).map(([code, id]) => [id, code]),
);

type LatestObservation = { date: string; value: number };
type RangeObservation = { date: string; value: number };
type GroupObservation = { seriesId: string; date: string; value: number };

const MAX_RETRY_WAIT_SECONDS = 10;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function parse429WaitSeconds(res: Response): Promise<number | null> {
  const header = res.headers.get('Retry-After');
  if (header) {
    const sec = Number.parseInt(header, 10);
    if (Number.isFinite(sec) && sec >= 0) return sec;
  }
  try {
    const body = (await res.clone().json()) as { message?: string };
    const m = body.message?.match(/try again in (\d+)\s*seconds?/i);
    if (m) return Number.parseInt(m[1]!, 10);
  } catch {
    // not JSON — fall through
  }
  return null;
}

async function rawFetch<T>(
  path: string,
): Promise<
  | { kind: 'ok'; body: T }
  | { kind: 'empty' }
  | { kind: 'rate_limited'; waitSeconds: number | null }
> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { Accept: 'application/json' },
  });
  if (res.status === 429) {
    return { kind: 'rate_limited', waitSeconds: await parse429WaitSeconds(res) };
  }
  if (!res.ok) return { kind: 'empty' };
  const body = (await res.json()) as T;
  return { kind: 'ok', body };
}

async function fetchJson<T>(
  path: string,
): Promise<{ kind: 'ok'; body: T } | { kind: 'empty' } | { kind: 'rate_limited' }> {
  const first = await rawFetch<T>(path);
  if (first.kind !== 'rate_limited') return first;

  // One retry, only if the upstream tells us a short wait. Riksbanken's
  // sticky 429 behaviour means quick blind retries can reset the cooldown
  // — only wait when the server gave us a number, and cap it.
  const wait = first.waitSeconds;
  if (wait === null || wait > MAX_RETRY_WAIT_SECONDS) {
    return { kind: 'rate_limited' };
  }
  await sleep(wait * 1000);
  const second = await rawFetch<T>(path);
  if (second.kind === 'rate_limited') return { kind: 'rate_limited' };
  return second;
}

function normalizePair(pair: string): CurrencyCode | null {
  const cleaned = pair.toUpperCase().replace(/[^A-Z]/g, '');
  const code = cleaned.startsWith('SEK') ? cleaned.slice(3, 6) : cleaned.slice(0, 3);
  if (code in FX_SERIES) return code as CurrencyCode;
  return null;
}

export const riksbanken = {
  async exchange(): Promise<Envelope<RiksbankenExchange>> {
    const result = await fetchJson<GroupObservation[]>(
      `/Observations/Latest/ByGroup/${FX_GROUP_ID}`,
    );
    if (result.kind === 'rate_limited') return empty(makeMeta(SOURCE, 0, false, 'rate_limited'));
    if (result.kind === 'empty') return empty(makeMeta(SOURCE));

    const rates: Record<CurrencyCode, number | null> = {
      EUR: null,
      USD: null,
      GBP: null,
      NOK: null,
      DKK: null,
    };
    let latestDate: string | null = null;
    for (const obs of result.body) {
      const code = SERIES_TO_CODE[obs.seriesId];
      if (!code) continue;
      rates[code] = obs.value;
      if (!latestDate || obs.date > latestDate) latestDate = obs.date;
    }

    if (!latestDate) return empty(makeMeta(SOURCE));
    return ok({ date: latestDate, rates }, makeMeta(SOURCE));
  },

  async policy(): Promise<Envelope<RiksbankenPolicyRate>> {
    const latest = await fetchJson<LatestObservation>(
      `/Observations/Latest/${POLICY_SERIES}`,
    );
    if (latest.kind === 'rate_limited') return empty(makeMeta(SOURCE, 0, false, 'rate_limited'));
    if (latest.kind === 'empty') return empty(makeMeta(SOURCE));

    const fromDate = new Date(latest.body.date);
    fromDate.setUTCFullYear(fromDate.getUTCFullYear() - 3);
    const from = fromDate.toISOString().slice(0, 10);

    const range = await fetchJson<RangeObservation[]>(
      `/Observations/${POLICY_SERIES}/${from}/${latest.body.date}`,
    );

    let lastChange: string | null = null;
    if (range.kind === 'ok' && range.body.length > 0) {
      const series = range.body;
      const current = latest.body.value;
      for (let i = series.length - 1; i >= 0; i--) {
        if (series[i]!.value !== current) {
          lastChange = series[i + 1]?.date ?? null;
          break;
        }
        if (i === 0) lastChange = series[0]!.date;
      }
    }

    return ok(
      { rate: latest.body.value, date: latest.body.date, last_change_date: lastChange },
      makeMeta(SOURCE),
    );
  },

  async history(
    pair: string,
    from: string,
    to: string,
  ): Promise<Envelope<RiksbankenHistory>> {
    const code = normalizePair(pair);
    if (!code) return empty(makeMeta(SOURCE));

    const seriesId = FX_SERIES[code];
    const result = await fetchJson<RangeObservation[]>(
      `/Observations/${seriesId}/${from}/${to}`,
    );

    if (result.kind === 'rate_limited') return empty(makeMeta(SOURCE, 0, false, 'rate_limited'));
    if (result.kind === 'empty') return empty(makeMeta(SOURCE));

    return ok(
      {
        pair: `${code}/SEK`,
        from,
        to,
        observations: result.body.map((o) => ({ date: o.date, rate: o.value })),
      },
      makeMeta(SOURCE),
    );
  },
};

export { FX_SERIES, POLICY_SERIES, FX_GROUP_ID, BASE_URL };
