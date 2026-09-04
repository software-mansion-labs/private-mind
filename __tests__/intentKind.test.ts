import { parseIntentKind } from '../utils/web/intentKind';

describe('kinds added after the intent round', () => {
  it('accepts place, person and event', () => {
    expect(parseIntentKind('place')).toBe('place');
    expect(parseIntentKind('Person')).toBe('person');
    expect(parseIntentKind('event')).toBe('event');
  });

  it('still rejects a kind the planner made up', () => {
    expect(parseIntentKind('shopping')).toBeUndefined();
  });
});
