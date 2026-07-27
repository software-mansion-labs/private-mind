import { URL_FETCH_MAX_BYTES } from '../../../constants/web';

export const isHttpUrl = (url: string): boolean => /^https?:\/\//i.test(url);

export const isPrivateHost = (rawHost: string): boolean => {
  const host = rawHost.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost')) return true;
  if (host === '::1' || host === '::') return true;
  if (/^fe80:|^fc|^fd/.test(host)) return true;
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) return false;
  const a = Number(m[1]);
  const b = Number(m[2]);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 192 && b === 168) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 100 && b >= 64 && b <= 127)
  );
};

export const assertPublicHttpUrl = (url: string): string => {
  if (!isHttpUrl(url)) {
    throw new Error(`Refusing to fetch non-http(s) url: ${url}`);
  }
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    throw new Error(`Refusing to fetch malformed url: ${url}`);
  }
  if (isPrivateHost(host)) {
    throw new Error(`Refusing to fetch private-range host: ${host}`);
  }
  return host;
};

export const enforceResponseSize = (
  response: Response,
  maxBytes: number = URL_FETCH_MAX_BYTES
): void => {
  const declaredBytes = Number(response.headers?.get?.('content-length'));
  if (Number.isFinite(declaredBytes) && declaredBytes > maxBytes) {
    throw new Error(`Response too large: ${declaredBytes} bytes`);
  }
};
