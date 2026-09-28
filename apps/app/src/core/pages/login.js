import { login, resolveRoute } from '../auth.js';
import { WHATSAPP_NUMBER } from '../config.js';

const form = document.getElementById('login-form');
const errorEl = document.getElementById('error');
const submit = document.getElementById('submit');

if (WHATSAPP_NUMBER) {
  document.getElementById('whatsapp').href =
    `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent('Hi Max, ich habe mein Passwort vergessen.')}`;
  document.getElementById('forgot').hidden = false;
}

// Already logged in? Go straight to where the user belongs.
const start = await resolveRoute();
if (start !== '/') location.replace(start);

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorEl.textContent = '';
  const identifier = form.identifier.value;
  const password = form.password.value;
  if (!identifier.trim() || !password) {
    errorEl.textContent = 'Bitte Benutzername und Passwort eingeben.';
    return;
  }
  submit.disabled = true;
  submit.textContent = 'Anmelden …';
  const { error } = await login(identifier, password);
  if (error) {
    errorEl.textContent = error;
    submit.disabled = false;
    submit.textContent = 'Anmelden';
    return;
  }
  location.replace(await resolveRoute());
});
