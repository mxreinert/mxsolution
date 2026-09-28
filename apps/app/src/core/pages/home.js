import { guard, getProfile, logout } from '../auth.js';

const $ = (id) => document.getElementById(id);
$('logout').addEventListener('click', logout);

// Theme picker (per device for now)
const themeSelect = $('theme');
try { themeSelect.value = localStorage.getItem('mx_theme') || ''; } catch (e) { /* ignore */ }
themeSelect.addEventListener('change', () => {
  const t = themeSelect.value;
  try { t ? localStorage.setItem('mx_theme', t) : localStorage.removeItem('mx_theme'); } catch (e) { /* ignore */ }
  if (t) document.documentElement.setAttribute('data-theme', t);
  else document.documentElement.removeAttribute('data-theme');
});

if (await guard('/home.html')) {
  const profile = await getProfile();
  $('greeting').textContent = `Hallo ${profile.username}`;
  $(profile.role === 'coach' ? 'coach-view' : 'client-view').hidden = false;
  $('main').hidden = false;
}
