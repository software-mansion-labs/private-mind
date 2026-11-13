import {
  flattenContours,
  isInsideContours,
  sampleOutline,
} from '../components/swarm/logoPoints';
import {
  HEADING_OUTLINES,
  HEADING_UNITS_PER_EM,
} from '../components/swarm/headingOutlines';
import { NEW_CHAT_HEADING } from '../constants/chat-screen';

const sample = (text: string, count = 3000) =>
  sampleOutline(HEADING_OUTLINES[text].path, count, 7, HEADING_UNITS_PER_EM);

describe('heading points', () => {
  it('has outlines for both screen headings', () => {
    expect(HEADING_OUTLINES[NEW_CHAT_HEADING]).toBeDefined();
    expect(HEADING_OUTLINES['Welcome!']).toBeDefined();
  });

  it('returns exactly the requested number of points', () => {
    expect(sample(NEW_CHAT_HEADING)).toHaveLength(3000);
    expect(sample('Welcome!')).toHaveLength(3000);
  });

  it('is the same every time for the same seed', () => {
    expect(sample(NEW_CHAT_HEADING, 400)).toEqual(
      sample(NEW_CHAT_HEADING, 400)
    );
  });

  it('keeps every point on the line, in em units above the baseline', () => {
    const { advance } = HEADING_OUTLINES[NEW_CHAT_HEADING];
    for (const [x, y] of sample(NEW_CHAT_HEADING)) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(advance);
      expect(y).toBeGreaterThan(-1);
      expect(y).toBeLessThan(0.3);
    }
  });

  it('leaves the counter of the o in Welcome empty', () => {
    const contours = flattenContours(HEADING_OUTLINES['Welcome!'].path);
    const holes = contours.filter(
      (contour) => !isInsideContours(contours, contour[0])
    );
    expect(holes.length).toBeGreaterThan(0);
  });
});
