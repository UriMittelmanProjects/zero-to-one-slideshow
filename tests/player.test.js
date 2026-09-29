import test from 'node:test';
import assert from 'node:assert/strict';
import { PHOTOS } from '../docs/photos.js';
import { Player, DEFAULTS, motionFrames } from '../docs/player.js';
import { readFileSync, existsSync } from 'node:fs';
test('exactly 83 fixed, unique photos and both asset sizes exist', () => {
  assert.equal(PHOTOS.length, 83); assert.equal(new Set(PHOTOS.map(p => p.id)).size, 83); assert.equal(new Set(PHOTOS.map(p => p.filename)).size, 83);
  for (const p of PHOTOS) { assert.ok(Object.isFrozen(p)); assert.ok(existsSync(new URL(`../docs/${p.src}`, import.meta.url))); assert.ok(existsSync(new URL(`../docs/${p.thumbnail}`, import.meta.url))); }
});
test('defaults match the requested slideshow', () => {
  const p = new Player(PHOTOS); assert.deepEqual(p.settings, { seconds: 3, loop: true, transition: 'fade', zoom: 'off', pan: 'off' }); assert.equal(p.included.length, 83); assert.ok(p.playing);
});
test('loop wraps in either direction and skipped endpoints stay excluded', () => {
  const p = new Player(PHOTOS); p.setSkipped([0, 82]); p.select(81); p.advance(); assert.equal(p.current, 1); p.advance(-1); assert.equal(p.current, 81);
});
test('stop at end holds last image; replay begins at first included photo', () => {
  const p = new Player(PHOTOS); p.configure({ loop: false }); p.setSkipped([0, 82]); p.select(81);
  assert.equal(p.advance(), false); assert.equal(p.current, 81); assert.equal(p.playing, false); assert.ok(p.ended);
  assert.ok(p.togglePlayback()); assert.equal(p.current, 1); assert.ok(p.playing); assert.equal(p.ended, false); assert.equal(p.advance(-1), false); assert.equal(p.current, 1);
});
test('skip current, all, and restore photos', () => {
  const p = new Player(PHOTOS); p.select(30); p.setSkipped([30, 31]); assert.equal(p.current, 32);
  p.setSkipped(PHOTOS.map((_, i) => i)); assert.equal(p.current, -1); assert.equal(p.playing, false); assert.equal(p.advance(), false); assert.equal(p.togglePlayback(), false);
  p.setSkipped([]); assert.equal(p.current, 0); p.togglePlayback(); assert.ok(p.playing);
});
test('one included photo loops or stops as configured', () => {
  const p = new Player(PHOTOS); p.setSkipped(PHOTOS.map((_, i) => i).filter(i => i !== 10)); assert.equal(p.current, 10); assert.ok(p.advance()); assert.equal(p.current, 10);
  p.configure({ loop: false }); assert.equal(p.advance(), false); assert.ok(p.ended);
});
test('invalid indices and settings cannot change the collection', () => {
  const p = new Player(PHOTOS);
  for (const value of [-1, 83, 1.5, 'https://example.com/photo.jpg']) { assert.equal(p.select(value), false); assert.throws(() => p.setSkipped([value])); }
  for (const patch of [{ seconds: 0 }, { seconds: Infinity }, { seconds: 61 }, { pan: 'random' }, { photos: [] }, { loop: 'false' }]) assert.throws(() => p.configure(patch));
  assert.deepEqual(p.settings, DEFAULTS); assert.equal(p.photos.length, 83);
});
test('reset restores defaults, all photos, and playback', () => {
  const p = new Player(PHOTOS); p.configure({ seconds: .5, loop: false, transition: 'slide', zoom: 'out', pan: 'up' }); p.setSkipped([0, 2]); p.playing = false; p.reset();
  assert.deepEqual(p.settings, DEFAULTS); assert.equal(p.current, 0); assert.equal(p.included.length, 83); assert.ok(p.playing);
});
test('zoom and pan combinations produce valid transforms', () => {
  for (const zoom of ['off','in','out']) for (const pan of ['off','left','right','up','down']) {
    const frames = motionFrames({zoom,pan}); assert.equal(frames.length, 2); assert.ok(frames.every(f => !f.transform.includes('NaN')));
    if (zoom === 'off' && pan === 'off') assert.deepEqual(frames[0], frames[1]); else assert.notDeepEqual(frames[0], frames[1]);
  }
});
test('no upload or arbitrary image URL controls', () => {
  const html = readFileSync(new URL('../docs/index.html', import.meta.url), 'utf8'); assert.doesNotMatch(html, /type=["'](?:file|url)["']/i);
});
