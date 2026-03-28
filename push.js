import webPush from 'web-push';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { DATA_DIR } from './config.js';

const VAPID_PATH = join(DATA_DIR, 'vapid.json');
const SUBS_PATH = join(DATA_DIR, 'subscriptions.json');

let vapidKeys = null;
let subscriptions = [];

export function loadPush() {
  if (existsSync(VAPID_PATH)) {
    vapidKeys = JSON.parse(readFileSync(VAPID_PATH, 'utf8'));
  } else {
    vapidKeys = webPush.generateVAPIDKeys();
    writeFileSync(VAPID_PATH, JSON.stringify(vapidKeys, null, 2));
  }

  webPush.setVapidDetails(
    'mailto:admin@codebox.local',
    vapidKeys.publicKey,
    vapidKeys.privateKey
  );

  if (existsSync(SUBS_PATH)) {
    try { subscriptions = JSON.parse(readFileSync(SUBS_PATH, 'utf8')); } catch(e) { subscriptions = []; }
  }
}

export function getPublicKey() {
  return vapidKeys.publicKey;
}

export function addSubscription(sub) {
  subscriptions = subscriptions.filter(s => s.endpoint !== sub.endpoint);
  subscriptions.push(sub);
  writeFileSync(SUBS_PATH, JSON.stringify(subscriptions, null, 2));
}

export async function pushToAll(type, project) {
  const payload = JSON.stringify({ type, project, timestamp: Date.now() });
  const results = await Promise.allSettled(
    subscriptions.map(sub => webPush.sendNotification(sub, payload))
  );

  const valid = [];
  results.forEach((result, i) => {
    if (result.status === 'fulfilled' || (result.reason && result.reason.statusCode !== 410)) {
      valid.push(subscriptions[i]);
    }
  });
  if (valid.length !== subscriptions.length) {
    subscriptions = valid;
    writeFileSync(SUBS_PATH, JSON.stringify(subscriptions, null, 2));
  }
}
