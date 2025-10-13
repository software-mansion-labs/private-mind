import OfflineIcon from 'assets/OfflineIcon.svg';
import PrivacyIcon from 'assets/PrivacyIcon.svg';
import PlatformIcon from 'assets/PlatformIcon.svg';
import CustomizationIcon from 'assets/CustomizationIcon.svg';
import SpeechIcon from 'assets/SpeechIcon.svg';
import ContextIcon from 'assets/ContextIcon.svg';

export const Icons = {
  "OfflineIcon": OfflineIcon,
  "PrivacyIcon": PrivacyIcon,
  "PlatformIcon": PlatformIcon,
  "CustomizationIcon": CustomizationIcon,
  "SpeechIcon": SpeechIcon,
  "ContextIcon": ContextIcon
}

export type IconsType = keyof typeof Icons;