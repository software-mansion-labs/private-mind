import React, { RefObject, useCallback, useState } from 'react';
import {
  BottomSheetModal,
  BottomSheetFlatList,
  BottomSheetView,
  BottomSheetBackdrop,
  BottomSheetTextInput,
} from '@gorhom/bottom-sheet';
import { router } from 'expo-router';
import { View, StyleSheet, Text } from 'react-native';
import ModelCard from '../model-hub/ModelCard';
import PrimaryButton from '../PrimaryButton';
import { Model } from '../../database/modelRepository';
import { useModelStore } from '../../store/modelStore';
import { fontFamily, fontSizes } from '../../styles/fontFamily';
import { useTheme } from '../../context/ThemeContext';
import SearchIcon from '../../assets/icons/search.svg';

interface Props {
  bottomSheetModalRef: RefObject<BottomSheetModal | null>;
  selectModel: (model: Model) => void;
}

const ModelSelectSheet = ({ bottomSheetModalRef, selectModel }: Props) => {
  const { theme } = useTheme();
  const { downloadedModels } = useModelStore();
  const [search, setSearch] = useState('');
  const [active, setActive] = useState(false);

  const filteredModels = downloadedModels.filter((model) => {
    const matchesSearch = model.modelName
      .toLowerCase()
      .includes(search.toLowerCase());

    return matchesSearch;
  });

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={1}
        style={{
          backgroundColor: theme.bg.overlay,
        }}
      />
    ),
    []
  );

  return (
    <BottomSheetModal
      ref={bottomSheetModalRef}
      style={{
        backgroundColor: theme.bg.softPrimary,
      }}
      backdropComponent={renderBackdrop}
      snapPoints={['30%', '50%']}
      enableDynamicSizing={false}
      handleStyle={{
        backgroundColor: theme.bg.softPrimary,
        borderRadius: 16,
      }}
      handleIndicatorStyle={{
        backgroundColor: theme.text.primary,
        ...styles.bottomSheetIndicator,
      }}
      backgroundStyle={{
        backgroundColor: theme.bg.softPrimary,
      }}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
    >
      {downloadedModels.length > 0 ? (
        <BottomSheetView
          style={{
            ...styles.bottomSheet,
            backgroundColor: theme.bg.softPrimary,
          }}
        >
          <Text style={{ ...styles.title, color: theme.text.primary }}>
            Select a Model
          </Text>
          <View
            style={{
              ...styles.inputWrapper,
              borderColor: active ? theme.bg.strongPrimary : theme.border.soft,
              borderWidth: active ? 2 : 1,
            }}
          >
            <SearchIcon
              width={20}
              height={20}
              style={{ color: theme.text.primary }}
            />
            <BottomSheetTextInput
              style={{
                ...styles.input,
                color: theme.text.primary,
              }}
              value={search}
              onChangeText={setSearch}
              placeholder={'Search Models...'}
              placeholderTextColor={theme.text.defaultTertiary}
              onFocus={() => setActive(true)}
              onBlur={() => setActive(false)}
            />
          </View>
          <BottomSheetFlatList
            data={filteredModels}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={{ gap: 8, paddingBottom: 60 }}
            renderItem={({ item }) => (
              <ModelCard
                model={item}
                onPress={() => {
                  selectModel(item);
                  bottomSheetModalRef.current?.dismiss();
                }}
              />
            )}
          />
        </BottomSheetView>
      ) : (
        <BottomSheetView style={styles.bottomSheet}>
          <Text style={{ ...styles.title, color: theme.text.primary }}>
            You have no available models yet
          </Text>
          <Text
            style={{
              ...styles.bottomSheetSubText,
              color: theme.text.defaultSecondary,
            }}
          >
            To use Private Mind you need to have at least one model downloaded
          </Text>
          <PrimaryButton
            text="Open models list"
            onPress={() => {
              bottomSheetModalRef.current?.dismiss();
              router.push('/model-hub');
            }}
          />
        </BottomSheetView>
      )}
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create({
  title: {
    fontSize: fontSizes.lg,
    fontFamily: fontFamily.medium,
  },
  modelItemText: {
    fontSize: 16,
  },
  bottomSheet: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    gap: 24,
  },
  bottomSheetSubText: {
    fontFamily: fontFamily.regular,
    fontSize: fontSizes.md,
  },
  bottomSheetIndicator: {
    width: 64,
    height: 4,
    borderRadius: 20,
  },
  inputWrapper: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  input: {
    fontSize: fontSizes.md,
    fontFamily: fontFamily.regular,
    width: '90%',
    lineHeight: 22,
  },
});

export default ModelSelectSheet;
