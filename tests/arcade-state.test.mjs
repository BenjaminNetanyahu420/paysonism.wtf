import assert from "node:assert/strict";
import test from "node:test";
import { createRun, getFeatureFlags, getMode, readBest, scoreAction, writeBest } from "../js/mercury-arcade-state.js";

test("arcade scoring advances a capped combo and honors cooldowns", () => {
  let run = createRun();
  let result = scoreAction(run, { key: "relay", base: 60, now: 10000, cooldown: 900 });
  assert.equal(result.points, 60);
  run = result.run;
  result = scoreAction(run, { key: "route-about", base: 25, now: 11000, cooldown: 12000 });
  assert.equal(result.points, 50);
  run = result.run;
  assert.equal(scoreAction(run, { key: "route-about", base: 25, now: 12000, cooldown: 12000 }).accepted, false);
});

test("arcade mode transitions use the defined score thresholds", () => {
  assert.equal(getMode(249).mode, "standby");
  assert.equal(getMode(250).mode, "linked");
  assert.equal(getMode(750).mode, "sync");
  assert.equal(getMode(1500).mode, "overclock");
});

test("best-score storage fails safely and feature gates respect motion and touch", () => {
  const storage = { value: "40", getItem() { return this.value; }, setItem(key, value) { this.value = value; } };
  assert.equal(readBest(storage, "best"), 40);
  assert.equal(writeBest(storage, "best", 75), true);
  assert.equal(readBest({ getItem() { throw new Error("blocked"); } }, "best"), 0);
  assert.deepEqual(getFeatureFlags({ reducedMotion: true, touch: false }), { pointer: false, particles: false, monitorMotion: false, idleMotion: false, touchFeedback: true });
  assert.equal(getFeatureFlags({ touch: true }).pointer, false);
});
