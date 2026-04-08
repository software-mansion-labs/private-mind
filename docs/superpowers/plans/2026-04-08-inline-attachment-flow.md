# Inline Attachment Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the dedicated Sources screen and separate image/document attachment buttons with a unified "+" button in the chat composer that supports both image and document attachments with smart processing (inline for small docs, RAG for large docs).

**Architecture:** A unified `useAttachment` hook manages all attachment state (images + documents). An `AttachmentSheet` bottom sheet replaces both `ImageSourceSheet` and `SourceSelectSheet` with adaptive options (vision models get Photo Library/Camera/Document; non-vision get Document only). Documents under ~4K chars are injected inline; larger ones go through the existing RAG pipeline with the first chunk always included for context. The Sources screen and drawer entry are removed.

**Tech Stack:** React Native, Expo, Zustand, expo-document-picker, react-native-image-picker, @gorhom/bottom-sheet, react-native-rag, @react-native-rag/op-sqlite

---

### Task 1: Create `useAttachment` hook

**Files:**
- Create: `hooks/useAttachment.ts`
- Test: `__tests__/useAttachment.test.ts`

This hook replaces both `useImageAttachment` and the document-picking part of `useSourceUpload`. It manages a list of attachments (images and documents), handles picking, processing (inline vs RAG), and clearing.

**Pre-requisite:** Before implementing this hook, update `addSource` in `store/sourceStore.ts` to return `sourceId` on success. Change the return type from `{ success: boolean; isEmpty?: boolean }` to `{ success: boolean; isEmpty?: boolean; sourceId?: number }`. In the success path (line 110), change `return { success: true }` to `return { success: true, sourceId }` where `sourceId` comes from the `insertSource` call at line 87. Update the `SourceStore` interface (line 23) accordingly. Also update `__tests__/sourceStore.test.ts` line 117: change `expect(result).toEqual({ success: true })` to `expect(result).toEqual({ success: true, sourceId: 99 })`.

- [ ] **Step 1: Write failing tests for the hook**

Create `__tests__/useAttachment.test.ts`:

```typescript
import { renderHook, act } from '@testing-library/react-native';

jest.mock('react-native-image-picker', () => ({
  launchImageLibrary: jest.fn(),
  launchCamera: jest.fn(),
}));
jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn(),
}));
jest.mock('../utils/fileReaders', () => ({
  readDocumentText: jest.fn(),
}));
jest.mock('../store/sourceStore', () => ({
  useSourceStore: {
    getState: jest.fn(() => ({
      addSource: jest.fn(),
    })),
  },
}));
jest.mock('../context/VectorStoreContext', () => ({
  useVectorStore: jest.fn(() => ({ vectorStore: {} })),
}));
jest.mock('@gorhom/bottom-sheet', () => ({
  BottomSheetModal: jest.fn(),
}));
jest.mock('react-native-toast-message', () => ({
  show: jest.fn(),
}));

import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { readDocumentText } from '../utils/fileReaders';
import { useAttachment } from '../hooks/useAttachment';

const mockLaunchImageLibrary = launchImageLibrary as jest.Mock;
const mockLaunchCamera = launchCamera as jest.Mock;
const mockGetDocumentAsync = DocumentPicker.getDocumentAsync as jest.Mock;
const mockReadDocumentText = readDocumentText as jest.Mock;

beforeEach(() => jest.clearAllMocks());

describe('useAttachment', () => {
  it('initializes with empty attachments', () => {
    const { result } = renderHook(() => useAttachment());
    expect(result.current.attachments).toEqual([]);
  });

  it('pickFromLibrary adds an image attachment', async () => {
    mockLaunchImageLibrary.mockResolvedValue({
      assets: [{ uri: 'file://photo.jpg' }],
    });
    const { result } = renderHook(() => useAttachment());
    await act(async () => { await result.current.pickFromLibrary(); });
    expect(result.current.attachments).toHaveLength(1);
    expect(result.current.attachments[0].type).toBe('image');
    expect(result.current.attachments[0].uri).toBe('file://photo.jpg');
    expect(result.current.attachments[0].status).toBe('ready');
  });

  it('pickFromCamera adds an image attachment', async () => {
    mockLaunchCamera.mockResolvedValue({
      assets: [{ uri: 'file://camera.jpg' }],
    });
    const { result } = renderHook(() => useAttachment());
    await act(async () => { await result.current.pickFromCamera(); });
    expect(result.current.attachments).toHaveLength(1);
    expect(result.current.attachments[0].type).toBe('image');
  });

  it('does not add attachment when image picker is cancelled', async () => {
    mockLaunchImageLibrary.mockResolvedValue({ didCancel: true });
    const { result } = renderHook(() => useAttachment());
    await act(async () => { await result.current.pickFromLibrary(); });
    expect(result.current.attachments).toEqual([]);
  });

  it('pickDocument adds a small doc as inline attachment', async () => {
    mockGetDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file://doc.txt', name: 'doc.txt', size: 100 }],
    });
    mockReadDocumentText.mockResolvedValue('Short document content');

    const { result } = renderHook(() => useAttachment());
    await act(async () => { await result.current.pickDocument(); });

    expect(result.current.attachments).toHaveLength(1);
    const att = result.current.attachments[0];
    expect(att.type).toBe('document');
    expect(att.strategy).toBe('inline');
    expect(att.inlineText).toBe('Short document content');
    expect(att.status).toBe('ready');
  });

  it('pickDocument marks large doc for RAG and stores firstChunk', async () => {
    const largeText = 'A'.repeat(5000);
    mockGetDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file://big.pdf', name: 'big.pdf', size: 50000 }],
    });
    mockReadDocumentText.mockResolvedValue(largeText);

    const mockAddSource = jest.fn().mockResolvedValue({ success: true });
    const { useSourceStore } = require('../store/sourceStore');
    useSourceStore.getState.mockReturnValue({ addSource: mockAddSource });

    const { result } = renderHook(() => useAttachment());
    await act(async () => { await result.current.pickDocument(); });

    const att = result.current.attachments[0];
    expect(att.type).toBe('document');
    expect(att.strategy).toBe('rag');
    expect(att.firstChunk).toBeDefined();
    expect(att.status).toBe('ready');
  });

  it('removeAttachment removes by id', async () => {
    mockLaunchImageLibrary.mockResolvedValue({
      assets: [{ uri: 'file://photo.jpg' }],
    });
    const { result } = renderHook(() => useAttachment());
    await act(async () => { await result.current.pickFromLibrary(); });
    const id = result.current.attachments[0].id;
    act(() => { result.current.removeAttachment(id); });
    expect(result.current.attachments).toEqual([]);
  });

  it('clearAll removes all attachments', async () => {
    mockLaunchImageLibrary.mockResolvedValue({
      assets: [{ uri: 'file://photo.jpg' }],
    });
    const { result } = renderHook(() => useAttachment());
    await act(async () => { await result.current.pickFromLibrary(); });
    act(() => { result.current.clearAll(); });
    expect(result.current.attachments).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest __tests__/useAttachment.test.ts --no-coverage`
