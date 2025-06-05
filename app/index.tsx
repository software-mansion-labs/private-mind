import React, { useState } from 'react';
import ChatScreen from '../components/chat-screen/ChatScreen';
import { useDefaultHeader } from '../hooks/useDefaultHeader';
import { useNavigation } from 'expo-router';
import { useLayoutEffect } from 'react';
import SettingsHeaderButton from '../components/SettingsHeaderButton';
import { configureReanimatedLogger } from 'react-native-reanimated';
import { Text, View } from 'react-native';
import { Model } from '../database/modelRepository';

export default function App() {
  const navigation = useNavigation();
  const [model, setModel] = useState<Model | null>(null);

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
          <Text>{model ? model.id : ''}</Text>
        </View>
      ),
    });
  }, [navigation, model]);

  return (
    <ChatScreen
      chatId={null}
      messageHistory={[]}
      model={model}
      selectModel={setModel}
    />
  );
}
