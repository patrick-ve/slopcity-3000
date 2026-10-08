import { expect, test, type Page } from '@playwright/test';

/** The running game (exposed for debugging as window.slop). */
type Slop = {
  mode: string;
  sim: {
    stats: { residents: number };
    city: { name: string; funds: number };
    world: { net: Uint8Array };
  };
  setSpeed(speed: number): void;
};

const slop = (page: Page) => page.evaluateHandle(() => (window as unknown as { slop: Slop }).slop);
const roadTiles = (page: Page) =>
  page.evaluate(() => (window as unknown as { slop: Slop }).slop.sim.world.net.reduce((n, v) => n + (v & 1), 0));

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  (page as Page & { errors: string[] }).errors = errors;
  await page.goto('/');
  await page.waitForFunction(() => !!(window as unknown as { slop?: Slop }).slop?.sim);
});

test.afterEach(async ({ page }) => {
  expect((page as Page & { errors: string[] }).errors).toEqual([]);
});

test('the title screen shows the menu over a live city', async ({ page }) => {
  await expect(page.locator('.menu h1.title')).toContainText('SlopCity');
  await expect(page.locator('#view canvas')).toBeVisible();
  const game = await slop(page);
  expect(await game.evaluate((g) => g.mode)).toBe('menu');
  expect(await game.evaluate((g) => g.sim.stats.residents)).toBeGreaterThan(1000);
});

test('found a city, build a road and undo it', async ({ page }) => {
  await page.getByRole('button', { name: /New city/ }).click();
  // flat land without water, so the road below never ends in a river (the map seed is random)
  await page.getByRole('button', { name: 'Flat' }).click();
  await page.getByRole('button', { name: 'None', exact: true }).click();
  await page.getByRole('button', { name: /Start building/ }).click();
  await expect(page.locator('.topbar')).toBeVisible();
  await page.evaluate(() => (window as unknown as { slop: Slop }).slop.setSpeed(0));
  expect(await roadTiles(page)).toBe(0);
  await page.keyboard.press('KeyR');
  await page.mouse.move(560, 420);
  await page.mouse.down();
  await page.mouse.move(760, 430, { steps: 8 });
  await page.mouse.up();
  await expect.poll(() => roadTiles(page)).toBeGreaterThan(3);
  await page.keyboard.press('Control+KeyZ');
  await expect.poll(() => roadTiles(page)).toBe(0);
  await expect(page.locator('.toast').filter({ hasText: 'Undone: Road' })).toBeVisible();
});

test('draw a curved road with three clicks', async ({ page }) => {
  await page.getByRole('button', { name: /New city/ }).click();
  await page.getByRole('button', { name: 'Flat' }).click();
  await page.getByRole('button', { name: 'None', exact: true }).click();
  await page.getByRole('button', { name: /Start building/ }).click();
  await expect(page.locator('.topbar')).toBeVisible();
  await page.evaluate(() => (window as unknown as { slop: Slop }).slop.setSpeed(0));
  await page.keyboard.press('KeyR');
  await page.getByRole('button', { name: 'Curve' }).click();
  // the start, the point where it bends, the end
  for (const [x, y] of [
    [520, 470],
    [640, 330],
    [790, 450],
  ])
    await page.mouse.click(x, y);
  const curves = () =>
    page.evaluate(() => {
      const edges = (window as unknown as { slop: { sim: { world: { tracks: { road: { edges: Map<number, { curved: boolean }> } } } } } })
        .slop.sim.world.tracks.road.edges;
      return [...edges.values()].filter((e) => e.curved).length;
    });
  await expect.poll(curves).toBe(1);
  expect(await roadTiles(page)).toBeGreaterThan(8);
  await page.keyboard.press('Control+KeyZ');
  await expect.poll(curves).toBe(0);
  await expect.poll(() => roadTiles(page)).toBe(0);
});

test('take over a starter city', async ({ page }) => {
  await page.getByRole('button', { name: /Starter cities/ }).click();
  const riverside = page.locator('.slot').filter({ hasText: 'Riverside' });
  await riverside.getByRole('button', { name: 'Play' }).click();
  await page.waitForFunction(() => (window as unknown as { slop: Slop }).slop.mode === 'play');
  await expect(page.locator('.topbar .city')).toHaveText('Riverside');
  const game = await slop(page);
  expect(await game.evaluate((g) => g.sim.stats.residents)).toBeGreaterThan(5000);
});

test('start a scenario and see its goals', async ({ page }) => {
  await page.getByRole('button', { name: /Scenarios/ }).click();
  await page.locator('.slot').filter({ hasText: 'Boomtown' }).getByRole('button', { name: 'Play' }).click();
  await page.waitForFunction(() => (window as unknown as { slop: Slop }).slop.mode === 'play');
  await expect(page.locator('.win').filter({ hasText: 'Reach 10,000 residents' })).toBeVisible();
});
