// Core auth: Supabase client, login, and the page guard every page runs first.
import {
  SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, USERNAME_DOMAIN, SESSION_MAX_DAYS
} from './config.js';

// window.supabase comes from /vendor/supabase-2.117.2.js (loaded before this module)
export const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true }
});

const LOGIN_AT_KEY = 'mx_login_at';
const USERNAME_RE = /^[a-z0-9._-]{3,32}$/;

/** "lisa" -> "lisa@kunden.mxreinert.de"; real emails (coach) stay as they are. */
export function toLoginEmail(input) {
  const v = input.trim().toLowerCase();
  if (v.includes('@')) return v;
  if (!USERNAME_RE.test(v)) return null;
  return `${v}@${USERNAME_DOMAIN}`;
}

export async function login(identifier, password) {
  const email = toLoginEmail(identifier);
  if (!email) return { error: 'Benutzername ungültig.' };
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) {
    // Same message for wrong user and wrong password (no username probing)
    return { error: 'Benutzername oder Passwort falsch.' };
  }
  localStorage.setItem(LOGIN_AT_KEY, String(Date.now()));
  return { error: null };
}

export async function logout() {
  localStorage.removeItem(LOGIN_AT_KEY);
  await sb.auth.signOut();
  location.replace('/');
}

function sessionExpired() {
  const at = Number(localStorage.getItem(LOGIN_AT_KEY) || 0);
  return !at || Date.now() - at > SESSION_MAX_DAYS * 864e5;
}

export async function getProfile() {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data, error } = await sb
    .from('profiles')
    .select('id, role, username, must_change_password, mfa_exempt')
    .eq('id', user.id)
    .single();
  if (error) return null;
  return data;
}

/**
 * Where must this user be right now? Returns a path, or null if the user may stay.
 * Order: logged in -> password changed -> coach has 2FA -> home.
 */
export async function resolveRoute() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return '/';
  if (sessionExpired()) { await logout(); return '/'; }

  const profile = await getProfile();
  if (!profile) { await logout(); return '/'; }

  if (profile.must_change_password) return '/password.html';

  // mfa_exempt: test accounts only (see LAUNCH.md)
  if (profile.role === 'coach' && !profile.mfa_exempt) {
    const { data: aal } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.currentLevel !== 'aal2') return '/mfa.html';
  }
  return '/home.html';
}

/** Run at the top of every page. Redirects unless this page is the right one. */
export async function guard(thisPage) {
  const target = await resolveRoute();
  if (target !== thisPage) { location.replace(target); return false; }
  return true;
}
