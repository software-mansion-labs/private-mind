import React from 'react';

// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
export const useStableCallback = <T extends Function>(callback: T): T => {
  const cbRef = React.useRef<T>(callback);
  cbRef.current = callback;

  return React.useCallback<any>((...args: any) => cbRef.current(...args), []);
};
