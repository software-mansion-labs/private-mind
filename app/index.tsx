import React from 'react';
import ChatScreen from '../components/chat-screen/ChatScreen';
import { useDefaultHeader } from '../hooks/useDefaultHeader';
import { useNavigation, router } from 'expo-router';
import { useLayoutEffect } from 'react';
import SettingsHeaderButton from '../components/SettingsHeaderButton';
import { configureReanimatedLogger } from 'react-native-reanimated';
import { Model } from '../database/modelRepository';
import WithDrawerGesture from '../components/WithDrawerGesture';
import { getNextChatId } from '../database/chatRepository';
import { useSQLiteContext } from 'expo-sqlite';

export default function App() {
  const navigation = useNavigation();
  const db = useSQLiteContext();
  useDefaultHeader();

  configureReanimatedLogger({
    strict: false,
  });

  const handleSetModel = async (model: Model) => {
    const nextChatId = await getNextChatId(db);
    router.push({
      pathname: `/chat/${nextChatId}`,
      params: { modelId: model.id },
    });
  };

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => <SettingsHeaderButton chatId={null} />,
    });
  }, [navigation]);

  return (
    <WithDrawerGesture>
      <ChatScreen
        chatId={null}
        messageHistory={[]}
        model={undefined}
        selectModel={handleSetModel}
      />
    </WithDrawerGesture>
  );
}
