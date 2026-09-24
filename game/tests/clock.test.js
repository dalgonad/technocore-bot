import test from 'node:test';
import assert from 'node:assert/strict';
import { createFrameClock } from '../src/clock.js';
import { createState, useTool, tick, finishFishing } from '../src/core.js';

test('the active clock preserves elapsed time at both high and low frame rates', () => {
  for (const framesPerSecond of [60, 30, 10, 4, 1]) {
    const clock = createFrameClock();
    const state = createState();
    const start = state.minute;
    clock.step(0, true);
    for (let frame = 1; frame <= framesPerSecond * 8; frame += 1) {
      tick(state, clock.step(frame * 1000 / framesPerSecond, true));
    }
    assert.ok(Math.abs(state.minute + state.timeRemainder - start - 8) < 1e-8, `${framesPerSecond} FPS`);
  }
});

test('paused frames and the first resumed frame cannot advance world time', () => {
  const clock = createFrameClock();
  assert.equal(clock.step(0, true), 0);
  assert.equal(clock.step(250, true), .25);
  assert.equal(clock.step(500, false), 0);
  assert.equal(clock.step(10_000, false), 0);
  assert.equal(clock.step(11_000, true), 0);
  assert.equal(clock.step(11_250, true), .25);
});

test('focus resets discard time away even if the browser suspended all animation frames', () => {
  const clock = createFrameClock();
  clock.step(0, true);
  assert.equal(clock.step(250, true), .25);
  clock.reset();
  assert.equal(clock.step(60_000, true), 0);
  assert.equal(clock.step(60_250, true), .25);
});

test('fishing reaches a catchable bite on schedule at four frames per second', () => {
  const state = createState();
  state.player = { x: 6.5, y: 23.5, facing: 'down', hp: 100 };
  state.tool = 'rod';
  assert.equal(useTool(state).ok, true);
  const biteAt = state.fishing.biteAt;
  const clock = createFrameClock();
  clock.step(0, true);
  let now = 0;
  while (state.fishing.phase === 'waiting' && now < 10_000) {
    now += 250;
    tick(state, clock.step(now, true));
  }
  assert.equal(state.fishing.phase, 'bite');
  assert.ok(now / 1000 >= biteAt && now / 1000 < biteAt + .25);
  assert.equal(finishFishing(state).ok, true);
  assert.equal(state.stats.fished, 1);
});
