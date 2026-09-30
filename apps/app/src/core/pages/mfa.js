import { sb, guard, logout, resolveRoute } from '../auth.js';

const $ = (id) => document.getElementById(id);
$('logout').addEventListener('click', () => logout());

let factorId = null;

async function setup() {
  const { data, error } = await sb.auth.mfa.listFactors();
  if (error) { $('error').textContent = 'Fehler beim Laden. Bitte neu anmelden.'; return; }

  const verified = data.totp.find((f) => f.status === 'verified');
  if (verified) {
    factorId = verified.id;
    $('verify-hint').hidden = false;
  } else {
    // Remove half-finished enrollments from earlier attempts, then start fresh
    for (const f of data.all.filter((f) => f.status === 'unverified')) {
      await sb.auth.mfa.unenroll({ factorId: f.id });
    }
    const { data: enroll, error: enrollError } = await sb.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'Coach ' + new Date().toISOString().slice(0, 10)
    });
    if (enrollError) { $('error').textContent = 'Einrichtung fehlgeschlagen.'; return; }
    factorId = enroll.id;
    $('qr').src = enroll.totp.qr_code; // SVG data URL
    $('secret').textContent = enroll.totp.secret;
    $('enroll').hidden = false;
  }
  $('code-form').hidden = false;
  $('code').focus();
}

if (await guard('/mfa.html')) {
  $('main').hidden = false;
  await setup();
}

$('code-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('error').textContent = '';
  const code = $('code').value.trim();
  if (!/^\d{6}$/.test(code)) { $('error').textContent = 'Bitte den 6-stelligen Code eingeben.'; return; }

  $('submit').disabled = true;
  const { error } = await sb.auth.mfa.challengeAndVerify({ factorId, code });
  if (error) {
    $('error').textContent = 'Code falsch oder abgelaufen. Bitte den aktuellen Code eingeben.';
    $('submit').disabled = false;
    return;
  }
  location.replace(await resolveRoute());
});
