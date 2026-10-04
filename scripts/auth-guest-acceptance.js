async function acceptance(page, fixtureOptions = {}) {
  // Real served application/API. A signed-in owner creates the disposable
  // public fixture first; this check never substitutes authentication/data.
  const privateSetId = fixtureOptions.privateSetId;
  const privateImageUrl = fixtureOptions.privateImageUrl;
  const scriptErrors = [];
  page.on('pageerror', error => scriptErrors.push(error.message));
  const origin = 'http://127.0.0.1:4200';
  const check = (value, message) => { if (!value) throw new Error(message); };
  check(privateSetId, 'Pass fixtureOptions.privateSetId for a real disposable private series');
  await page.context().clearCookies();
  await page.goto(origin);
  await page.evaluate(() => localStorage.setItem('kids-flashcards-language', 'en'));
  await page.reload();
  await page.getByRole('button', { name: 'Log in', exact: true }).waitFor();
  const listing = await page.request.get(origin + '/api/sets');
  check(listing.status() === 200, 'Anonymous library must load');
  const sets = await listing.json();
  check(sets.every(set => set.is_public && !set.can_edit), 'Guest receives only read-only public series');
  const fixture = sets.find(set => set.name.startsWith('Auth browser acceptance '));
  check(fixture, 'Create the public Auth browser acceptance fixture while signed in first');
  await page.getByRole('button', { name: new RegExp(fixture.name) }).last().click();
  await page.locator('.practice-card').waitFor();
  check(await page.getByRole('button', { name: 'Edit Mode', exact: true }).count() === 0, 'Guest has no Edit Mode');
  check(await page.getByRole('button', { name: /Create a set|Add flashcard|Edit set|Delete set/ }).count() === 0, 'Guest has no mutation controls');
  await page.locator('.practice-card').click();
  await page.locator('.practice-card-inner.is-flipped').waitFor();
  check(await page.locator('.practice-card-inner.is-flipped').count() === 1, 'Guest can flip practice card');
  await page.goto(origin + '/set/' + fixture.id + '/edit');
  await page.locator('.practice-card').waitFor();
  check(new URL(page.url()).pathname.endsWith('/practice'), 'Guest edit deep link resolves to practice');
  const detail = await (await page.request.get(origin + '/api/sets/' + fixture.id)).json();
  for (const card of detail.cards) {
    for (const face of ['front', 'back']) {
      if (card[face + '_type'] === 'image') {
        const image = await page.request.get(origin + card[face + '_content']);
        check(image.status() === 200, 'Public practice image loads anonymously');
        check(image.headers()['cache-control'].includes('no-store'), 'Images are not cached across visibility changes');
      }
    }
  }
  const headers = { Origin: origin };
  const writes = [
    await page.request.post(origin + '/api/sets', { data: { name: 'Forbidden anonymous write' }, headers }),
    await page.request.put(origin + '/api/sets/' + fixture.id, { data: { name: 'Forbidden edit' }, headers }),
    await page.request.delete(origin + '/api/sets/' + fixture.id, { headers }),
    await page.request.post(origin + '/api/sets/' + fixture.id + '/cards', { data: {}, headers }),
    await page.request.put(origin + '/api/sets/' + fixture.id + '/cards/reorder', { data: { card_ids: [] }, headers }),
    await page.request.post(origin + '/api/uploads', { multipart: { file: { name: 'no.png', mimeType: 'image/png', buffer: Buffer.from('not an image') } }, headers }),
  ];
  check(writes.every(response => response.status() === 401), 'Every guest mutation must be unauthorized');
  check((await page.request.get(origin + '/api/sets/' + privateSetId)).status() === 404, 'Private fixture cannot be fetched by ID');
  if (privateImageUrl) {
    check((await page.request.get(origin + privateImageUrl)).status() === 404, 'Private image cannot be fetched by URL');
  }
  check((await page.request.get(origin + '/api/sets')).headers()['cache-control'].includes('no-store'), 'Private metadata is never cached');
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 850 });
    await page.getByRole('button', { name: 'Log in', exact: true }).waitFor();
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No mobile horizontal overflow');
  }
  await page.screenshot({ path: 'output/playwright/auth-guest-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: 'output/playwright/auth-guest-practice.png', fullPage: true });
  check(scriptErrors.length === 0, 'No browser script errors: ' + scriptErrors.join('; '));
  return { result: 'PASS', checks: 'public listing/practice/images, private series/image denial, mutation denial, edit deep links, 390px/320px layouts, no browser script errors' };
}
