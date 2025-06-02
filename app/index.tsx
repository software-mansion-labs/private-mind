import React from 'react';
import ChatScreen from '../components/chat-screen/ChatScreen';
import { useDefaultHeader } from '../hooks/useDefaultHeader';
import { useNavigation } from 'expo-router';
import { useLayoutEffect } from 'react';
import SettingsHeaderButton from '../components/SettingsHeaderButton';
import { configureReanimatedLogger } from 'react-native-reanimated';

export default function App() {
  const navigation = useNavigation();

  useDefaultHeader();

  configureReanimatedLogger({
    strict: false,
  });

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => <SettingsHeaderButton chatId={null} />,
    });
  }, [navigation]);

  return <ChatScreen chatId={null} messageHistory={[]} />;
}
