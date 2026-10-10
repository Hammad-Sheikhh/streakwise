import type { Page } from '@playwright/test';

/** Records every request to /api or /mcp; the demo must make none (DEMO-2). */
export function watchServerCalls(page: Page): string[] {
  const calls: string[] = [];
  page.on('request', (request) => {
    const { pathname } = new URL(request.url());
    if (pathname.startsWith('/api') || pathname.startsWith('/mcp')) calls.push(pathname);
  });
  return calls;
}

/**
 * Opens a screen through the navigation, never with page.goto: reloading would reset the demo.
 * Phones have a shorter bottom bar, with the rest under "More".
 */
export async function openScreen(page: Page, name: string): Promise<void> {
  const nav = page.getByRole('navigation', { name: 'Main' }).filter({ visible: true });
  const link = nav.getByRole('link', { name, exact: true });
  if ((await link.count()) > 0) {
    await link.click();
    return;
  }
  await nav.getByRole('link', { name: 'More', exact: true }).click();
  await page.getByRole('main').getByRole('link', { name, exact: true }).click();
}
