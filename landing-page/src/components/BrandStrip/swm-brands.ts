import { useEffect, useState } from 'react';

export const DEFAULT_BRAND_SERVICE_URL = 'https://brand.swmansion.com';

export interface SwmBrand {
  slug: string;
  alt: string;
  href?: string;
  onLight: string;
  onLightExact: boolean;
}

type ApiVariant = { url?: string | null; exact?: boolean } | null;
type ApiBrand = {
  slug?: string;
  name?: string;
  site?: string | null;
  onLight?: ApiVariant;
};

const inFlight = new Map<string, Promise<SwmBrand[]>>();

const normalise = (payload: unknown): SwmBrand[] => {
  const rows = (payload as { brands?: ApiBrand[] })?.brands;
  if (!Array.isArray(rows)) throw new Error('brand service returned no brands');

  return rows.reduce<SwmBrand[]>((acc, row) => {
    const onLight = row.onLight?.url;
    if (!row.slug || !onLight) return acc;
    acc.push({
      slug: row.slug,
      alt: row.name ?? row.slug,
      href: row.site ?? undefined,
      onLight,
      onLightExact: row.onLight?.exact !== false,
    });
    return acc;
  }, []);
};

export const fetchBrandLogos = (
  baseUrl: string = DEFAULT_BRAND_SERVICE_URL
): Promise<SwmBrand[]> => {
  const base = baseUrl.replace(/\/$/, '');
  const cached = inFlight.get(base);
  if (cached) return cached;

  const request = fetch(`${base}/api/brands?carousel=1`)
    .then((res) => {
      if (!res.ok) throw new Error(`brand service returned ${res.status}`);
      return res.json();
    })
    .then(normalise)
    .catch((err) => {
      inFlight.delete(base);
      throw err;
    });

  inFlight.set(base, request);
  return request;
};

export function useBrandLogos(baseUrl: string = DEFAULT_BRAND_SERVICE_URL) {
  const [state, setState] = useState<{
    brands: SwmBrand[];
    loading: boolean;
  }>({ brands: [], loading: true });

  useEffect(() => {
    let active = true;
    setState({ brands: [], loading: true });

    fetchBrandLogos(baseUrl)
      .then((brands) => {
        if (active) setState({ brands, loading: false });
      })
      .catch(() => {
        if (active) setState({ brands: [], loading: false });
      });

    return () => {
      active = false;
    };
  }, [baseUrl]);

  return state;
}
