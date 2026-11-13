import { Presets } from 'react-native-pulsar';

export const DOTS_APPEAR_AT = 0.02;
export const TEXT_LANDED_AT = 0.87;

type Cue = () => void;

export interface SwarmHapticCues {
  start?: Cue;
  land?: Cue;
  badge?: Cue;
}

const dewdrop = () => {
  'worklet';
  Presets.dewdrop();
};

const selectionTick = () => {
  'worklet';
  Presets.System.selection();
};

export const NO_HAPTIC_CUES: SwarmHapticCues = {};

export const SWARM_HAPTIC_CUES: SwarmHapticCues = {
  start: dewdrop,
  land: dewdrop,
  badge: selectionTick,
};
