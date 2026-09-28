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