Expected: FAIL — `useAttachment` module not found

- [ ] **Step 3: Implement the `useAttachment` hook**

Create `hooks/useAttachment.ts`:

```typescript
import { useState, useRef, useCallback } from 'react';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { Platform, PermissionsAndroid } from 'react-native';
import Toast from 'react-native-toast-message';
import { readDocumentText } from '../utils/fileReaders';
import { useSourceStore } from '../store/sourceStore';
import { useVectorStore } from '../context/VectorStoreContext';

const INLINE_THRESHOLD = 4096;

export interface Attachment {
  id: string;
  type: 'image' | 'document';
  uri: string;
  name?: string;
  status: 'loading' | 'ready';
  strategy?: 'inline' | 'rag';
  inlineText?: string;
  sourceId?: number;
  firstChunk?: string;
}

const requestAndroidGalleryPermission = async (): Promise<boolean> => {
  if (Platform.OS !== 'android') return true;

  const permission =
    Number(Platform.Version) >= 33
      ? PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES
      : PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE;

  const status = await PermissionsAndroid.check(permission);
  if (status) return true;

  const result = await PermissionsAndroid.request(permission);
  return result === PermissionsAndroid.RESULTS.GRANTED;
};

export const useAttachment = () => {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const sheetRef = useRef<BottomSheetModal>(null);
  const { vectorStore } = useVectorStore();

  const pickFromLibrary = useCallback(async () => {
    const granted = await requestAndroidGalleryPermission();
    if (!granted) {
      Toast.show({
        type: 'defaultToast',
        text1: 'Photo library permission is required to attach images.',
      });
      return;
    }
    const result = await launchImageLibrary({ mediaType: 'photo', quality: 1 });
    if (!result.didCancel && result.assets && result.assets.length > 0) {
      const uri = result.assets[0].uri;
      if (uri) {
        setAttachments((prev) => [
          ...prev,
          { id: `img-${Date.now()}`, type: 'image', uri, status: 'ready' },
        ]);
      }
    }
  }, []);

  const pickFromCamera = useCallback(async () => {
    const result = await launchCamera({ mediaType: 'photo', quality: 1 });
    if (!result.didCancel && result.assets && result.assets.length > 0) {
      const uri = result.assets[0].uri;
      if (uri) {
        setAttachments((prev) => [
          ...prev,
          { id: `img-${Date.now()}`, type: 'image', uri, status: 'ready' },
        ]);
      }
    }
  }, []);

  const pickDocument = useCallback(async () => {
    const pickedFileResult = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'text/plain', 'text/markdown', 'text/html'],
      copyToCacheDirectory: true,
    });

    if (pickedFileResult.canceled || !pickedFileResult.assets[0]) return;

    const asset = pickedFileResult.assets[0];
    const fileType = asset.uri.split('.').pop() || '';
    const fileName =
      asset.name?.split('.')[0] ||
      asset.uri.split('/').pop()?.split('.')[0] ||
      'Unnamed';
    const attachmentId = `doc-${Date.now()}`;

    setAttachments((prev) => [
      ...prev,
      {
        id: attachmentId,
        type: 'document',
        uri: asset.uri,
        name: asset.name || fileName,
        status: 'loading',
      },
    ]);

    try {
      const text = await readDocumentText(asset.uri, fileType);

      if (!text || text.trim().length === 0) {
        setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
        Toast.show({
          type: 'defaultToast',
          text1: 'Document appears to be empty.',
        });
        return;
      }

      if (text.length <= INLINE_THRESHOLD) {
        setAttachments((prev) =>
          prev.map((a) =>
            a.id === attachmentId
              ? { ...a, status: 'ready', strategy: 'inline', inlineText: text }
              : a
          )
        );
      } else {
        const firstChunk = text.slice(0, 1000);
        const newSource = {
          name: fileName,
          type: fileType,
          size: asset.size || null,
        };
        const { addSource } = useSourceStore.getState();
        const result = await addSource(newSource, asset.uri, vectorStore!);

        if (result.success) {
          setAttachments((prev) =>
            prev.map((a) =>
              a.id === attachmentId
                ? {
                    ...a,
                    status: 'ready',
                    strategy: 'rag',
                    firstChunk,
                    sourceId: result.sourceId,
                  }
                : a
            )
          );
        } else {
          setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
          Toast.show({
            type: 'defaultToast',
            text1: 'Failed to process document.',
          });
        }
      }
    } catch {
      setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
      Toast.show({
        type: 'defaultToast',
        text1: 'Error reading document.',
      });
    }
  }, [vectorStore]);

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setAttachments([]);
  }, []);

  const openSheet = useCallback(() => {
    sheetRef.current?.present();
  }, []);

  return {
    attachments,
    sheetRef,
    pickFromLibrary,
    pickFromCamera,
    pickDocument,
    removeAttachment,
    clearAll,
    openSheet,
  };
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest __tests__/useAttachment.test.ts --no-coverage`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add hooks/useAttachment.ts __tests__/useAttachment.test.ts
git commit -m "feat: add unified useAttachment hook for images and documents"
```

---

### Task 2: Create `AttachmentSheet` bottom sheet

**Files:**
- Create: `components/bottomSheets/AttachmentSheet.tsx`

This replaces both `ImageSourceSheet` and `SourceSelectSheet` with a unified action sheet. Shows Photo Library + Camera + Document for vision models, Document only for non-vision.

- [ ] **Step 1: Create the `AttachmentSheet` component**

Create `components/bottomSheets/AttachmentSheet.tsx`:

```typescript
import React, { RefObject, useMemo } from 'react';
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetBackdrop,
} from '@gorhom/bottom-sheet';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { Theme } from '../../styles/colors';
import { fontFamily, fontSizes, lineHeights } from '../../styles/fontStyles';
import CameraIcon from '../../assets/icons/camera.svg';
import ImageIcon from '../../assets/icons/image.svg';
import AttachmentIcon from '../../assets/icons/attachment.svg';

