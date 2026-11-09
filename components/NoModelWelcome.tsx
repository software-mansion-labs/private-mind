import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useThemedStyles } from '../hooks/useThemedStyles';
import { Theme } from '../styles/colors';
import { space, textStyles } from '../constants/design-system';
import { NEW_CHAT_REST_BOTTOM_FRACTION } from '../constants/chat-screen';
import { CAPPED_TEXT_MAX_SCALE } from '../constants/font-scale';
import PrimaryButton from './PrimaryButton';
import TextButton from './TextButton';
import WhatsNewBadge from './WhatsNewBadge';
import NewChatSwarm, {
  SWARM_CLEARANCE_WITH_DESCRIPTION,
} from './chat-screen/NewChatSwarm';

const IMPORT_BUTTON_HEIGHT = 44;
const ACTIONS_GAP = 9;
const CONTENT_GUTTER = space.six;
const DESCRIPTION_GUTTER = space.twelve;

interface Props {
  onChooseModel: () => void;
  onImportChat: () => void;
  playSwarm?: boolean;
}

const NoModelWelcome = ({
  onChooseModel,
  onImportChat,
  playSwarm = false,
}: Props) => {
  const { styles } = useThemedStyles(createStyles);
  const [screenHeight, setScreenHeight] = useState(0);
  const restBottom = screenHeight * NEW_CHAT_REST_BOTTOM_FRACTION;

  return (
    <View
      style={styles.container}
      testID="no-model-welcome"
      onLayout={(event) => setScreenHeight(event.nativeEvent.layout.height)}
    >
      {screenHeight > 0 && (
        <>
          {playSwarm && (
            <NewChatSwarm
              screenHeight={screenHeight}
              headingClearance={SWARM_CLEARANCE_WITH_DESCRIPTION}
            />
          )}
          <View
            style={[styles.hero, { bottom: screenHeight - restBottom }]}
            pointerEvents="box-none"
          >
            <WhatsNewBadge />
            <Text
              style={styles.heading}
              accessibilityRole="header"
              maxFontSizeMultiplier={CAPPED_TEXT_MAX_SCALE}
            >
              Welcome!
            </Text>
          </View>
          <Text
            style={[styles.description, { top: restBottom + space.two }]}
            maxFontSizeMultiplier={CAPPED_TEXT_MAX_SCALE}
          >
            Choose a model to get started with Private Mind
          </Text>
        </>
      )}
      <View style={styles.actions}>
        <PrimaryButton
          text="Choose a model"
          onPress={onChooseModel}
          style={styles.chooseButton}
          textStyle={styles.chooseButtonText}
        />
        <TextButton
          text="Import chat"
          onPress={onImportChat}
          style={styles.importButton}
          textStyle={styles.importButtonText}
        />
      </View>
    </View>
  );
};

export default NoModelWelcome;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    hero: {
      position: 'absolute',
      left: CONTENT_GUTTER,
      right: CONTENT_GUTTER,
      alignItems: 'center',
      gap: space.four,
    },
    heading: {
      ...textStyles.titleH1,
      color: theme.text.primary,
      textAlign: 'center',
    },
    description: {
      position: 'absolute',
      left: DESCRIPTION_GUTTER,
      right: DESCRIPTION_GUTTER,
      ...textStyles.bodySecondaryRegular,
      fontSize: 16,
      lineHeight: 24,
      color: theme.text.defaultSecondary,
      textAlign: 'center',
    },
    actions: {
      position: 'absolute',
      left: space.four,
      right: space.four,
      bottom: theme.insets.bottom + space.four,
      gap: ACTIONS_GAP,
    },
    chooseButton: {
      backgroundColor: theme.bg.chatBar,
    },
    chooseButtonText: {
      color: theme.text.primary,
    },
    importButton: {
      height: IMPORT_BUTTON_HEIGHT,
      borderWidth: 0,
    },
    importButtonText: {
      color: theme.text.onBrand,
    },
  });
