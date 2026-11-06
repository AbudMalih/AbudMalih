/**
 * Supabase API keys come in two formats:
 * - legacy JWT keys (anon / service_role): sent as `apikey` AND as `Authorization: Bearer`
 * - new keys (`sb_publishable_…`, `sb_secret_…`): not JWTs. They go only into the `apikey`
 *   header; the Supabase gateway derives the role from it. `Authorization` then carries
 *   only a real user JWT, or nothing.
 */
export function isLegacyJwtKey(key: string): boolean {
  return !key.startsWith("sb_") && key.split(".").length === 3;
}

export function supabaseHeaders(key: string, userToken?: string): Record<string, string> {
  const bearer = userToken ?? (isLegacyJwtKey(key) ? key : undefined);
  return bearer ? { apikey: key, Authorization: `Bearer ${bearer}` } : { apikey: key };
}
