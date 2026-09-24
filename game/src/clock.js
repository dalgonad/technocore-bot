export function createFrameClock() {
  let previous = null;
  let wasActive = false;

  return {
    reset() {
      previous = null;
      wasActive = false;
    },
    step(now, active) {
      const elapsed = active && wasActive && previous !== null ? Math.max(0, (now - previous) / 1000) : 0;
      previous = now;
      wasActive = active;
      return elapsed;
    },
  };
}
