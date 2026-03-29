import { test, expect } from 'playwright/test';

const BASE = 'http://localhost:3099';

test.describe('Notification Regression (NOTIF-01, NOTIF-02, NOTIF-03)', () => {

  test('trigger endpoint accepts POST and returns ok (baseline)', async ({ request }) => {
    const res = await request.post(`${BASE}/trigger`, {
      data: { type: 'done', project: 'RegTest', sessionId: 'reg-001', machine: 'test', cwd: '/tmp' }
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  test('NOTIF-03: trigger shows toast in dashboard', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    // Wait for SSE connection (may take a moment for EventSource to establish)
    await page.waitForSelector('.connection-dot.connected', { timeout: 10000 });

    // Fire trigger via API
    await page.request.post(`${BASE}/trigger`, {
      data: { type: 'done', project: 'ToastTest', sessionId: 'reg-002', machine: 'test', cwd: '/tmp' }
    });

    // Toast should appear in #toast-container
    await expect(page.locator('#toast-container .toast')).toBeVisible({ timeout: 5000 });
  });

  test('NOTIF-01: audio endpoint returns WAV after trigger', async ({ request }) => {
    // Trigger to generate cached WAV
    await request.post(`${BASE}/trigger`, {
      data: { type: 'done', project: 'AudioReg', sessionId: 'reg-003', machine: 'test', cwd: '/tmp' }
    });

    // Wait for TTS generation (edge-tts takes 2-4 seconds)
    await new Promise(r => setTimeout(r, 4000));

    const res = await request.get(`${BASE}/notify-wav?type=done&project=AudioReg`);
    expect(res.status()).toBe(200);
    const contentType = res.headers()['content-type'];
    expect(contentType).toMatch(/audio/);
  });

  test('NOTIF-02: VAPID public key endpoint responds (push prerequisite)', async ({ request }) => {
    const res = await request.get(`${BASE}/vapid-public-key`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.publicKey).toBeTruthy();
    expect(typeof body.publicKey).toBe('string');
  });

  test('config endpoint returns voice configuration', async ({ request }) => {
    const res = await request.get(`${BASE}/config`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.done).toBeTruthy();
    expect(body.done.voice).toBeTruthy();
    expect(body.question).toBeTruthy();
  });
});
