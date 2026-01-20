import { SQLiteDatabase } from 'expo-sqlite';
import { getChatMessages, Message } from './chatRepository';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { Alert } from 'react-native';

export const exportChatRoom = async (
  db: SQLiteDatabase,
  chatId: number,
  chatTitle: string
): Promise<void> => {
  try {
    const messageHistory = await getChatMessages(db, chatId);

    const jsonData = JSON.stringify({
      id: chatId,
      title: chatTitle,
      history: messageHistory,
    });

    const fileName = `chat-${Date.now()}.json`;
    const file = new File(Paths.document, fileName);
    await file.write(jsonData);
    const fileUri = file.uri;

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri, {
        dialogTitle: `Export Chat Room: ${chatTitle}`,
        mimeType: 'application/json',
        UTI: 'public.json',
      });
    } else {
      Alert.alert('Sharing is not available on this device.');
    }
  } catch (error) {
    console.error('Error exporting chat room:', error);
  }
};

export async function importChatRoom(): Promise<
  | {
      title: string;
      messages: Message[];
    }
  | undefined
> {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/json',
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets[0]?.uri) return;
    const uri = result.assets[0].uri;
    const file = new File(uri);
    const fileContent = await file.text();

    const chatData = JSON.parse(fileContent);
    const chat = {
      title: chatData.title,
      messages: chatData.history.map((msg: any) => ({
        role: msg.role,
        content: msg.content,
        createdAt: msg.createdAt,
      })),
    };
    return chat;
  } catch (error) {
    console.error('Failed to import chat room JSON:', error);
    return;
  }
}