interface Props {
  bottomSheetModalRef: RefObject<BottomSheetModal | null>;
  isVisionModel: boolean;
  onPickFromLibrary: () => void;
  onPickFromCamera: () => void;
  onPickDocument: () => void;
}

const AttachmentSheet = ({
  bottomSheetModalRef,
  isVisionModel,
  onPickFromLibrary,
  onPickFromCamera,
  onPickDocument,
}: Props) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const handleOption = (action: () => void) => {
    bottomSheetModalRef.current?.dismiss();
    action();
  };

  return (
    <BottomSheetModal
      ref={bottomSheetModalRef}
      enableDynamicSizing
      backdropComponent={(props) => (
        <BottomSheetBackdrop
          {...props}
          disappearsOnIndex={-1}
          appearsOnIndex={0}
        />
      )}
      backgroundStyle={{ backgroundColor: theme.bg.softPrimary }}
      handleIndicatorStyle={{ backgroundColor: theme.border.soft }}
    >
      <BottomSheetView style={styles.container}>
        {isVisionModel && (
          <>
            <TouchableOpacity
              style={styles.option}
              onPress={() => handleOption(onPickFromCamera)}
              testID="attachment-camera"
            >
              <View style={styles.iconWrapper}>
                <CameraIcon
                  width={24}
                  height={24}
                  style={{ color: theme.text.primary }}
                />
              </View>
              <Text style={styles.optionText}>Camera</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.option}
              onPress={() => handleOption(onPickFromLibrary)}
              testID="attachment-library"
            >
              <View style={styles.iconWrapper}>
                <ImageIcon
                  width={24}
                  height={24}
                  style={{ color: theme.text.primary }}
                />
              </View>
              <Text style={styles.optionText}>Photo Library</Text>
            </TouchableOpacity>
          </>
        )}
        <TouchableOpacity
          style={styles.option}
          onPress={() => handleOption(onPickDocument)}
          testID="attachment-document"
        >
          <View style={styles.iconWrapper}>
            <AttachmentIcon
              width={24}
              height={24}
              style={{ color: theme.text.primary }}
            />
          </View>
          <Text style={styles.optionText}>Document</Text>
        </TouchableOpacity>
      </BottomSheetView>
    </BottomSheetModal>
  );
};

