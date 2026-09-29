export const DEFAULTS = Object.freeze({ seconds: 3, loop: true, transition: 'fade', zoom: 'off', pan: 'off' });
const choices = { transition: ['fade', 'cut', 'slide'], zoom: ['off', 'in', 'out'], pan: ['off', 'left', 'right', 'up', 'down'] };
export function validateSettings(patch) {
  for (const [key, value] of Object.entries(patch)) {
    if (!(key in DEFAULTS)) throw new Error('Unknown playback setting.');
    if (key === 'seconds' && (!Number.isFinite(value) || value < 0.5 || value > 60)) throw new Error('Choose between 0.5 and 60 seconds.');
    if (key === 'loop' && typeof value !== 'boolean') throw new Error('Loop must be on or off.');
    if (choices[key] && !choices[key].includes(value)) throw new Error(`Invalid ${key} option.`);
  }
  return patch;
}
export class Player {
  constructor(photos) {
    this.photos = Object.freeze([...photos]); this.settings = { ...DEFAULTS }; this.skipped = new Set();
    this.current = 0; this.playing = true; this.ended = false;
  }
  get included() { return this.photos.map((_, i) => i).filter(i => !this.skipped.has(i)); }
  configure(patch) { this.settings = { ...this.settings, ...validateSettings(patch) }; }
  select(index) {
    if (!Number.isInteger(index) || !this.photos[index] || this.skipped.has(index)) return false;
    this.current = index; this.ended = false; return true;
  }
  setSkipped(indices) {
    const next = new Set(indices);
    if ([...next].some(i => !Number.isInteger(i) || !this.photos[i])) throw new Error('Only the fixed collection can be selected.');
    const before = this.current; this.skipped = next;
    const included = this.included;
    if (!included.length) { this.current = -1; this.playing = false; }
    else if (before < 0 || next.has(before)) this.current = included.find(i => i > before) ?? included[0];
    this.ended = false; return before !== this.current;
  }
  advance(direction = 1) {
    const indices = this.included;
    if (!indices.length) return false;
    const target = indices.indexOf(this.current) + direction;
    if (target < 0 || target >= indices.length) {
      if (this.settings.loop) this.current = target < 0 ? indices.at(-1) : indices[0];
      else { if (direction > 0) { this.ended = true; this.playing = false; } return false; }
    } else this.current = indices[target];
    this.ended = false; return true;
  }
  togglePlayback() {
    if (!this.included.length) return false;
    if (this.ended) { this.current = this.included[0]; this.ended = false; this.playing = true; return true; }
    this.playing = !this.playing; return false;
  }
  reset() { this.settings = { ...DEFAULTS }; this.skipped.clear(); this.current = 0; this.playing = true; this.ended = false; }
}
export function motionFrames({ zoom, pan }) {
  const base = pan === 'off' ? 1 : 1.07;
  const startScale = base + (zoom === 'out' ? 0.12 : 0);
  const endScale = base + (zoom === 'in' ? 0.12 : 0);
  const x = pan === 'right' ? [-2.5, 2.5] : pan === 'left' ? [2.5, -2.5] : [0, 0];
  const y = pan === 'down' ? [-2.5, 2.5] : pan === 'up' ? [2.5, -2.5] : [0, 0];
  return [0, 1].map(i => ({ transform: `translate(${x[i]}%, ${y[i]}%) scale(${i ? endScale : startScale})` }));
}
