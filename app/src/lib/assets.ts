/** Build-time public-file inventory prevents 404s for optional science assets. */
export function publicAssetUrl(
  path: string | undefined,
  files: readonly string[] = import.meta.env.ARES_PUBLIC_FILES ?? [],
): string | undefined {
  if (!path) return undefined;
  const relative = path.replace(/^\//, "");
  return files.includes(relative)
    ? `${import.meta.env.BASE_URL}${relative}`
    : undefined;
}
