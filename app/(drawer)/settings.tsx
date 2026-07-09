import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { useRouter } from 'expo-router';
import useDefaultHeader from '../../hooks/useDefaultHeader';
import { SettingsRow } from '../../components/settings/SettingsRow';
import EditIcon from '../../assets/icons/edit.svg';
import InfoCircleIcon from '../../assets/icons/info-circle.svg';
import { useTheme } from '../../context/ThemeContext';
import { Theme } from '../../styles/colors';

const SettingsScreen = () => {
  useDefaultHeader();
  const router = useRouter();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <SettingsRow
          label="Personal preferences"
          icon={<EditIcon width={20} height={20} style={styles.rowIcon} />}
          onPress={() => router.push('/custom-system-prompt')}
        />
        <SettingsRow
          label="App info"
          icon={
            <InfoCircleIcon width={20} height={20} style={styles.rowIcon} />
          }
          onPress={() => router.push('/app-info')}
        />
      </ScrollView>
    </View>
  );
};

export default SettingsScreen;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.bg.softPrimary,
      paddingTop: 16,
    },
    scrollContent: {
      gap: 8,
      paddingHorizontal: 16,
      paddingBottom: theme.insets.bottom + 16,
    },
    rowIcon: {
      color: theme.text.primary,
    },
  });
