// Coach login: e-mail + password, then 2FA (mfa.html) via resolveRoute.
import { login, logout, resolveRoute, getProfile } from '../auth.js';

const form = document.getElementById('login-form');
const errorEl = document.getElementById('error');
const submit = document.getElementById('submit');

const start = await resolveRoute();
if (start !== '/') location.replace(start);

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorEl.textContent = '';
  const email = form.identifier.value.trim();
  if (!email.includes('@') || !form.password.value) { errorEl.textContent = 'Bitte E-Mail und Passwort eingeben.'; return; }
  submit.disabled = true;
  submit.textContent = 'Anmelden …';
  const { error } = await login(email, form.password.value);
  if (error) {
    errorEl.textContent = 'E-Mail oder Passwort falsch.';
    submit.disabled = false;
    submit.textContent = 'Anmelden';
    return;
  }
  const profile = await getProfile({ fresh: true });
  if (profile?.role !== 'coach') {
    await logout();
    return;
  }
  location.replace(await resolveRoute());
});
