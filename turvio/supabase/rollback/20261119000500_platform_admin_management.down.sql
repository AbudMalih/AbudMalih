-- Rollback of 20261119000500: drop the two management functions (platform_admins rows stay as they are).
drop function if exists public.platform_add_admin(text);
drop function if exists public.platform_remove_admin(uuid);
