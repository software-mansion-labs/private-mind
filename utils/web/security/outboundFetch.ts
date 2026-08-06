import {
  BINARY_BODY_SIGNATURES,
  URL_FETCH_MAX_BYTES,
} from '../../../constants/web';

const XHR_HEADERS_RECEIVED = 2;

const looksBinary = (body: string): boolean =>
  BINARY_BODY_SIGNATURES.some((signature) => body.startsWith(signature));

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
      if (xhr.readyState !== XHR_HEADERS_RECEIVED || !contentTypePattern)
        return;
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
