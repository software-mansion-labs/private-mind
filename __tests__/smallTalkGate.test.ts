import { isSmallTalk } from '../utils/web/buildSearchQuery';

describe('small talk never reaches the planner', () => {
  it.each([
    'Dzięki, to bardzo pomocne.',
    'dzieki',
    'Thanks, that was helpful.',
    'ok',
    'Świetnie, dziękuję',
    'Cześć',
    'hello',
  ])('gates %p', (text) => {
    expect(isSmallTalk(text)).toBe(true);
  });

  it.each([
    'Dzięki. A ile kosztuje karnet?',
    'Ok, kiedy jest następny mecz reprezentacji?',
    'Thanks — what is the price of a Falcon 9 launch?',
    'Hej, jaka jest pogoda w Zakopanem?',
    'Super Bowl kiedy',
    'ok 2026 kiedy premiera',
    'Ile kosztuje bilet?',
    'Kto jest prezesem SpaceX?',
    'Dzięki za wszystko co do tej pory zrobiłeś i powiedz mi jeszcze jedno',
  ])('lets %p through to the planner', (text) => {
    expect(isSmallTalk(text)).toBe(false);
  });

  it('ignores empty input', () => {
    expect(isSmallTalk('')).toBe(false);
    expect(isSmallTalk('   ')).toBe(false);
  });
});
