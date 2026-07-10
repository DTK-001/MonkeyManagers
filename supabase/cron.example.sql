-- Run manually after enabling the pg_cron, pg_net and Vault integrations in Supabase.
-- Store the project URL and a strong random cron secret in Vault; do not paste them here.
-- The same cron secret must be configured for the Edge Function as SYNC_CRON_SECRET.
-- Supabase Cron uses UTC. Review this expression around UK daylight-saving changes if
-- an exact 03:30 Europe/London trigger is required; each league's date range is still
-- calculated in its configured IANA timezone by the Edge Function.

select cron.schedule(
  'monkey-managers-nightly-sync',
  '30 3 * * *',
  $$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
        || '/functions/v1/nightly-sync',
      headers := jsonb_build_object(
        'content-type', 'application/json',
        'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'sync_cron_secret')
      ),
      body := '{}'::jsonb
    );
  $$
);