export default AttachmentSheet;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 32,
      gap: 4,
    },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 16,
      paddingHorizontal: 8,
      gap: 16,
      borderRadius: 12,
    },
    iconWrapper: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: theme.bg.softSecondary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    optionText: {
      fontSize: fontSizes.md,
      lineHeight: lineHeights.md,
      fontFamily: fontFamily.medium,
      color: theme.text.primary,
    },
  });
```

- [ ] **Step 2: Commit**

```bash
git add components/bottomSheets/AttachmentSheet.tsx
git commit -m "feat: add unified AttachmentSheet bottom sheet component"
```

---

### Task 3: Create `AttachmentThumbnail` component

**Files:**
- Create: `components/chat-screen/AttachmentThumbnail.tsx`

Renders a 72×72 thumbnail for any attachment type — image preview or document icon with filename. Shows `ActivityIndicator` when loading/indexing.

- [ ] **Step 1: Create the component**

Create `components/chat-screen/AttachmentThumbnail.tsx`:

```typescript
import React, { useMemo } from 'react';
import {
  View,
  Image,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { Theme } from '../../styles/colors';
import { fontFamily, fontSizes } from '../../styles/fontStyles';
import CloseIcon from '../../assets/icons/close.svg';
import AttachmentIcon from '../../assets/icons/attachment.svg';
import { Attachment } from '../../hooks/useAttachment';

interface Props {
  attachment: Attachment;
  onRemove: () => void;
}

const AttachmentThumbnail = ({ attachment, onRemove }: Props) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const renderContent = () => {
    if (attachment.status === 'loading') {
      return (
        <View style={styles.placeholder}>
          <ActivityIndicator color={theme.text.contrastPrimary} />
        </View>
      );
    }

    if (attachment.type === 'image') {
      return (
        <Image
          source={{ uri: attachment.uri }}
          style={styles.thumbnail}
          testID="attachment-image-preview"
        />
      );
    }

    return (
      <View style={styles.docThumbnail}>
        <AttachmentIcon
          width={22}
          height={22}
          style={{ color: theme.text.contrastPrimary }}
        />
        <Text style={styles.fileName} numberOfLines={1}>
          {attachment.name || 'Document'}
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.wrapper} testID={`attachment-thumb-${attachment.id}`}>
      {renderContent()}
      <TouchableOpacity
        style={styles.dismissButton}
        onPress={onRemove}
        testID={`attachment-dismiss-${attachment.id}`}
      >
        <CloseIcon width={8} height={8} style={styles.dismissIcon} />
      </TouchableOpacity>
    </View>
  );
};

export default AttachmentThumbnail;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    wrapper: {
      position: 'relative',
    },
    thumbnail: {
      width: 72,
      height: 72,
      borderRadius: 8,
    },
    placeholder: {
      width: 72,
      height: 72,
      borderRadius: 8,
      backgroundColor: theme.bg.softSecondary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    docThumbnail: {
      width: 72,
      height: 72,
      borderRadius: 8,
      backgroundColor: theme.bg.softSecondary,
      justifyContent: 'center',
      alignItems: 'center',
      gap: 4,
      padding: 4,
    },
    fileName: {
      fontSize: fontSizes.xxs || 8,
      fontFamily: fontFamily.regular,
      color: theme.text.contrastSecondary,
      maxWidth: 60,
      textAlign: 'center',
    },
    dismissButton: {
      position: 'absolute',
      top: -6,
      right: -6,
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: theme.bg.softSecondary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    dismissIcon: {
      color: theme.text.primary,
    },
  });
