import { showAppTabBar } from '../apps/web/src/lib/showTabBar.js';

describe('showAppTabBar', () => {
  const idle = {
    busy: false,
    dedicationSheet: null,
    historyGroup: null,
    altarOpen: false,
    amendSheet: null,
    searchOpen: false,
  };

  it('shows Home/Calendar on the idle home screen', () => {
    expect(showAppTabBar(idle)).toBe(true);
  });

  it('hides the bar on the Dâng Hoa / Ban thờ sheet', () => {
    expect(showAppTabBar({ ...idle, dedicationSheet: {} })).toBe(false);
    expect(showAppTabBar({ ...idle, altarOpen: true })).toBe(false);
    expect(showAppTabBar({ ...idle, searchOpen: true })).toBe(false);
    expect(showAppTabBar({ ...idle, busy: true })).toBe(false);
  });
});
