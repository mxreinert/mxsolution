// Customer start page: welcome card with WhatsApp, "Jetzt anmelden" reveals the username login.
import { login, resolveRoute, sb } from '../auth.js';
import { WHATSAPP_NUMBER } from '../config.js';

const $ = (id) => document.getElementById(id);
const form = $('login-form');
const errorEl = $('error');
const submit = $('submit');

function setWhatsApp(number) {
  const digits = String(number || '').replace(/[^0-9]/g, '');
  if (!digits) return;
  $('whatsapp').href = `https://wa.me/${digits}?text=${encodeURIComponent('Hi Max, ich interessiere mich für ein Coaching.')}`;
  $('forgot').href = `https://wa.me/${digits}?text=${encodeURIComponent('Hi Max, ich habe mein Passwort vergessen.')}`;
}
setWhatsApp(WHATSAPP_NUMBER);
// the number Max set in Coach → Einstellungen (public, only this value)
sb.rpc('public_contact').then(({ data }) => { if (data?.whatsapp) setWhatsApp(data.whatsapp); }).catch(() => {});

const showLogin = () => {
  form.hidden = false;
  $('switch-line').hidden = true;
  $('identifier').focus();
  form.scrollIntoView({ behavior: 'smooth', block: 'center' });
};
$('show-login').addEventListener('click', showLogin);
if (location.hash === '#login') showLogin();

// Already logged in? Go straight to where the user belongs.
const start = await resolveRoute();
if (start !== '/') location.replace(start);

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorEl.textContent = '';
  const identifier = form.identifier.value.trim();
  const password = form.password.value;
  if (!identifier || !password) { errorEl.textContent = 'Bitte Benutzername und Passwort eingeben.'; return; }
  if (identifier.includes('@')) { errorEl.textContent = 'Hier bitte deinen Benutzernamen eingeben (ohne @).'; return; }
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
