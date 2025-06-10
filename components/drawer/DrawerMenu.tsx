import React, { memo } from 'react';
import { Text, Pressable, StyleSheet, View } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { useChatStore } from '../../store/chatStore';
import { Chat } from '../../database/chatRepository';
import { useLLMStore } from '../../store/llmStore';
import { ScrollView } from 'react-native-gesture-handler';
import { useTheme } from '../../context/ThemeContext';
import { fontFamily, fontSizes } from '../../styles/fontFamily';
import ChatIcon from '../../assets/icons/chat.svg';
import ModelsIcon from '../../assets/icons/models.svg';
import BenchmarkIcon from '../../assets/icons/benchmark.svg';

const getRelativeDateSection = (date: Date): string => {
  const now = new Date();
  const diffTime = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

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
  const router = useRouter();
  const pathname = usePathname();
  const { theme } = useTheme();
  const { chats } = useChatStore();
  const { isGenerating, interrupt } = useLLMStore();

  const groupedChats = groupChatsByDate(
    [...chats].sort((a, b) => b.lastUsed - a.lastUsed)
  );

  const navigate = (path: string) => {
    if (isGenerating) {
      interrupt();
    }

    if (path.includes('chat')) {
      router.replace(path);
    } else {
      router.push(path);
    }

    onNavigate();
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View>
        <DrawerItem
          icon={<ChatIcon width={18} height={18} />}
          label="New chat"
          active={pathname === '/'}
          onPress={() => navigate('/')}
        />
        <DrawerItem
          icon={<ModelsIcon width={18} height={18} />}
          label="Models"
          active={pathname === '/model-hub'}
          onPress={() => navigate('/model-hub')}
        />
        <DrawerItem
          icon={<BenchmarkIcon width={18} height={18} />}
          label="Benchmark"
          active={pathname === '/benchmark'}
          onPress={() => navigate('/benchmark')}
        />
      </View>
      {Object.entries(groupedChats).map(([sectionTitle, sectionChats]) => (
        <View key={sectionTitle} style={{ gap: 8 }}>
          <Text
            style={{
              ...styles.subSection,
              color: theme.text.defaultTertiary,
            }}
          >
            {sectionTitle}
          </Text>
          <View>
            {sectionChats.map((chat) => {
              const path = `/chat/${chat.id}`;
              const active = pathname === path;
              return (
                <DrawerItem
                  key={chat.id}
                  label={chat.title || `Chat ${chat.id}`}
                  active={active}
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

const DrawerItem = memo(
  ({
    label,
    active,
    onPress,
    icon,
  }: {
    label: string;
    active: boolean;
    onPress: () => void;
    icon?: React.ReactNode;
  }) => {
    const { theme } = useTheme();
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.item,
          pressed && styles.itemPressed,
          active && {
            ...styles.itemActive,
            backgroundColor: theme.bg.softSecondary,
          },
        ]}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {icon && icon}
          <Text
            style={[
              { ...styles.label, color: theme.text.primary },
              active && styles.labelActive,
            ]}
          >
            {label}
          </Text>
        </View>
      </Pressable>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    paddingVertical: 32,
    paddingHorizontal: 16,
    gap: 24,
  },
  subSection: {
    paddingHorizontal: 12,
    fontFamily: fontFamily.medium,
  },
  item: {
    padding: 12,
    borderRadius: 4,
  },
  itemActive: {},
  itemPressed: {},
  label: {
    fontSize: fontSizes.md,
    fontFamily: fontFamily.medium,
  },
  labelActive: {},
});
