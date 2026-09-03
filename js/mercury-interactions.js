import { COMBO_WINDOW_MS, createRun, getFeatureFlags, getMode, readBest, scoreAction, writeBest } from "./mercury-arcade-state.js";

const BEST_KEY = "paysonism-mercury-arcade-best";
const CONTROL_COOLDOWN = 900;
const ROUTE_COOLDOWN = 12000;
const MONITOR_COOLDOWN = 25000;
const DWELL_MS = 550;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const touchDevice = window.matchMedia("(hover: none), (pointer: coarse)").matches;
const flags = getFeatureFlags({ reducedMotion, touch: touchDevice });
const banner = document.getElementById("mercury-banner");

if (!banner) throw new Error("Mercury arcade requires #mercury-banner.");

function getStorage() {
  try { return window.localStorage; } catch { return null; }
}

const storage = getStorage();
let run = createRun(readBest(storage, BEST_KEY));
let visible = document.visibilityState === "visible";
let lastActivity = Date.now();
let idleStep = -1;
let routeArmed = false;
let armedIndex = 0;
let lastMode = getMode(run.score).mode;
let particleFrame = 0;
let idleTimer = 0;
let canvas;
let context;
let bannerReadout;
const particles = [];
const controls = [];
const pendingTimers = new Set();
const monitorTimers = new Map();

function schedule(callback, delay) {
  const timer = window.setTimeout(() => { pendingTimers.delete(timer); callback(); }, delay);
  pendingTimers.add(timer);
  return timer;
}

function cancelTimer(timer) {
  if (timer) window.clearTimeout(timer);
  pendingTimers.delete(timer);
}

function clearTransientTimers() {
  pendingTimers.forEach((timer) => window.clearTimeout(timer));
  pendingTimers.clear();
  monitorTimers.forEach((timer) => window.clearTimeout(timer));
  monitorTimers.clear();
}

function clearVisualEffects() {
  bannerReadout?.classList.remove("is-visible");
  document.querySelectorAll(".mercury-arcade-panel-readout").forEach((readout) => readout.classList.remove("is-visible"));
  document.querySelectorAll(".arcade-panel-online").forEach((panel) => panel.classList.remove("arcade-panel-online"));
  document.querySelectorAll(".mercury-monitor-slice, .mercury-transmission-band").forEach((node) => node.remove());
  document.querySelectorAll(".mercury-monitor.is-transmitting").forEach((monitor) => monitor.classList.remove("is-transmitting"));
}

function activity() {
  lastActivity = Date.now();
  idleStep = -1;
  banner.classList.remove("arcade-idle");
}

function formatScore(value) { return String(value).padStart(4, "0"); }

function createReadouts() {
  bannerReadout = document.createElement("div");
  bannerReadout.className = "mercury-arcade-banner-readout";
  bannerReadout.setAttribute("aria-hidden", "true");
  banner.appendChild(bannerReadout);
  document.querySelectorAll(".Cbox, .Vbox").forEach((panel) => {
    const header = panel.querySelector(".Ctop, .Vtop");
    if (!header) return;
    const readout = document.createElement("span");
    readout.className = "mercury-arcade-panel-readout";
    readout.setAttribute("aria-hidden", "true");
    header.appendChild(readout);
    panel._mercuryReadout = readout;
  });
}

function showReadout(text, source) {
  bannerReadout.textContent = text;
  bannerReadout.classList.remove("is-visible");
  void bannerReadout.offsetWidth;
  bannerReadout.classList.add("is-visible");
  cancelTimer(bannerReadout._timer);
  bannerReadout._timer = schedule(() => bannerReadout.classList.remove("is-visible"), 1350);
  const panel = source?.closest?.(".Cbox, .Vbox");
  if (!panel?._mercuryReadout) return;
  panel._mercuryReadout.textContent = text;
  panel._mercuryReadout.classList.remove("is-visible");
  void panel._mercuryReadout.offsetWidth;
  panel._mercuryReadout.classList.add("is-visible");
  cancelTimer(panel._mercuryReadout._timer);
  panel._mercuryReadout._timer = schedule(() => panel._mercuryReadout.classList.remove("is-visible"), 1350);
}

