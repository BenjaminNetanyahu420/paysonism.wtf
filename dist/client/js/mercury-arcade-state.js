export const COMBO_WINDOW_MS = 7000;
export const MAX_COMBO = 4;
export const MILESTONES = [
  { score: 1500, mode: "overclock", label: "OVERCLOCK" },
  { score: 750, mode: "sync", label: "SYNC LOCK" },
  { score: 250, mode: "linked", label: "LINK ESTABLISHED" },
  { score: 0, mode: "standby", label: "STANDBY" }
];

export function createRun(best = 0) {
  return { score: 0, best: Math.max(0, Number(best) || 0), combo: 0, lastValidAt: 0, cooldowns: new Map() };
}

export function getMode(score) {
  return MILESTONES.find((milestone) => score >= milestone.score) || MILESTONES.at(-1);
}

export function scoreAction(run, { key, base, now, cooldown = 0 }) {
	const lastUsed = run.cooldowns.get(key);
	if (lastUsed !== undefined && now - lastUsed < cooldown) return { accepted: false, run, points: 0, mode: getMode(run.score) };

  const combo = now - run.lastValidAt <= COMBO_WINDOW_MS ? Math.min(MAX_COMBO, run.combo + 1) : 1;
  const points = Math.max(0, Number(base) || 0) * combo;
  const score = run.score + points;
  const next = { ...run, score, best: Math.max(run.best, score), combo, lastValidAt: now, cooldowns: new Map(run.cooldowns) };
  next.cooldowns.set(key, now);
  return { accepted: true, run: next, points, mode: getMode(score) };
}

export function readBest(storage, key) {
  try { return Math.max(0, Number(storage?.getItem(key)) || 0); } catch { return 0; }
}

export function writeBest(storage, key, best) {
  try { storage?.setItem(key, String(best)); return true; } catch { return false; }
}

export function getFeatureFlags({ reducedMotion = false, touch = false } = {}) {
  return { pointer: !reducedMotion && !touch, particles: !reducedMotion, monitorMotion: !reducedMotion, idleMotion: !reducedMotion, touchFeedback: true };
}
