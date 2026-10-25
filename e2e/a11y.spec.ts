import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { openScreen } from './helpers';

// SPEC §B11: WCAG AA. One test per screen so a failure names the screen; the demo has sample data
// everywhere, so every screen renders its real content. Run in both themes, since the theme follows
// the system setting.
const screens = ['Home', 'Log', 'History', 'Tasks', 'Scores', 'Tracks', 'Reports', 'Settings'];

for (const colorScheme of ['light', 'dark'] as const) {
  for (const screen of screens) {
    test(`${screen} (${colorScheme}) has no WCAG A/AA violations`, async ({ page }) => {
      await page.emulateMedia({ colorScheme });
      await page.goto('/demo');
      await expect(page.getByText('Demo — sample data. Changes aren’t saved.')).toBeVisible();
      if (screen !== 'Home') {
        // Log is a link in the phone nav but a "Log a session" button in the desktop sidebar.
        const navLink = page
          .getByRole('navigation', { name: 'Main' })
          .filter({ visible: true })
          .getByRole('link', { name: screen, exact: true });
        if (screen === 'Log' && (await navLink.count()) === 0) {
          await page.getByRole('link', { name: 'Log a session' }).click();
        } else {
          await openScreen(page, screen);
        }
      }

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      const summary = results.violations.map(
        (violation) => `${violation.id} (${violation.nodes.length}): ${violation.help}`,
      );
      expect(summary).toEqual([]);
    });
  }
}
