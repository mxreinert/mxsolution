// Public configuration. Only public values belong here (never the service-role key).
export const SUPABASE_URL = 'https://btatxcipmsvcriddxlhv.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_Ta4nDpX2JhcvjHGxdjyPfw_dJKmcYwm';

// Clients log in with a username; Supabase needs an email, so we map it to this
// internal domain. No mail is ever sent to these addresses.
export const USERNAME_DOMAIN = 'kunden.mxreinert.de';

// Sessions end after this many days, then the user must log in again.
export const SESSION_MAX_DAYS = 7;

// WhatsApp number for "Passwort vergessen?" etc., digits only incl. country code
// (e.g. '352621123456'). Empty = link is hidden.
export const WHATSAPP_NUMBER = '';

// Public VAPID key for web push (same key pair as the old Bulk Cockpit).
// The private key lives only in the Netlify env var VAPID_PRIVATE_KEY.
export const VAPID_PUBLIC_KEY = 'BJpXlCmyKTT8v0wP01soKWi9EcOc1uMnJalBsbffhjClHa57layYBeXGwKryhj6etlEH_V0u5oCCHNUCxwgXS88';

// Bump when shipping a new version so the service worker refreshes its cache.
export const APP_VERSION = '0.1.0';
