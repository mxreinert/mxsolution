import { sb, guard, getProfile, logout, resolveRoute } from '../auth.js';

const MIN_LENGTH = 10;

if (await guard('/password.html')) {
  document.getElementById('main').hidden = false;
  const profile = await getProfile();
  if (profile) document.getElementById('username').value = profile.username;
}

const form = document.getElementById('pw-form');
const errorEl = document.getElementById('error');
const submit = document.getElementById('submit');

document.getElementById('logout').addEventListener('click', logout);

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorEl.textContent = '';
  const pw1 = form.pw1.value;
  const pw2 = form.pw2.value;

  if (pw1.length < MIN_LENGTH) {
    errorEl.textContent = `Mindestens ${MIN_LENGTH} Zeichen.`;
    return;
  }
  if (pw1 !== pw2) {
    errorEl.textContent = 'Die Passwörter stimmen nicht überein.';
    return;
  }

  submit.disabled = true;
  // A database trigger clears must_change_password as soon as the password
  // really changes, so this flag cannot be skipped from the browser.
  const { error } = await sb.auth.updateUser({ password: pw1 });
  if (error) {
    errorEl.textContent = error.code === 'same_password'
      ? 'Bitte ein anderes Passwort als das Startpasswort wählen.'
      : 'Speichern hat nicht geklappt. Bitte nochmal versuchen.';
    submit.disabled = false;
    return;
  }
  await getProfile({ fresh: true });   // flag was just cleared by the database trigger
  location.replace(await resolveRoute());
});
