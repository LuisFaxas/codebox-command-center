import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const VOICES = [
  'en-US-GuyNeural',
  'en-US-EricNeural',
  'en-US-ChristopherNeural',
  'en-US-RogerNeural',
  'en-US-SteffanNeural',
  'en-US-AndrewNeural',
  'en-US-BrianNeural',
];

export const DATA_DIR = process.env.DATA_DIR || join(import.meta.dirname, 'data');
export const SAMPLES_DIR = join(DATA_DIR, 'samples');
export const CACHE_DIR = join(DATA_DIR, 'cache');

const CONFIG_FILE = join(DATA_DIR, 'config.json');

const defaults = {
  done: { voice: 'en-US-GuyNeural', template: 'Done with {project}' },
  question: { voice: 'en-US-GuyNeural', template: 'I need your attention at {project}' },
};

let config = { ...defaults };

export function load() {
  [DATA_DIR, SAMPLES_DIR, CACHE_DIR].forEach(dir => {
    mkdirSync(dir, { recursive: true });
  });
  try {
    if (existsSync(CONFIG_FILE)) {
      config = JSON.parse(readFileSync(CONFIG_FILE, 'utf8'));
    }
  } catch(e) {}
  return config;
}

export function save() {
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

export function get() {
  return config;
}

export function update(type, voice, template) {
  config[type] = { voice, template };
  save();
}

export function getVoices() {
  return VOICES;
}
