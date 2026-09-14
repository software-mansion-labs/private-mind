import { leadingCaveat } from '../components/chat-screen/GroundingCaveatBadges';
import type { GroundingCaveatKind } from '../database/chatRepository';

describe('leadingCaveat — one badge, the most specific one', () => {
  it('shows nothing when the answer is fully grounded', () => {
    expect(leadingCaveat(undefined)).toBeNull();
    expect(leadingCaveat([])).toBeNull();
  });

  it('prefers the specific diagnosis over the general one (live-found: three badges stacked)', () => {
    expect(leadingCaveat(['figure', 'trend', 'conversion'])).toBe('conversion');
    expect(leadingCaveat(['figure', 'trend'])).toBe('trend');
    expect(leadingCaveat(['figure'])).toBe('figure');
  });

  it('does not depend on the order the detectors happened to run in', () => {
    const orders: GroundingCaveatKind[][] = [
      ['conversion', 'figure', 'trend'],
      ['trend', 'conversion', 'figure'],
      ['figure', 'conversion', 'trend'],
    ];
    for (const caveats of orders) {
      expect(leadingCaveat(caveats)).toBe('conversion');
    }
  });

  it('still names a trend when no conversion was claimed', () => {
    expect(leadingCaveat(['trend', 'figure'])).toBe('trend');
  });
});
