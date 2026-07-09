const insets = { top: 0, bottom: 0, left: 0, right: 0 };

export const useSafeAreaInsets = () => insets;
export const SafeAreaProvider = ({ children }: { children: unknown }) =>
  children;
export const SafeAreaView = 'SafeAreaView';
