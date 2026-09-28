// Web push: permission + subscription stored in push_subscriptions.
import { q, from } from './db.js';
import { VAPID_PUBLIC_KEY } from './config.js';

export function pushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export function isIos() { return /iPhone|iPad|iPod/.test(navigator.userAgent); }
export function isStandalone() { return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; }

/** 'on' | 'off' | 'denied' | 'unsupported' | 'needs-homescreen' */
export async function pushState() {
  if (isIos() && !isStandalone()) return 'needs-homescreen';
  if (!pushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  return sub && Notification.permission === 'granted' ? 'on' : 'off';
}

function b64ToBytes(s) {
  const pad = '='.repeat((4 - (s.length % 4)) % 4);
  const raw = atob((s + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export async function enablePush() {
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('Benachrichtigungen wurden nicht erlaubt.');
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(VAPID_PUBLIC_KEY) });
  const json = sub.toJSON();
  await q(from('push_subscriptions').upsert({ endpoint: json.endpoint, p256dh: json.keys.p256dh, auth_key: json.keys.auth }, { onConflict: 'endpoint' }));
}

export async function disablePush() {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await q(from('push_subscriptions').delete().eq('endpoint', sub.endpoint));
    await sub.unsubscribe();
  }
}

export function registerServiceWorker() {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch((e) => console.warn('SW', e));
}
