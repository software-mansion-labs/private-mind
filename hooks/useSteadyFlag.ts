import { useEffect, useRef, useState } from 'react';

export const useSteadyFlag = (value: boolean, holdMs: number): boolean => {
  const [steady, setSteady] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const clear = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
    };

    if (value) {
      clear();
      setSteady(true);
      return;
    }

    timer.current = setTimeout(() => {
      timer.current = null;
      setSteady(false);
    }, holdMs);
    return clear;
  }, [value, holdMs]);

  return steady;
};
