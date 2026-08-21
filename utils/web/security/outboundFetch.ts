import {
  BINARY_BODY_SIGNATURES,
  URL_FETCH_MAX_BYTES,
} from '../../../constants/web';

const XHR_HEADERS_RECEIVED = 2;

const looksBinary = (body: string): boolean =>
  BINARY_BODY_SIGNATURES.some((signature) => body.startsWith(signature));

export const isHttpUrl = (url: string): boolean => /^https?:\/\//i.test(url);

const isPrivateIPv4 = (a: number, b: number): boolean =>
  a === 0 ||
  a === 10 ||
  a === 127 ||
  (a === 169 && b === 254) ||
  (a === 192 && b === 168) ||
  (a === 172 && b >= 16 && b <= 31) ||
  (a === 100 && b >= 64 && b <= 127);

const IPV4_PART = /^(?:0x[0-9a-f]+|0[0-7]*|[1-9]\d*)$/;

const parseIPv4Part = (part: string): number | null => {
  if (!IPV4_PART.test(part)) return null;
  if (part.startsWith('0x')) return parseInt(part.slice(2), 16);
  if (part.length > 1 && part.startsWith('0'))
    return parseInt(part.slice(1), 8);
  return Number(part);
};

const ipv4LeadingOctets = (host: string): [number, number] | null => {
  const parts = host.split('.');
  if (parts.length > 4) return null;
  const values: number[] = [];
  for (const part of parts) {
    const value = parseIPv4Part(part);
    if (value === null) return null;
    values.push(value);
  }
  const last = values.pop()!;
  if (values.some((value) => value > 0xff)) return null;
  if (last > 2 ** (8 * (4 - values.length)) - 1) return null;
  const address =
    values.reduce(
      (total, value, index) => total + value * 2 ** (8 * (3 - index)),
      0
    ) + last;
  return [
    Math.floor(address / 2 ** 24) % 256,
    Math.floor(address / 2 ** 16) % 256,
  ];
};

const ipv6Groups = (host: string): number[] | null => {
  const [head, tail, extra] = host.split('::');
  if (extra !== undefined) return null;
  const toGroups = (part: string | undefined): number[] | null => {
    if (!part) return [];
    const groups: number[] = [];
    for (const hextet of part.split(':')) {
      if (!/^[0-9a-f]{1,4}$/.test(hextet)) return null;
      groups.push(parseInt(hextet, 16));
    }
    return groups;
  };
  const left = toGroups(head);
  const right = toGroups(tail);
  if (!left || !right) return null;
  if (tail === undefined) return left.length === 8 ? left : null;
  const gap = 8 - left.length - right.length;
  if (gap < 1) return null;
  return [...left, ...Array<number>(gap).fill(0), ...right];
};

export const isPrivateHost = (rawHost: string): boolean => {
  const host = rawHost
    .toLowerCase()
    .replace(/^\[|\]$/g, '')
    .replace(/\.$/, '');
  if (host === 'localhost' || host.endsWith('.localhost')) return true;

  if (host.includes(':')) {
    if (/^f[cd]/.test(host) || /^fe[89ab]/.test(host)) return true;
    const embedded = host.match(/(\d{1,3}(?:\.\d{1,3}){3})$/);
    if (embedded) return isPrivateHost(embedded[1]!);

    const groups = ipv6Groups(host);
    if (!groups) return true;
    if (groups.every((group) => group === 0)) return true;
    if (groups.slice(0, 7).every((group) => group === 0) && groups[7] === 1) {
      return true;
    }
    const mapped =
      groups.slice(0, 5).every((group) => group === 0) &&
      (groups[5] === 0 || groups[5] === 0xffff);
    if (!mapped) return false;
    return isPrivateIPv4(Math.floor(groups[6]! / 256), groups[6]! % 256);
  }

  const octets = ipv4LeadingOctets(host);
  if (octets) return isPrivateIPv4(octets[0], octets[1]);

  if (/^[\dx.]+$/i.test(host)) return true;
  return false;
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

export const fetchTextWithLimit = (
  url: string,
  {
    timeoutMs,
    signal,
    headers = {},
    maxBytes = URL_FETCH_MAX_BYTES,
    contentTypePattern,
  }: {
    timeoutMs: number;
    signal?: AbortSignal;
    headers?: Record<string, string>;
    maxBytes?: number;
    contentTypePattern?: RegExp;
  }
): Promise<string> =>
  new Promise<string>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let settled = false;

    const finish = (run: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      run();
    };
    const fail = (message: string) => {
      xhr.abort();
      finish(() => reject(new Error(message)));
    };

    const timer = setTimeout(() => fail(`Fetch timed out: ${url}`), timeoutMs);
    const onAbort = () => fail(`Fetch aborted: ${url}`);
    if (signal?.aborted) {
      finish(() => reject(new Error(`Fetch aborted: ${url}`)));
      return;
    }
    signal?.addEventListener('abort', onAbort);

    xhr.onreadystatechange = () => {
      if (xhr.readyState !== XHR_HEADERS_RECEIVED) return;
      const declaredLength = Number(
        xhr.getResponseHeader?.('content-length') ?? ''
      );
      if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
        fail(`Response too large: content-length ${declaredLength}`);
        return;
      }
      if (!contentTypePattern) return;
      const declared = xhr.getResponseHeader?.('content-type') ?? '';
      if (declared && !contentTypePattern.test(declared)) {
        fail(`Unsupported content type: ${declared}`);
      }
    };

    xhr.onprogress = (event: { loaded?: number }) => {
      if ((event?.loaded ?? 0) > maxBytes) {
        fail(`Response too large: over ${maxBytes} bytes`);
      }
    };
    xhr.onerror = () => finish(() => reject(new Error(`Fetch failed: ${url}`)));
    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        finish(() =>
          reject(new Error(`Fetch failed: ${xhr.status} ${xhr.statusText}`))
        );
        return;
      }
      const finalUrl = xhr.responseURL;
      if (finalUrl && finalUrl !== url) {
        try {
          assertPublicHttpUrl(finalUrl);
        } catch {
          finish(() =>
            reject(new Error(`Refusing redirect to private url: ${finalUrl}`))
          );
          return;
        }
      }
      const body = xhr.responseText ?? '';
      if (body.length > maxBytes) {
        finish(() =>
          reject(new Error(`Response too large: ${body.length} bytes`))
        );
        return;
      }
      if (contentTypePattern && looksBinary(body)) {
        finish(() =>
          reject(new Error(`Refusing to read a binary body: ${url}`))
        );
        return;
      }
      finish(() => resolve(body));
    };

    try {
      xhr.open('GET', url);
      for (const [name, value] of Object.entries(headers)) {
        xhr.setRequestHeader(name, value);
      }
      xhr.send();
    } catch (error) {
      finish(() => reject(error as Error));
    }
  });
