export type MobileTopBarScrollDirection = -1 | 0 | 1;

export type MobileTopBarScrollState = {
  hidden: boolean;
  lastScrollTop: number;
  lastDirection: MobileTopBarScrollDirection;
  directionTravel: number;
  lockUntilMs: number;
};

const TOP_RESET_SCROLL_TOP = 16;
const MIN_SCROLL_DELTA = 2;
const HIDE_AFTER_SCROLL_DOWN = 48;
const SHOW_AFTER_SCROLL_UP = 24;
const TOGGLE_LOCK_MS = 220;

export function createMobileTopBarScrollState(
  scrollTop = 0,
): MobileTopBarScrollState {
  return {
    hidden: false,
    lastScrollTop: Math.max(0, scrollTop),
    lastDirection: 0,
    directionTravel: 0,
    lockUntilMs: 0,
  };
}

export function updateMobileTopBarScrollState(
  state: MobileTopBarScrollState,
  currentScrollTop: number,
  nowMs: number,
): MobileTopBarScrollState {
  const boundedScrollTop = Math.max(0, currentScrollTop);
  const scrollDelta = boundedScrollTop - state.lastScrollTop;

  if (boundedScrollTop <= TOP_RESET_SCROLL_TOP) {
    return createMobileTopBarScrollState(boundedScrollTop);
  }

  if (Math.abs(scrollDelta) < MIN_SCROLL_DELTA) {
    return {
      ...state,
      lastScrollTop: boundedScrollTop,
    };
  }

  if (nowMs < state.lockUntilMs) {
    return {
      ...state,
      lastScrollTop: boundedScrollTop,
    };
  }

  const direction: MobileTopBarScrollDirection = scrollDelta > 0 ? 1 : -1;
  const directionTravel =
    direction === state.lastDirection
      ? state.directionTravel + Math.abs(scrollDelta)
      : Math.abs(scrollDelta);

  if (!state.hidden && direction === 1 && directionTravel >= HIDE_AFTER_SCROLL_DOWN) {
    return {
      hidden: true,
      lastScrollTop: boundedScrollTop,
      lastDirection: direction,
      directionTravel: 0,
      lockUntilMs: nowMs + TOGGLE_LOCK_MS,
    };
  }

  if (state.hidden && direction === -1 && directionTravel >= SHOW_AFTER_SCROLL_UP) {
    return {
      hidden: false,
      lastScrollTop: boundedScrollTop,
      lastDirection: direction,
      directionTravel: 0,
      lockUntilMs: nowMs + TOGGLE_LOCK_MS,
    };
  }

  return {
    ...state,
    lastScrollTop: boundedScrollTop,
    lastDirection: direction,
    directionTravel,
  };
}
