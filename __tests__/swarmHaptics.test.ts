import { Presets } from 'react-native-pulsar';
import {
  DOTS_APPEAR_AT,
  NO_HAPTIC_CUES,
  SWARM_HAPTIC_CUES,
  TEXT_LANDED_AT,
} from '../components/swarm/swarmHaptics';

describe('swarm haptic cues', () => {
  beforeEach(() => jest.clearAllMocks());

  it('taps as the dots appear, before the text lands', () => {
    expect(DOTS_APPEAR_AT).toBeLessThan(TEXT_LANDED_AT);
  });

  it('plays a dewdrop as the dots appear and again as the text lands', () => {
    SWARM_HAPTIC_CUES.start?.();
    SWARM_HAPTIC_CUES.land?.();
    expect(Presets.dewdrop).toHaveBeenCalledTimes(2);
  });

  it('clicks once when the badge appears', () => {
    SWARM_HAPTIC_CUES.badge?.();
    expect(Presets.System.selection).toHaveBeenCalledTimes(1);
  });

  it('has nothing to play when the animation is skipped', () => {
    expect(NO_HAPTIC_CUES).toEqual({});
  });
});
