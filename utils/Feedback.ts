import { Presets } from 'react-native-pulsar';

export class Feedback {
  static drawer = () => Presets.thud();
  static firstToken = () => Presets.chime();
  static toggleOn = () => Presets.snap();
  static toggleOff = () => Presets.latch();
  static listSelect = () => Presets.ping();
  static send = () => Presets.chip();
  static interrupt = () => Presets.push();
  static attach = () => Presets.peck();
  static speech = () => Presets.murmur();
  static destructive = () => Presets.cleave();
  static downloadComplete = () => Presets.lock();
  static benchmarkStart = () => Presets.charge();
  static benchmarkComplete = () => Presets.fanfare();
  static onboardingComplete = () => Presets.bloom();
  static sheetOpen = () => Presets.thud();
  static sheetClose = () => Presets.fadeOut();
  static thinkingExpand = () => Presets.push();

  static light = () => Presets.peck();
  static medium = () => Presets.ping();
  static heavy = () => Presets.strike();
  static soft = () => Presets.thud();
  static success = () => Presets.chime();
  static selection = () => Presets.snap();
}
