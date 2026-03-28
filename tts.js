import { exec } from 'child_process';
import { readFileSync, readdirSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { getVoices, SAMPLES_DIR, CACHE_DIR, get as getConfig } from './config.js';

export function safeName(str) {
  return str.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 80);
}

export function getCachePath(type, project) {
  return join(CACHE_DIR, `${type}--${safeName(project)}.wav`);
}

export function getSamples() {
  try {
    return readdirSync(SAMPLES_DIR).filter(f => f.endsWith('.wav') && f.includes('--')).sort();
  } catch(e) { return []; }
}

export function generateSamples(text, cb, rate, pitch) {
  try {
    readdirSync(SAMPLES_DIR).filter(f => f.endsWith('.wav')).forEach(f => {
      unlinkSync(join(SAMPLES_DIR, f));
    });
  } catch(e) {}

  const VOICES = getVoices();
  let done = 0;
  const total = VOICES.length;
  const safeText = text.replace(/'/g, "'\\''");
  const r = rate || '+0%';
  const p = pitch || '+0Hz';

  VOICES.forEach(voice => {
    const shortName = voice.replace('en-US-', '').replace('Neural', '').toLowerCase();
    const outFile = join(SAMPLES_DIR, `${shortName}--${voice}.wav`);
    exec(
      `edge-tts --voice "${voice}" --rate="${r}" --pitch="${p}" --text '${safeText}' --write-media "${outFile}"`,
      { timeout: 15000 },
      (err) => {
        done++;
        if (done === total && cb) cb();
      }
    );
  });
}

export function generateCached(type, project, cb) {
  const cachePath = getCachePath(type, project);
  if (existsSync(cachePath)) {
    return cb(null, cachePath);
  }

  const config = getConfig();
  const cfg = config[type] || config.done;
  const text = cfg.template.replace(/\{project\}/g, project);
  const safeText = text.replace(/'/g, "'\\''");
  const rate = cfg.rate || '+0%';
  const pitch = cfg.pitch || '+0Hz';

  exec(
    `edge-tts --voice "${cfg.voice}" --rate="${rate}" --pitch="${pitch}" --text '${safeText}' --write-media "${cachePath}"`,
    { timeout: 15000 },
    (err) => {
      if (err) return cb(err);
      cb(null, cachePath);
    }
  );
}

export function clearCache(type) {
  try {
    readdirSync(CACHE_DIR).filter(f => f.startsWith(type + '--') && f.endsWith('.wav')).forEach(f => {
      unlinkSync(join(CACHE_DIR, f));
    });
  } catch(e) {}
}
