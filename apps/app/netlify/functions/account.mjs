// Client accounts – only the coach (with 2FA) may call this.
// actions: create | reset_password | deactivate | reactivate | delete
import { json, bad, handler, requireCoach, ownClient, readJson, db, authAdmin, storage, env } from './_lib.mjs';

const USERNAME_RE = /^[a-z0-9._-]{3,32}$/;

function age(birthdate) {
  const b = new Date(birthdate + 'T00:00:00Z');
  const n = new Date();
  let a = n.getUTCFullYear() - b.getUTCFullYear();
  if (n.getUTCMonth() < b.getUTCMonth() || (n.getUTCMonth() === b.getUTCMonth() && n.getUTCDate() < b.getUTCDate())) a--;
  return a;
}

function checkPassword(pw) {
  if (typeof pw !== 'string' || pw.length < 10 || pw.length > 72) throw bad('Startpasswort muss 10–72 Zeichen haben');
}

async function removeClientFiles(clientId) {
  const paths = [];
  for (const prefix of [clientId, `${clientId}/photos`]) {
    try {
      const items = await storage.list('client-files', prefix);
      for (const it of items || []) if (it.id) paths.push(`${prefix}/${it.name}`);
    } catch (e) { /* folder may not exist */ }
  }
  await storage.remove('client-files', paths);
  return paths.length;
}

export default handler(async (req) => {
  const { profile: coach } = await requireCoach(req);
  const body = await readJson(req);
  const client = await ownClient(coach.id, body.clientId);

  switch (body.action) {
    case 'create': {
      if (client.user_id) return bad('Kunde hat bereits einen Login');
      const username = String(body.username || '').toLowerCase();
      if (!USERNAME_RE.test(username)) return bad('Benutzername ungültig (3–32 Zeichen: a–z, 0–9, . _ -)');
      checkPassword(body.password);
      // hard rules: consent documented, parents' consent for minors, no account without it
      if (!client.birthdate) return bad('Geburtsdatum fehlt');
      if (!client.consent_at) return bad('Einwilligung fehlt – ohne Einwilligung wird kein Konto erstellt');
      if (age(client.birthdate) < 18 && !client.parent_consent_at) return bad('Minderjährig: Einwilligung der Eltern fehlt');
      const taken = await db.select('profiles', `username=eq.${encodeURIComponent(username)}&select=id`);
      if (taken.length) return bad('Benutzername ist schon vergeben');

      const email = `${username}@${env('USERNAME_DOMAIN', 'kunden.mxreinert.de')}`;
      const user = await authAdmin.create({ email, password: body.password, email_confirm: true, app_metadata: { role: 'client' } });
      try {
        await db.insert('profiles', { id: user.id, role: 'client', username, coach_id: coach.id, must_change_password: true });
        await db.update('clients', `id=eq.${client.id}`, {
          user_id: user.id,
          status: ['lead', 'concept', 'discarded'].includes(client.status) ? 'active' : client.status,
          goal_start: client.goal_start || new Date().toISOString().slice(0, 10)
        });
        await db.insert('client_settings', { client_id: client.id }, { upsert: true, onConflict: 'client_id' });
      } catch (e) {
        await authAdmin.remove(user.id).catch(() => {});   // roll back the login
        throw e;
      }
      return json({ ok: true, username });
    }

    case 'reset_password': {
      if (!client.user_id) return bad('Kein Login vorhanden');
      checkPassword(body.password);
      // order matters: the DB trigger clears the flag on password change, then we set it again
      await authAdmin.update(client.user_id, { password: body.password });
      await db.update('profiles', `id=eq.${client.user_id}`, { must_change_password: true });
      return json({ ok: true });
    }

    case 'deactivate': {
      if (client.user_id) await authAdmin.update(client.user_id, { ban_duration: '876000h' });
      await db.update('clients', `id=eq.${client.id}`, { status: 'ended', ended_at: new Date().toISOString().slice(0, 10) });
      if (client.user_id) await db.remove('push_subscriptions', `user_id=eq.${client.user_id}`);
      return json({ ok: true });
    }

    case 'reactivate': {
      if (client.user_id) await authAdmin.update(client.user_id, { ban_duration: 'none' });
      await db.update('clients', `id=eq.${client.id}`, { status: 'active', ended_at: null });
      return json({ ok: true });
    }

    case 'delete': {
      const files = await removeClientFiles(client.id);
      await db.remove('clients', `id=eq.${client.id}`);          // cascades to all client data
      if (client.user_id) await authAdmin.remove(client.user_id); // cascades to profile, push, notifications
      return json({ ok: true, files });
    }

    default:
      return bad('Unbekannte Aktion');
  }
});

export const config = { path: '/api/account' };
