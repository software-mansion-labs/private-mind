import { renderHook } from '@testing-library/react-native';
import {
  swarmGeometry,
  SWARM_CLEARANCE_WITH_DESCRIPTION,
  SWARM_CLEARANCE_WITH_PROMPTS,
  useSwarmOncePerNewChat,
} from '../components/chat-screen/NewChatSwarm';

jest.mock('../context/ThemeContext', () => ({
  useTheme: () => ({ theme: require('./helpers/renderWithTheme').testTheme }),
}));

describe('swarmGeometry', () => {
  it('keeps the sphere clear of the heading on a reference screen', () => {
    const { radius, canvasTop, centerInCanvas } = swarmGeometry(
      844,
      SWARM_CLEARANCE_WITH_PROMPTS
    );
    expect(radius).toBe(95);
    expect(canvasTop + centerInCanvas - radius).toBeCloseTo(
      844 * 0.405 + SWARM_CLEARANCE_WITH_PROMPTS
    );
  });

  it('sits lower when a description is under the heading', () => {
    const center = (clearance: number) => {
      const g = swarmGeometry(844, clearance);
      return g.canvasTop + g.centerInCanvas;
    };
    expect(center(SWARM_CLEARANCE_WITH_DESCRIPTION)).toBeGreaterThan(
      center(SWARM_CLEARANCE_WITH_PROMPTS)
    );
  });

  it('shrinks on short screens and never grows past the reference size', () => {
    expect(swarmGeometry(667, 25).radius).toBeLessThan(95);
    expect(swarmGeometry(1000, 25).radius).toBe(95);
  });

  it('never extends the canvas past the screen', () => {
    const { canvasTop, canvasHeight } = swarmGeometry(844, 25);
    expect(canvasTop).toBeGreaterThanOrEqual(0);
    expect(canvasTop + canvasHeight).toBeLessThanOrEqual(844);
  });
});

describe('useSwarmOncePerNewChat', () => {
  const renderOnce = (active: boolean, starts = 1) =>
    renderHook(
      ({ active, starts }: { active: boolean; starts: number }) =>
        useSwarmOncePerNewChat(active, starts),
      { initialProps: { active, starts } }
    );

  it('waits until the hero is shown', () => {
    const { result } = renderOnce(false);
    expect(result.current).toBe(false);
  });

  it('does not replay after the hero hides and returns in the same chat', () => {
    const { result, rerender } = renderOnce(true);
    expect(result.current).toBe(true);
    rerender({ active: false, starts: 1 });
    expect(result.current).toBe(false);
    rerender({ active: true, starts: 1 });
    expect(result.current).toBe(false);
  });

  it('replays when a new chat starts on the same screen', () => {
    const { result, rerender } = renderOnce(true);
    rerender({ active: false, starts: 1 });
    rerender({ active: true, starts: 1 });
    expect(result.current).toBe(false);
    rerender({ active: true, starts: 2 });
    expect(result.current).toBe(true);
  });
});
