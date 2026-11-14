/** Optional files may be absent, malformed, or served as Vite's HTML fallback. */
export async function optionalJson(response: Response | null): Promise<unknown> {
  if (!response?.ok || !response.headers.get("content-type")?.includes("application/json")) return null;
  try {
    return await response.json();
  } catch {
    return null;
  }
}
