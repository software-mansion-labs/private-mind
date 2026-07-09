import { Presets, Settings } from 'react-native-pulsar';

Settings.enableSound(false);

export class Feedback {
  // Core interactions
  static send = () => Presets.ripple();
  static interrupt = () => Presets.push();
  static cancelDownload = () => Presets.push();
  static attach = () => Presets.dewdrop();
  static toggleOn = () => Presets.snap();
  static toggleOff = () => Presets.snap();
  static destructive = () => Presets.cleave();

  // Navigation — barely-there
  static sheetOpen = () => Presets.chip();
  static drawer = () => Presets.chip();

  // Async completions
  static firstToken = () => Presets.peck();
  static downloadStart = () => Presets.snap();
  static downloadComplete = () => Presets.lock();
  static benchmarkComplete = () => Presets.fanfare();
  static onboardingComplete = () => Presets.bloom();
  static editSave = () => Presets.lock();
}
