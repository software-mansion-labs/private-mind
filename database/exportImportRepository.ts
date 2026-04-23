import { SQLiteDatabase } from 'expo-sqlite';
import { getChatMessages, Message } from './chatRepository';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { Alert } from 'react-native';

const VALID_ROLES = new Set(['user', 'assistant', 'system', 'event']);

const isValidMessage = (m: unknown): m is Message => {
  if (!m || typeof m !== 'object') return false;
  const msg = m as Record<string, unknown>;
  return (
    typeof msg.role === 'string' &&
    VALID_ROLES.has(msg.role) &&
    typeof msg.content === 'string'
  );
};

const parseImportedChat = (
  raw: unknown
): { title: string; messages: Message[] } | null => {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Record<string, unknown>;
  if (typeof data.title !== 'string') return null;
  if (!Array.isArray(data.history)) return null;
  const messages = data.history.filter(isValidMessage) as Message[];
  if (messages.length !== data.history.length) return null;
  return { title: data.title, messages };
};

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

    let parsed: unknown;
    try {
      parsed = JSON.parse(fileContent);
    } catch {
      Alert.alert('Invalid file', 'The selected file is not valid JSON.');
      return;
    }

    const chat = parseImportedChat(parsed);
    if (!chat) {
      Alert.alert(
        'Invalid chat file',
        'The file does not match the expected chat export format.'
      );
      return;
    }
    return chat;
  } catch (error) {
    console.error('Failed to import chat room JSON:', error);
    return;
  }
}
