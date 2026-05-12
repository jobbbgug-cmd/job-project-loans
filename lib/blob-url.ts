export function blobProxy(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith('/')) return path; // local dev filesystem path
  return `/api/loan/blob?url=${encodeURIComponent(path)}`;
}
