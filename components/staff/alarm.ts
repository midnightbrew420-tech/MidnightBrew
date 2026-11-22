"use client";
// Repeating chime that plays while there are unopened orders.
// Browsers only allow sound after a user gesture, so call unlock() from a click.

let ctx: AudioContext | null = null;

export function unlockAudio() {
  try {
    if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
    loadCoffee();
    return ctx.state !== "closed";
  } catch {
    return false;
  }
}

export function audioReady() {
  return !!ctx && ctx.state === "running";
}

export function chime() {
  if (!ctx || ctx.state !== "running") return;
  const now = ctx.currentTime;
  [880, 1175, 1568].forEach((freq, i) => {
    const o = ctx!.createOscillator();
    const g = ctx!.createGain();
    o.type = "sine";
    o.frequency.value = freq;
    const t = now + i * 0.18;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    o.connect(g).connect(ctx!.destination);
    o.start(t);
    o.stop(t + 0.4);
  });
  try {
    navigator.vibrate?.([200, 100, 200]);
  } catch {}
}

// ---------------------------------------------------------------------------
// Staff new-order alert: a short two-note chime, then a voice saying "Coffee!"
// (public/sounds/coffee.mp3, replace that file to change the voice). It plays
// through the same audio as the chime, so it works wherever the chime works.

let coffee: AudioBuffer | null = null;
let loading = false;

function loadCoffee() {
  if (coffee || loading || !ctx) return;
  loading = true;
  fetch("/sounds/coffee.mp3")
    .then((r) => r.arrayBuffer())
    .then((b) => new Promise<AudioBuffer>((ok, fail) => ctx!.decodeAudioData(b, ok, fail)))
    .then((buf) => (coffee = buf))
    .catch(() => {})
    .finally(() => (loading = false));
}

export function newOrderSound() {
  if (ctx && ctx.state === "running") {
    const now = ctx.currentTime;
    [1175, 1568].forEach((freq, i) => {
      const o = ctx!.createOscillator();
      const g = ctx!.createGain();
      o.type = "sine";
      o.frequency.value = freq;
      const t = now + i * 0.14;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.45, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
      o.connect(g).connect(ctx!.destination);
      o.start(t);
      o.stop(t + 0.3);
    });
    if (coffee) {
      const src = ctx.createBufferSource();
      src.buffer = coffee;
      src.connect(ctx.destination);
      src.start(now + 0.4);
    } else {
      loadCoffee();
    }
  }
  try {
    navigator.vibrate?.([200, 100, 200]);
  } catch {}
}
