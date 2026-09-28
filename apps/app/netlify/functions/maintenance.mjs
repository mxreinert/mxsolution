// Scheduled daily 03:15 UTC:
// - delete discarded leads after 45 days, condense usage stats after 90 days,
//   inactivity + long-pause alerts for the coach (all in SQL: run_daily_maintenance)
// - daily Hevy sync for connected clients
import { scheduled, db, decrypt } from './_lib.mjs';
import { syncClient } from './hevy.mjs';

export default scheduled('maintenance', async () => {
  const result = await db.rpc('run_daily_maintenance');
  let hevy = 0;
  if (process.env.SECRETS_ENCRYPTION_KEY) {
    const secrets = await db.select('integration_secrets', 'hevy_key_enc=not.is.null&select=client_id,hevy_key_enc,hevy_synced_at');
    for (const s of secrets) {
      const c = (await db.select('clients', `id=eq.${s.client_id}&select=unlocks,status`))[0];
      if (!c || !(c.unlocks || []).includes('hevy') || c.status === 'ended') continue;
      try {
        const since = s.hevy_synced_at ? new Date(new Date(s.hevy_synced_at) - 3 * 864e5).toISOString().slice(0, 10) : null;
        hevy += await syncClient(s.client_id, decrypt(s.hevy_key_enc), since);
      } catch (e) { console.warn('hevy sync', s.client_id, e.message || e); }
    }
  }
  return { ...result, hevy_imported: hevy };
});

export const config = { schedule: '15 3 * * *' };
