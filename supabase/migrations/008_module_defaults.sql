-- 008_module_defaults: clients also receive the coach's module defaults
-- (e.g. which evening-check fields are asked). No new table, RLS unchanged.

create or replace function public.get_public_settings()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select jsonb_build_object(
        'whatsapp', s.settings -> 'whatsapp',
        'faq', s.settings -> 'faq',
        'privacy_text', s.settings -> 'privacy_text',
        'cancel_hours', s.settings -> 'cancel_hours',
        'thresholds', s.settings -> 'thresholds',
        'help_text', s.settings -> 'help_text',
        'module_defaults', s.settings -> 'module_defaults')
     from public.coach_settings s
     where s.coach_id = coalesce(public.my_coach_id(), auth.uid())),
    '{}'::jsonb);
$$;
revoke execute on function public.get_public_settings() from public, anon;
grant execute on function public.get_public_settings() to authenticated;
