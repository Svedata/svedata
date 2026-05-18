export const USER_AGENT = 'svedata/0.1 (+https://github.com/Svedata/svedata)';

/**
 * Wrapper around fetch that sets default Accept and User-Agent headers.
 * Most Swedish government APIs either require a User-Agent (Polisen) or
 * appreciate one (so they can track and contact us about issues). Setting
 * it from the SDK ensures every consumer of svedata identifies as svedata,
 * which is the correct routing for abuse reports.
 *
 * Caller-supplied headers in `init.headers` win over the defaults.
 */
export function svedataFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers({
    Accept: 'application/json',
    'User-Agent': USER_AGENT,
  });
  if (init.headers) {
    new Headers(init.headers).forEach((value, key) => {
      headers.set(key, value);
    });
  }
  return fetch(url, { ...init, headers });
}
