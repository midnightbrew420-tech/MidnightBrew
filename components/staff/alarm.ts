"use client";
// Repeating chime that plays while there are unopened orders.
// Browsers only allow sound after a user gesture, so call unlock() from a click.

let ctx: AudioContext | null = null;

export function unlockAudio() {
  unlockVoice();
  try {
    if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
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
// Staff new-order alert: a short two-note chime, then the phone's voice says "Coffee!".

let voiceUnlocked = false;

// iPhone/iPad only speak after a tap has spoken once: say nothing, silently, on the first tap.
function unlockVoice() {
  try {
    if (voiceUnlocked || typeof speechSynthesis === "undefined") return;
    // Only a real tap counts. (Browsers without userActivation: try on every tap.)
    const active = (navigator as { userActivation?: { isActive: boolean } }).userActivation?.isActive;
    if (active === false) return;
    const u = new SpeechSynthesisUtterance(" ");
    u.volume = 0;
    speechSynthesis.speak(u);
    if (active) voiceUnlocked = true;
  } catch {}
}

function englishVoice() {
  try {
    const voices = speechSynthesis.getVoices();
    return (
      voices.find((v) => /^en[-_]US$/i.test(v.lang) && v.localService) ||
      voices.find((v) => /^en/i.test(v.lang)) ||
      null
    );
  } catch {
    return null;
  }
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
  }
  try {
    navigator.vibrate?.([200, 100, 200]);
  } catch {}
  try {
    if (typeof speechSynthesis === "undefined") return;
    speechSynthesis.cancel(); // never pile up while the alert repeats
    const u = new SpeechSynthesisUtterance("Coffee!");
    const v = englishVoice();
    if (v) u.voice = v;
    u.lang = v?.lang || "en-US";
    u.rate = 0.95;
    u.pitch = 1.1;
    u.volume = 1;
    setTimeout(() => speechSynthesis.speak(u), 350); // right after the chime
  } catch {}
}