```

- [ ] **Step 2: Commit**

```bash
git add components/chat-screen/AttachmentThumbnail.tsx
git commit -m "feat: add AttachmentThumbnail component for unified attachment previews"
```

---

### Task 4: Update `ChatBarActions` — remove Sources button, make "+" always visible

**Files:**
- Modify: `components/chat-screen/ChatBarActions.tsx`
- Modify: `__tests__/ChatBarActions.test.tsx`

Remove the "Sources" button and `onSelectSource`/`activeSourcesCount` props. The "+" button becomes always visible (not gated by `isVisionModel`). Rename `onAttachImage` to `onAttach`.

- [ ] **Step 1: Update the test file**

Replace `__tests__/ChatBarActions.test.tsx` with updated tests that reflect the new props — no sources button, "+" always visible:

```typescript
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';

jest.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    theme: {
      ...require('../styles/colors').lightTheme,
      insets: { top: 0, bottom: 0, left: 0, right: 0 },
    },
  }),
}));

jest.mock('../components/CircleButton', () => {
  const { TouchableOpacity } = require('react-native');
  return ({ onPress, testID }: any) => (
    <TouchableOpacity testID={testID || 'circle-btn'} onPress={onPress} />
  );
});

import ChatBarActions from '../components/chat-screen/ChatBarActions';

const defaultProps = {
  userInput: '',
  onSend: jest.fn(),
  isGenerating: false,
  isProcessingPrompt: false,
  onInterrupt: jest.fn(),
  onSpeechInput: jest.fn(),
  thinkingEnabled: false,
  onThinkingToggle: jest.fn(),
  onAttach: jest.fn(),
};

const renderActions = (props = {}) =>
  render(<ChatBarActions {...defaultProps} {...props} />);

beforeEach(() => jest.clearAllMocks());

describe('attach button', () => {
  it('always shows + button regardless of vision model', () => {
    renderActions();
    expect(screen.getByTestId('attach-btn')).toBeTruthy();
  });

  it('calls onAttach when + button is pressed', () => {
    const onAttach = jest.fn();
    renderActions({ onAttach });
    fireEvent.press(screen.getByTestId('attach-btn'));
    expect(onAttach).toHaveBeenCalled();
  });
});

describe('sources button removed', () => {
  it('does not render a Sources button', () => {
    renderActions();
    expect(screen.queryByText('Sources')).toBeNull();
  });
});

describe('thinking toggle', () => {
  it('calls onThinkingToggle when Think button is pressed', () => {
    const onThinkingToggle = jest.fn();
    renderActions({ onThinkingToggle });
    fireEvent.press(screen.getByText('Think'));
    expect(onThinkingToggle).toHaveBeenCalled();
  });
});

