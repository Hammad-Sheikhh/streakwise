/** SHARE-1: the public address of a shared report. */
export function shareUrl(slug: string): string {
  return `${window.location.origin}/r/${slug}`;
}
