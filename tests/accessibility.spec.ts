import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { expect, test } from '@playwright/test';

const require = createRequire(`${process.cwd()}/package.json`);
const axeSource = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');

const publicPages = [
  '/',
  '/es',
  '/products',
  '/es/products',
  '/es/sign-in',
  '/en/sign-in',
  '/es/contact',
  '/es/support',
  '/es/legal',
  '/es/arrepentimiento',
  '/es/account',
  '/cart',
] as const;

type AxeViolation = {
  id: string;
  impact: string | null;
  help: string;
  nodes: Array<{
    target: string[];
    failureSummary: string | null;
  }>;
};

for (const route of publicPages) {
  test(`accessibility: ${route}`, async ({ page }) => {
    const isSpanish = route === '/es' || route.startsWith('/es/');
    await page.goto(route);
    await expect(page.locator('html')).toHaveAttribute('lang', isSpanish ? 'es' : 'en');
    await expect(page.locator('#main-content')).toHaveCount(1);
    await expect(page.locator('#main-content')).not.toHaveAttribute('aria-busy', 'true', {
      timeout: 15_000,
    });
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByRole('link', {
        name: isSpanish ? 'Saltar al contenido principal' : 'Skip to main content',
      }),
    ).toHaveAttribute('href', '#main-content');
    await page.addScriptTag({ content: axeSource });

    const violations = await page.evaluate(async () => {
      type AxeWindow = Window & {
        axe: {
          run: (
            context: Document,
            options: { runOnly: { type: 'tag'; values: string[] } },
          ) => Promise<{ violations: AxeViolation[] }>;
        };
      };

      const result = await (window as unknown as AxeWindow).axe.run(document, {
        runOnly: {
          type: 'tag',
          values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'],
        },
      });

      return result.violations.map((violation) => ({
        id: violation.id,
        impact: violation.impact,
        help: violation.help,
        nodes: violation.nodes.map((node) => ({
          target: node.target,
          failureSummary: node.failureSummary,
        })),
      }));
    });

    expect(
      violations,
      `Axe accessibility violations on ${route}:\n${JSON.stringify(violations, null, 2)}`,
    ).toEqual([]);
  });
}