describe('action button', () => {
  it('calls onSpeechInput when idle with no input', () => {
    renderActions();
    fireEvent.press(screen.getByTestId('circle-btn'));
    expect(defaultProps.onSpeechInput).toHaveBeenCalled();
  });

  it('calls onSend when there is user input', () => {
    renderActions({ userInput: 'Hello' });
    fireEvent.press(screen.getByTestId('circle-btn'));
    expect(defaultProps.onSend).toHaveBeenCalled();
  });

  it('calls onInterrupt when isGenerating', () => {
    renderActions({ isGenerating: true });
    fireEvent.press(screen.getByTestId('circle-btn'));
    expect(defaultProps.onInterrupt).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest __tests__/ChatBarActions.test.tsx --no-coverage`
Expected: FAIL — props mismatch, "Sources" text still found

- [ ] **Step 3: Update `ChatBarActions` component**

Replace `components/chat-screen/ChatBarActions.tsx`:

```typescript
import React, { useMemo } from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { fontFamily, fontSizes, lineHeights } from '../../styles/fontStyles';
import { Theme } from '../../styles/colors';
import SendIcon from '../../assets/icons/send_icon.svg';
import PauseIcon from '../../assets/icons/pause_icon.svg';
import CircleButton from '../CircleButton';
import SoundwaveIcon from '../../assets/icons/soundwave.svg';
import LightBulbCrossedIcon from '../../assets/icons/light_bulb_crossed.svg';
import LightBulbIcon from '../../assets/icons/light_bulb.svg';
import PlusIcon from '../../assets/icons/plus.svg';

interface Props {
  onAttach: () => void;
  userInput: string;
  hasAttachments?: boolean;
  onSend: () => void;
  isGenerating: boolean;
  isProcessingPrompt: boolean;
  onInterrupt: () => void;
  onSpeechInput: () => void;
  thinkingEnabled: boolean;
  onThinkingToggle?: () => void;
}

const ChatBarActions = ({
  onAttach,
  userInput,
  hasAttachments = false,
  onSend,
  isGenerating,
  isProcessingPrompt,
  onInterrupt,
  onSpeechInput,
  thinkingEnabled = false,
  onThinkingToggle,
}: Props) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const renderButton = () => {
    if (isGenerating || isProcessingPrompt) {
      return (
        <CircleButton
          icon={PauseIcon}
          size={13.33}
          onPress={onInterrupt}
          backgroundColor={theme.bg.main}
          color={theme.text.contrastPrimary}
        />
      );
    }

    if (userInput || hasAttachments) {
      return (
        <View style={styles.rightActions}>
          {hasAttachments && !userInput && (
            <CircleButton
              icon={SoundwaveIcon}
              onPress={onSpeechInput}
              backgroundColor="transparent"
              color={theme.text.contrastPrimary}
            />
          )}
          <CircleButton
            icon={SendIcon}
            onPress={onSend}
            backgroundColor={theme.bg.main}
            color={theme.text.contrastPrimary}
          />
        </View>
      );
    }

    return (
      <CircleButton
        icon={SoundwaveIcon}
        onPress={onSpeechInput}
        backgroundColor="transparent"
        color={theme.text.contrastPrimary}
      />
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.leftActions}>
        <CircleButton
          icon={PlusIcon}
          size={14}
          onPress={onAttach}
          backgroundColor={theme.bg.softPrimary}
          color={theme.text.primary}
          testID="attach-btn"
        />
        <TouchableOpacity
          onPress={onThinkingToggle}
          style={[styles.toggleButton, !thinkingEnabled && { opacity: 0.4 }]}
        >
          {!thinkingEnabled ? (
            <LightBulbCrossedIcon
              style={{ color: theme.text.contrastPrimary }}
              width={20}
              height={20}
            />
          ) : (
            <LightBulbIcon
              style={{ color: theme.text.contrastPrimary }}
              width={20}
              height={20}
            />
          )}
          <Text style={styles.toggleText}>Think</Text>
        </TouchableOpacity>
      </View>

      {renderButton()}
    </View>
  );
};

export default ChatBarActions;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      width: '100%',
      justifyContent: 'space-between',
    },
    leftActions: {
      flexDirection: 'row',
      gap: 8,
    },
    rightActions: {
      flexDirection: 'row',
      gap: 8,
      alignItems: 'center',
    },
    toggleButton: {
      padding: 8,
      borderRadius: 9999,
      borderWidth: 1,
      borderColor: theme.border.contrast,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 4,
      height: 36,
    },
    toggleText: {
      color: theme.text.contrastPrimary,
      fontSize: fontSizes.sm,
      lineHeight: lineHeights.sm,
    },
  });
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest __tests__/ChatBarActions.test.tsx --no-coverage`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add components/chat-screen/ChatBarActions.tsx __tests__/ChatBarActions.test.tsx
git commit -m "feat: update ChatBarActions — unified + button, remove Sources button"
```

---

### Task 5: Update `ChatBar` — integrate `useAttachment` and attachment previews

**Files:**
- Modify: `components/chat-screen/ChatBar.tsx`
- Modify: `__tests__/ChatBar.test.tsx`

Replace `useImageAttachment` with `useAttachment`. Replace the single image preview with an attachment row using `AttachmentThumbnail`. Replace `ImageSourceSheet` with `AttachmentSheet`. Remove `onSelectSource` and `activeSourcesCount` props.

- [ ] **Step 1: Update the `ChatBar.test.tsx` mocks and tests**

Update the mock for `ChatBarActions` to reflect new props (no `onSelectSource`, `activeSourcesCount`; add `onAttach`, `hasAttachments`). Update the mock for `AttachmentSheet` replacing `ImageSourceSheet`. Remove source-related tests. Add attachment-related tests.

Key changes to `__tests__/ChatBar.test.tsx`:

