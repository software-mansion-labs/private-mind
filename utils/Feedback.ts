import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

export class Feedback {
  static soft = () => {
    if (Platform.OS === 'ios')
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  static success = () => {
    if (Platform.OS === 'ios')
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };
}
