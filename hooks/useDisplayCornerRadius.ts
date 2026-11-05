import { useEffect, useState } from 'react';
import {
  getDisplayCornerRadius,
  STRAIGHT_CORNER_RADIUS,
} from '../modules/display-corners';

export const useDisplayCornerRadius = () => {
  const [radius, setRadius] = useState(STRAIGHT_CORNER_RADIUS);

  useEffect(() => {
    getDisplayCornerRadius().then(setRadius);
  }, []);

  return radius;
};