function flash(node, className, duration = 180) {
  node.classList.remove(className);
  void node.offsetWidth;
  node.classList.add(className);
  schedule(() => node.classList.remove(className), duration);
}

function pulseBanner(power = "normal") { flash(banner, "arcade-pulse-" + power, power === "strong" ? 260 : 170); }

function applyMode(mode) {
  banner.dataset.arcadeMode = mode.mode;
  if (mode.mode === lastMode) return;
  lastMode = mode.mode;
  showReadout(mode.label + " // RUN " + formatScore(run.score));
  pulseBanner(mode.mode === "overclock" ? "strong" : "normal");
}

function acceptAction(target, cooldown) {
  const result = scoreAction(run, {
    key: target.dataset.arcadeId,
    base: Number(target.dataset.arcadeValue),
    now: Date.now(),
    cooldown
  });
  if (!result.accepted) return false;
  run = result.run;
  writeBest(storage, BEST_KEY, run.best);
  applyMode(result.mode);
  showReadout("+" + result.points + " // RUN " + formatScore(run.score) + " // CH " + run.combo + " // HI " + formatScore(run.best), target);
  return true;
}

function setupParticles() {
  if (!flags.particles) return;
  canvas = document.createElement("canvas");
  canvas.className = "mercury-arcade-sparks";
  canvas.setAttribute("aria-hidden", "true");
  document.body.appendChild(canvas);
  context = canvas.getContext("2d");
  resizeCanvas();
}

function resizeCanvas() {
  if (!canvas) return;
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(window.innerWidth * ratio);
  canvas.height = Math.floor(window.innerHeight * ratio);
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function spark(x, y, count = 4) {
  if (!context || !visible) return;
  const colors = ["#e1e8e9", "#a8c3cc", "#879da5", "#beccc9"];
  for (let index = 0; index < Math.min(count, 72 - particles.length); index += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = .45 + Math.random() * 1.25;
    particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - .25, start: performance.now(), life: 130 + Math.random() * 220, color: colors[index % colors.length] });
  }
  if (!particleFrame && particles.length) particleFrame = requestAnimationFrame(drawParticles);
}

function drawParticles(now) {
  particleFrame = 0;
  if (!visible || !context) return;
  context.clearRect(0, 0, window.innerWidth, window.innerHeight);
  for (let index = particles.length - 1; index >= 0; index -= 1) {
    const particle = particles[index];
    const age = now - particle.start;
    if (age >= particle.life) { particles.splice(index, 1); continue; }
    particle.x += particle.vx * 1.7;
    particle.y += particle.vy * 1.7;
    particle.vy += .035;
    particle.vx *= .97;
    context.globalAlpha = 1 - age / particle.life;
    context.fillStyle = particle.color;
    context.fillRect(Math.round(particle.x), Math.round(particle.y), age < 90 ? 2 : 1, 1);
  }
  context.globalAlpha = 1;
  if (particles.length) particleFrame = requestAnimationFrame(drawParticles);
}

function setArmedControl() {
  controls.forEach((control) => control.classList.remove("arcade-armed"));
  const armed = controls[armedIndex];
  if (!armed) return;
  armed.classList.add("arcade-armed");
  banner.dataset.arcadeTarget = armed.dataset.arcadeId;
}

