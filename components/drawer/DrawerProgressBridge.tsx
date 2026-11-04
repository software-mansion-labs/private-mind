import { useDrawerProgress } from 'expo-router/drawer';
import {
  runOnJS,
  SharedValue,
  useAnimatedReaction,
} from 'react-native-reanimated';

interface Props {
  target: SharedValue<number>;
  onScreenDisplacedChange: (displaced: boolean) => void;
}

const DrawerProgressBridge = ({ target, onScreenDisplacedChange }: Props) => {
  const progress = useDrawerProgress();

  useAnimatedReaction(
    () => progress.get(),
    (value) => target.set(value)
  );

  useAnimatedReaction(
    () => progress.get() > 0,
    (displaced, previous) => {
      if (displaced !== previous) {
        runOnJS(onScreenDisplacedChange)(displaced);
      }
    }
  );

  return null;
};

export default DrawerProgressBridge;
