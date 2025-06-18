import React, { useState } from 'react';
import ChatScreen from '../components/chat-screen/ChatScreen';
import { useDefaultHeader } from '../hooks/useDefaultHeader';
import { useNavigation } from 'expo-router';
import { useLayoutEffect } from 'react';
import SettingsHeaderButton from '../components/SettingsHeaderButton';
import { configureReanimatedLogger } from 'react-native-reanimated';
import { Text, View } from 'react-native';
import { Model } from '../database/modelRepository';
import WithDrawerGesture from '../components/WithDrawerGesture';
import { useTheme } from '../context/ThemeContext';
import { fontFamily, fontSizes } from '../styles/fontFamily';

export default function App() {
  const navigation = useNavigation();
  const [model, setModel] = useState<Model | null>(null);
  const { theme } = useTheme();
  useDefaultHeader();

  configureReanimatedLogger({
    strict: false,
  });

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => <SettingsHeaderButton chatId={null} />,
      headerTitle: () => (
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Text
            style={{
              color: theme.text.primary,
              fontFamily: fontFamily.medium,
            }}
          >
            {model ? model.modelName : ''}
          </Text>
        </View>
      ),
    });
  }, [navigation, model]);

  return (
    <WithDrawerGesture>
      <ChatScreen
        chatId={null}
        messageHistory={[]}
        model={model}
        selectModel={setModel}
      />
    </WithDrawerGesture>
  );
}
