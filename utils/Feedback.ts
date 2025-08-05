import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/*
    Haptic feedback is only used on iOS as it offers very subtle and precise feedback which
    brings joy and happiness to your soul :)
*/

export class Feedback {
  static light() {
    if (Platform.OS === 'ios')
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  static medium() {
    if (Platform.OS === 'ios')
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }

  static heavy() {
    if (Platform.OS === 'ios')
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  }

  static soft = () => {
    if (Platform.OS === 'ios')
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  static success = () => {
    if (Platform.OS === 'ios')
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  static selection = () => {
    if (Platform.OS === 'ios') Haptics.selectionAsync();
  };
}
