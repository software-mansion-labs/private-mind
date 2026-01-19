import React, { createContext, useContext, ReactNode } from 'react';
import { useSharedValue, SharedValue } from 'react-native-reanimated';

interface MessageListContextValue {
  blankSize: SharedValue<number>;
  containerHeight: SharedValue<number>;
  lastUserMessageHeight: SharedValue<number>;
  assistantMessageHeight: SharedValue<number>;
  keyboardHeight: SharedValue<number>;
  hasMessageBeenSent: SharedValue<boolean>;
  shouldScrollToEnd: SharedValue<boolean>;
}

const MessageListContext = createContext<MessageListContextValue | null>(null);

export function MessageListProvider({ children }: { children: ReactNode }) {
  const blankSize = useSharedValue(0);
  const containerHeight = useSharedValue(0);
  const lastUserMessageHeight = useSharedValue(0);
  const assistantMessageHeight = useSharedValue(0);
  const keyboardHeight = useSharedValue(0);
  const hasMessageBeenSent = useSharedValue(false);
  const shouldScrollToEnd = useSharedValue(false);

  return (
    <MessageListContext.Provider
      value={{
        blankSize,
        containerHeight,
        lastUserMessageHeight,
        assistantMessageHeight,
        keyboardHeight,
        hasMessageBeenSent,
        shouldScrollToEnd,
      }}
    >
      {children}
    </MessageListContext.Provider>
  );
}

export function useMessageListContext() {
  const context = useContext(MessageListContext);
  if (!context) {
    throw new Error(
      'useMessageListContext must be used within MessageListProvider'
    );
  }
  return context;
}
