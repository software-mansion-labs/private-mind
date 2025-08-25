import React from 'react';

export const useStableCallback = <T extends Function>(callback: T): T => {
  const cbRef = React.useRef<T>(callback);
  cbRef.current = callback;

  return React.useCallback<any>((...args: any) => cbRef.current(...args), []);
};