1. Replace `ImageSourceSheet` mock with `AttachmentSheet` mock
2. Replace the `ChatBarActions` mock — remove `onSelectSource`/`activeSourcesCount`, add `onAttach`/`hasAttachments`
3. Replace `react-native-image-picker` mock with `useAttachment` hook mock
4. Remove test: "passes activeSourcesCount to ChatBarActions"
5. Remove test: "calls onSelectSource when source button is pressed"
6. Update test: vision model attachment tests → now test "+" button always present
7. Remove `onSelectSource` and `activeSourcesCount` from `defaultProps`

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest __tests__/ChatBar.test.tsx --no-coverage`
Expected: FAIL — prop mismatches

- [ ] **Step 3: Update `ChatBar` component**

Modify `components/chat-screen/ChatBar.tsx`:

1. Replace `import ImageSourceSheet` with `import AttachmentSheet`
2. Replace `import { useImageAttachment }` with `import { useAttachment }`
3. Replace `import CloseIcon` — no longer needed at this level (handled by `AttachmentThumbnail`)
4. Add `import AttachmentThumbnail from './AttachmentThumbnail'`
5. Remove props: `onSelectSource`, `activeSourcesCount`
6. Add prop: `isVisionModel` (boolean, computed by parent)
7. Replace `useImageAttachment()` call with `useAttachment()` call
8. Replace single image preview block with attachment row mapping over `attachments`
9. Replace `ImageSourceSheet` with `AttachmentSheet`
10. Update `ChatBarActions` props — remove `onSelectSource`/`activeSourcesCount`/`isVisionModel`/`onAttachImage`, add `onAttach`/`hasAttachments`
11. Update `handleSend` to pass attachments instead of just `imagePath`
12. Update `handleAttachImage` → `handleAttach` that opens the unified sheet

The `onSend` callback signature changes from `(userInput: string, imagePath?: string)` to `(userInput: string, imagePath?: string, attachments?: Attachment[])` to pass document attachments to the parent.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest __tests__/ChatBar.test.tsx --no-coverage`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add components/chat-screen/ChatBar.tsx __tests__/ChatBar.test.tsx
git commit -m "feat: integrate useAttachment and AttachmentSheet into ChatBar"
```

---

### Task 6: Update `ChatScreen` — handle attachments in send flow

**Files:**
- Modify: `components/chat-screen/ChatScreen.tsx`

Update `ChatScreen` to pass attachments through the send flow. For inline documents, inject text into context. For RAG documents, include firstChunk alongside vector store results. Remove `SourceSelectSheet` import and usage. Remove `sourceBottomSheetModalRef`. Update `handleSendMessage` to accept attachments.

- [ ] **Step 1: Update `ChatScreen.tsx`**

Modify `components/chat-screen/ChatScreen.tsx`:

1. Remove imports: `SourceSelectSheet`, `sourceBottomSheetModalRef`
2. Remove `handlePresentSourceSheet` callback
3. Remove `enabledSources` computation
4. Remove `<SourceSelectSheet>` JSX
5. Remove `onSelectSource` and `activeSourcesCount` from `<ChatBar>` props
6. Add `isVisionModel` prop to `<ChatBar>`
7. Update `handleSendMessage` signature to accept `attachments?: Attachment[]`
8. Update `prepareContext` call: build `enabledSources` from RAG attachments' `sourceId` values, include `firstChunk` from each RAG attachment
9. For inline document attachments, add their `inlineText` to the context array

Updated `handleSendMessage`:

```typescript
const handleSendMessage = async (
  userInput: string,
  imagePath?: string,
  attachments?: Attachment[]
) => {
  if ((!userInput.trim() && !imagePath && (!attachments || attachments.length === 0)) || isGenerating) return;
  if (!(await checkIfChatExists(db, chatId!))) {
    const newChatTitle =
      userInput.length > 25 ? userInput.slice(0, 25) + '...' : userInput;
    await addChat(newChatTitle, model!.id);
  }

  inputRef.current?.clear();
  Keyboard.dismiss();
  updateLastUsed(chatId!);

  // Build context from attachments
  const context: string[] = [];

  if (attachments) {
    for (const att of attachments) {
      if (att.type === 'document' && att.strategy === 'inline' && att.inlineText) {
        context.push(
          `\n --- Source: ${att.name || 'Document'} (Full Text) --- \n ${att.inlineText} \n --- End of Source ---`
        );
      }
    }

    // RAG attachments: get sourceIds and firstChunks
    const ragAttachments = attachments.filter(
      (a) => a.type === 'document' && a.strategy === 'rag'
    );
    if (ragAttachments.length > 0 && userInput.trim()) {
      const enabledSources = ragAttachments
        .map((a) => a.sourceId)
        .filter((id): id is number => id !== undefined);

      // Always include first chunks
      for (const att of ragAttachments) {
        if (att.firstChunk) {
          context.push(
            `\n --- Source: ${att.name || 'Document'} (Overview) --- \n ${att.firstChunk} \n --- End of Source ---`
          );
        }
      }

      // Query vector store for relevant chunks
      if (enabledSources.length > 0) {
        const ragContext = await prepareContext(
          userInput,
          enabledSources,
          vectorStore!
        );
        context.push(...ragContext);
      }
    }
  }

  const settings: ChatSettings = {
    systemPrompt: chatSettings.systemPrompt,
    contextWindow: parseInt(chatSettings.contextWindow),
    thinkingEnabled: chatSettings.thinkingEnabled,
  };

  await sendChatMessage(userInput, chatId!, context, settings, imagePath);
};
```

- [ ] **Step 2: Run all ChatScreen-related tests**

Run: `npx jest --no-coverage`
Expected: PASS (some tests may need updating in the next task)

- [ ] **Step 3: Commit**

```bash
git add components/chat-screen/ChatScreen.tsx
git commit -m "feat: handle inline and RAG attachments in ChatScreen send flow"
```

---

### Task 7: Remove Sources screen and drawer entry

**Files:**
- Delete: `app/(drawer)/sources.tsx`
- Modify: `app/(drawer)/_layout.tsx`
- Modify: `components/drawer/DrawerMenu.tsx`

- [ ] **Step 1: Remove Sources screen from drawer layout**

In `app/(drawer)/_layout.tsx`, remove lines 50-53 (the `Drawer.Screen` for sources):

```typescript
// Remove this block:
<Drawer.Screen
  name="sources"
  options={{
    title: 'Sources',
  }}