function registerControls() {
  const labels = { "lamp-left": "Left lamp assembly", relay: "Electrical relay", "lamp-right": "Right lamp assembly", indicators: "Indicator lamps", "signal-left": "Left signal strip", "signal-right": "Right signal strip" };
  document.querySelectorAll('[data-arcade-kind="control"]').forEach((control) => {
    control.classList.add("mercury-machine-control");
    control.setAttribute("role", "button");
    control.setAttribute("tabindex", "0");
    control.setAttribute("aria-label", labels[control.dataset.arcadeId] || "Banner control");
    control.addEventListener("click", (event) => {
      activity();
      const isArmed = control === controls[armedIndex];
      flash(control, isArmed ? "arcade-contact-hit" : "arcade-contact-miss");
      const rect = control.getBoundingClientRect();
      const x = event.detail ? event.clientX : rect.left + rect.width / 2;
      const y = event.detail ? event.clientY : rect.top + rect.height / 2;
      spark(x, y, isArmed ? 6 : 2);
      if (!isArmed || !acceptAction(control, CONTROL_COOLDOWN)) return;
      routeArmed = true;
      armedIndex = (armedIndex + 1) % controls.length;
      setArmedControl();
      pulseBanner(run.combo >= 3 ? "strong" : "normal");
    });
    control.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); control.click(); }
    });
    controls.push(control);
  });
  setArmedControl();
}

function registerRoutes() {
  document.querySelectorAll('[data-arcade-kind="route"]').forEach((route) => {
    route.classList.add("mercury-arcade-button");
    route.addEventListener("click", () => {
      activity();
      flash(route, "arcade-switch-hit", 120);
      if (!routeArmed || Date.now() - run.lastValidAt > COMBO_WINDOW_MS || !acceptAction(route, ROUTE_COOLDOWN)) {
        routeArmed = false;
        return;
      }
      routeArmed = false;
      pulseBanner("normal");
    });
  });
}

function getImages(node) {
  try {
    const images = JSON.parse(node.dataset.images || "[]");
    return Array.isArray(images) ? images.filter((image) => typeof image === "string" && image) : [];
  } catch { return []; }
}

function createMonitorStatic(monitor, image) {
  if (!flags.monitorMotion || !image.clientWidth) return;
  const source = image.currentSrc || image.src;
  for (let row = 0; row < 3; row += 1) {
    const slice = document.createElement("span");
    slice.className = "mercury-monitor-slice";
    slice.style.top = (4 + row * 41) + "px";
    slice.style.height = "39px";
    slice.style.backgroundImage = "url('" + source.replace(/'/g, "%27") + "')";
    slice.style.backgroundSize = image.clientWidth + "px " + image.clientHeight + "px";
    slice.style.backgroundPosition = (row % 2 ? "-2px" : "2px") + " -" + (row * 41) + "px";
    monitor.appendChild(slice);
    schedule(() => slice.remove(), 105);
  }
}

function transmit(monitor, image, source, nextIndex) {
  if (!flags.monitorMotion || !source || image.src.endsWith(source)) return;
  const preload = new Image();
  preload.onload = () => {
    if (!visible) return;
    const width = image.clientWidth;
    const height = image.clientHeight;
    if (!width || !height) { image.src = source; return; }
    monitor.classList.add("is-transmitting");
    for (let row = 0; row < 6; row += 1) {
      const band = document.createElement("span");
      const bandHeight = Math.ceil(height / 6);
      band.className = "mercury-transmission-band";
      band.style.top = (3 + row * bandHeight) + "px";
      band.style.height = bandHeight + "px";
      band.style.backgroundImage = "url('" + source.replace(/'/g, "%27") + "')";
      band.style.backgroundSize = width + "px " + height + "px";
      band.style.backgroundPosition = "0px -" + (row * bandHeight) + "px";
      band.style.animationDelay = (row * 42) + "ms";
      monitor.appendChild(band);
    }
    schedule(() => {
      image.src = source;
      monitor.dataset.screenshotIndex = String(nextIndex);
      monitor.querySelectorAll(".mercury-transmission-band").forEach((band) => band.remove());
      monitor.classList.remove("is-transmitting");
    }, 350);
  };
  preload.src = source;
}

