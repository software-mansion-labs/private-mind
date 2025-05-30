import React, { memo } from 'react';
import { Text, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { useChatStore } from '../../store/chatStore';
import ColorPalette from '../../colors';
import { Chat } from '../../database/chatRepository';

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
  const { chats } = useChatStore();

  const groupedChats = groupChatsByDate(
    [...chats].sort((a, b) => b.lastUsed - a.lastUsed) // newest first
  );

  const navigate = (path: string) => {
    router.push(path);
    onNavigate();
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Section title="App" />
      <DrawerItem
        label="Chat"
        active={pathname === '/'}
        onPress={() => navigate('/')}
      />
      <DrawerItem
        label="Models"
        active={pathname === '/model-hub'}
        onPress={() => navigate('/model-hub')}
      />
      <DrawerItem
        label="Benchmark"
        active={pathname === '/benchmark'}
        onPress={() => navigate('/benchmark')}
      />

      {/* Grouped Chats */}
      <Section title="Chats" />
      {Object.entries(groupedChats).map(([sectionTitle, sectionChats]) => (
        <View key={sectionTitle}>
          <Text style={styles.subSection}>{sectionTitle}</Text>
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
  }: {
    label: string;
    active: boolean;
    onPress: () => void;
  }) => {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.item,
          active && styles.itemActive,
          pressed && styles.itemPressed,
        ]}
      >
        <Text style={[styles.label, active && styles.labelActive]}>
          {label}
        </Text>
      </Pressable>
    );
  }
);

const Section = ({ title }: { title: string }) => (
  <Text style={styles.section}>{title}</Text>
);

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  section: {
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 12,
    color: ColorPalette.primary,
  },
  subSection: {
    fontSize: 12,
    fontWeight: '600',
    color: ColorPalette.blueDark,
    marginTop: 16,
    marginBottom: 4,
    paddingLeft: 4,
  },
  item: {
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  itemActive: {
    backgroundColor: ColorPalette.seaBlueLight,
  },
  itemPressed: {
    backgroundColor: ColorPalette.seaBlueMedium,
  },
  label: {
    fontSize: 16,
    color: ColorPalette.blueDark,
  },
  labelActive: {
    color: ColorPalette.primary,
    fontWeight: 'bold',
  },
});
