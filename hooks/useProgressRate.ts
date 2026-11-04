import { useEffect, useRef, useState } from 'react';
import { RateSample, nextProgressRate } from '../utils/downloadEta';

export const useProgressRate = (progress: number) => {
  const lastSample = useRef<RateSample | null>(null);
  const [rate, setRate] = useState<number | undefined>(undefined);

  useEffect(() => {
    const sample = { progress, at: Date.now() };
    const previous = lastSample.current;
    lastSample.current = sample;
    if (!previous || progress < previous.progress) {
      setRate(undefined);
      return;
    }
    setRate((current) => nextProgressRate(current, previous, sample));
  }, [progress]);

  return rate;
};