function registerMonitors() {
  document.querySelectorAll('[data-arcade-kind="monitor"]').forEach((monitor) => {
    const image = monitor.querySelector(".project-thumb");
    if (!image) return;
    monitor.classList.add("mercury-monitor");
    const label = document.createElement("span");
    label.className = "mercury-monitor-label";
    label.textContent = "SIGNAL LOCK";
    monitor.appendChild(label);
    monitor.addEventListener("mouseenter", () => {
      activity();
      const timer = schedule(() => {
        if (!monitor.matches(":hover") || !visible) return;
        flash(monitor, "is-scanning", 620);
        createMonitorStatic(monitor, image);
        if (acceptAction(monitor, MONITOR_COOLDOWN)) pulseBanner("normal");
        const images = getImages(monitor);
        if (images.length > 1) {
          const current = Number(monitor.dataset.screenshotIndex || "0");
          const next = (current + 1) % images.length;
          transmit(monitor, image, images[next], next);
        }
      }, DWELL_MS);
      monitorTimers.set(monitor, timer);
    });
    monitor.addEventListener("mouseleave", () => { cancelTimer(monitorTimers.get(monitor)); monitorTimers.delete(monitor); });
  });
}

function registerMechanicalButtons() {
  const selector = "#banner-nav a, .ft-butn2-1, .ft-butn-2, .ft-social, .sb-butn, .forum-button";
  document.querySelectorAll(selector).forEach((button) => button.classList.add("mercury-arcade-button"));
  document.addEventListener("pointerdown", (event) => {
    activity();
    const button = event.target.closest(selector + ", [data-arcade-kind='control']");
    if (!button) return;
    button.classList.add("arcade-pressed");
    if (button.matches("#banner-nav a, .ft-butn-2")) spark(event.clientX, event.clientY, 2);
  }, { passive: true });
  const release = () => document.querySelectorAll(".arcade-pressed").forEach((button) => button.classList.remove("arcade-pressed"));
  document.addEventListener("pointerup", release, { passive: true });
  document.addEventListener("pointercancel", release, { passive: true });
}

function registerPanels() {
  if (!("IntersectionObserver" in window)) return;
  const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
    if (!entry.isIntersecting || entry.target.dataset.arcadeOnline) return;
    entry.target.dataset.arcadeOnline = "true";
    entry.target.classList.add("arcade-panel-online");
    schedule(() => entry.target.classList.remove("arcade-panel-online"), reducedMotion ? 70 : 330);
    observer.unobserve(entry.target);
  }), { rootMargin: "0px 0px -10% 0px", threshold: .1 });
  document.querySelectorAll(".Cbox, .Vbox").forEach((panel) => observer.observe(panel));
}

function updateIdle() {
  if (!visible || !flags.idleMotion) return;
  const elapsed = Date.now() - lastActivity;
  if (elapsed < 45000) return;
  banner.classList.add("arcade-idle");
  const step = Math.floor((elapsed - 45000) / 12000);
  if (step === idleStep) return;
  idleStep = step;
  pulseBanner(banner.dataset.arcadeMode === "overclock" ? "strong" : "normal");
  if (step % 3 === 0) showReadout("MAINTENANCE // " + getMode(run.score).label);
}

function startIdleClock() {
  if (!idleTimer) idleTimer = window.setInterval(updateIdle, 1000);
}

function stopIdleClock() {
  window.clearInterval(idleTimer);
  idleTimer = 0;
}

createReadouts();
setupParticles();
registerControls();
registerRoutes();
registerMonitors();
registerMechanicalButtons();
registerPanels();
document.addEventListener("pointermove", activity, { passive: true });
document.addEventListener("keydown", activity, { passive: true });
document.addEventListener("scroll", activity, { passive: true });
document.addEventListener("touchstart", activity, { passive: true });
window.addEventListener("resize", resizeCanvas, { passive: true });
startIdleClock();
document.addEventListener("visibilitychange", () => {
  visible = document.visibilityState === "visible";
  if (!visible) {
    clearTransientTimers();
    clearVisualEffects();
    stopIdleClock();
    if (particleFrame) cancelAnimationFrame(particleFrame);
    particleFrame = 0;
    particles.length = 0;
  } else {
    activity();
    startIdleClock();
  }
});
