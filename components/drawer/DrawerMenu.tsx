import React, { useMemo } from 'react';
import { Text, StyleSheet, View } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { ScrollView } from 'react-native-gesture-handler';
import { useTheme } from '../../context/ThemeContext';
import { useChatStore } from '../../store/chatStore';
import { useLLMStore } from '../../store/llmStore';
import { Chat } from '../../database/chatRepository';
import ChatIcon from '../../assets/icons/chat.svg';
import ModelsIcon from '../../assets/icons/models.svg';
import BenchmarkIcon from '../../assets/icons/benchmark.svg';
import { DrawerItem } from './DrawerItem';
import { fontFamily, fontSizes } from '../../styles/fontFamily';
import { Theme } from '../../styles/colors';

const getRelativeDateSection = (date: Date): string => {
  const now = new Date();
  const diffDays = Math.floor(
    (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays <= 6) return `${diffDays} days ago`;
  if (diffDays <= 13) return 'Last week';
  if (diffDays <= 20) return '2 weeks ago';
  if (diffDays <= 27) return '3 weeks ago';
  if (diffDays <= 59) return 'Last month';
  if (diffDays <= 89) return '2 months ago';
  if (diffDays <= 119) return '3 months ago';
  if (diffDays <= 364) return 'Within a year';

  return 'More than a year ago';
};

const groupChatsByDate = (chats: Chat[]): Record<string, Chat[]> => {
  const sections: Record<string, Chat[]> = {};
  chats.forEach((chat) => {
    const date = new Date(chat.lastUsed);
    const section = getRelativeDateSection(date);
    if (!sections[section]) {
      sections[section] = [];
    }
    sections[section].push(chat);
  });
  return sections;
};

const DrawerMenu = ({ onNavigate }: { onNavigate: () => void }) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const router = useRouter();
  const pathname = usePathname();
  const { chats } = useChatStore();
  const { isGenerating, interrupt } = useLLMStore();

  const groupedChats = groupChatsByDate(
    [...chats].sort((a, b) => b.lastUsed - a.lastUsed)
  );

  const navigate = (path: string) => {
    if (isGenerating) interrupt();
    pathname === path ? router.replace(path) : router.push(path);
    onNavigate();
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.section}>
        <DrawerItem
          icon={<ChatIcon width={18} height={18} style={styles.icon} />}
          label="New chat"
          active={pathname === '/'}
          onPress={() => navigate('/')}
        />
        <DrawerItem
          icon={<ModelsIcon width={18} height={18} style={styles.icon} />}
          label="Models"
          active={pathname === '/model-hub'}
          onPress={() => navigate('/model-hub')}
        />
        <DrawerItem
          icon={<BenchmarkIcon width={18} height={18} style={styles.icon} />}
          label="Benchmark"
          active={pathname === '/benchmark'}
          onPress={() => navigate('/benchmark')}
        />
      </View>

      {Object.entries(groupedChats).map(([sectionTitle, sectionChats]) => (
        <View key={sectionTitle} style={styles.subSectionContainer}>
          <Text style={styles.subSection}>{sectionTitle}</Text>
          <View>
            {sectionChats.map((chat) => {
              const path = `/chat/${chat.id}`;
              return (
                <DrawerItem
                  key={chat.id}
                  label={chat.title || `Chat ${chat.id}`}
                  active={pathname === path}
                  onPress={() => navigate(path)}
                />
              );
            })}
          </View>
        </View>
      ))}
    </ScrollView>
  );
};

export default DrawerMenu;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      paddingVertical: 32,
      paddingHorizontal: 16,
      gap: 24,
    },
    section: {
      gap: 8,
    },
    subSectionContainer: {
      gap: 8,
    },
    subSection: {
      paddingHorizontal: 12,
      fontFamily: fontFamily.medium,
      fontSize: fontSizes.xs,
      letterSpacing: 0.1,
      color: theme.text.defaultTertiary,
    },
    icon: {
      color: theme.text.primary,
    },
  });