/>
```

- [ ] **Step 2: Remove Sources entry from drawer menu**

In `components/drawer/DrawerMenu.tsx`:

1. Remove import: `SourceIcon` (line 13)
2. Remove the Sources `DrawerItem` (lines 90-95):

```typescript
// Remove this block:
<DrawerItem
  icon={<SourceIcon width={18} height={18} style={styles.icon} />}
  label="Sources"
  active={pathname === '/sources'}
  onPress={() => navigate('/sources')}
/>
```

- [ ] **Step 3: Delete the Sources screen file**

```bash
rm app/\(drawer\)/sources.tsx
```

- [ ] **Step 4: Commit**

```bash
git add -A app/\(drawer\)/sources.tsx app/\(drawer\)/_layout.tsx components/drawer/DrawerMenu.tsx
git commit -m "feat: remove Sources screen and drawer navigation entry"
```

---

### Task 8: Remove orphaned components

**Files:**
- Delete: `components/bottomSheets/ImageSourceSheet.tsx`
- Delete: `components/bottomSheets/SourceSelectSheet.tsx`
- Delete: `components/bottomSheets/SourceManagementSheet.tsx`
- Delete: `components/bottomSheets/source-select/ActiveSourcesSection.tsx`
- Delete: `components/bottomSheets/source-select/SourceListSection.tsx`
- Delete: `components/bottomSheets/source-select/EmptySourcesView.tsx`
- Delete: `components/sources/SourceCard.tsx`
- Delete: `hooks/useImageAttachment.ts`
- Delete: `hooks/useSourceUpload.ts`

- [ ] **Step 1: Verify no remaining imports of these files**

```bash
npx grep -r "ImageSourceSheet\|SourceSelectSheet\|SourceManagementSheet\|ActiveSourcesSection\|SourceListSection\|EmptySourcesView\|SourceCard\|useImageAttachment\|useSourceUpload" --include="*.ts" --include="*.tsx" components/ hooks/ app/ store/ | grep -v "node_modules"
```

If any remaining references are found, update those files first.

- [ ] **Step 2: Delete orphaned files**

```bash
rm components/bottomSheets/ImageSourceSheet.tsx
rm components/bottomSheets/SourceSelectSheet.tsx
rm components/bottomSheets/SourceManagementSheet.tsx
rm -rf components/bottomSheets/source-select/
rm -rf components/sources/
rm hooks/useImageAttachment.ts
rm hooks/useSourceUpload.ts
```

- [ ] **Step 3: Run full test suite**

Run: `npx jest --no-coverage`
Expected: PASS — no broken imports

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove orphaned source/image components replaced by unified attachment flow"
```

---

### Task 9: Update existing tests for compatibility

**Files:**
- Modify: `__tests__/ChatBar.test.tsx`
- Modify: `__tests__/ChatBarActions.test.tsx`

After all component changes, run the full test suite and fix any remaining test failures due to prop changes, removed mocks, or import errors.

- [ ] **Step 1: Run full test suite**

Run: `npx jest --no-coverage`
Capture all failures.

- [ ] **Step 2: Fix any remaining test issues**

Address each failure — likely candidates:
- Tests referencing `onSelectSource` or `activeSourcesCount`
- Tests importing deleted components
- Tests expecting "Sources" text in rendered output

- [ ] **Step 3: Run full test suite again**

Run: `npx jest --no-coverage`
Expected: ALL PASS

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "test: fix test suite after inline attachment flow migration"
```
