import { readFileSync } from 'fs';
import { join } from 'path';
import {
  APP_LOGO_PATH,
  flattenPath,
  isInside,
  sampleLogo,
} from '../components/swarm/logoPoints';

const logoSvg = readFileSync(
  join(__dirname, '../assets/icons/logo.svg'),
  'utf8'
);

describe('logo points', () => {
  it('uses the same shape as the app logo asset', () => {
    expect(logoSvg).toContain(`d="${APP_LOGO_PATH}"`);
  });

  it('returns exactly the requested number of points', () => {
    expect(sampleLogo(3000, 7)).toHaveLength(3000);
  });

  it('is the same every time for the same seed', () => {
    expect(sampleLogo(500, 7)).toEqual(sampleLogo(500, 7));
  });

  it('fits the logo height to -1..1 with the top up', () => {
    const points = sampleLogo(3000, 7);
    const ys = points.map((p) => p[1]);
    expect(Math.max(...ys)).toBeLessThanOrEqual(1);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(-1);
    expect(Math.max(...ys)).toBeGreaterThan(0.95);
  });

  it('leaves the hollow in the middle of the logo empty', () => {
    const polygon = flattenPath(APP_LOGO_PATH);
    expect(isInside(polygon, [270, 300])).toBe(false);
    expect(isInside(polygon, [40, 265])).toBe(true);
    const nearCenter = sampleLogo(3000, 7).filter(
      ([x, y]) => Math.hypot(x, y - 0.13) < 0.3
    );
    expect(nearCenter).toHaveLength(0);
  });
});
