async function mobileControlsAcceptance(page) {
  // Read existing cards from the real API; this check never changes persisted data.
  const base = new URL(page.url()).origin;
  const check = (condition, message) => { if (!condition) throw new Error(message); };
  const originalViewport = page.viewportSize();
  await page.goto(base);
  const originalLanguage = await page.evaluate(() => localStorage.getItem('kids-flashcards-language'));
  const response = await page.request.get(`${base}/api/sets`);
  check(response.ok(), 'Real API set read failed');
  const set = (await response.json()).find(item => item.card_count >= 2);
  check(set, 'A real set with at least two cards is required');
  try {
    for (const language of ['fr', 'en']) {
      await page.evaluate(value => localStorage.setItem('kids-flashcards-language', value), language);
      await page.goto(`${base}/set/${set.id}/practice`);
      const controls = page.locator('.practice-controls');
      await controls.waitFor();
      const previous = controls.locator('.btn-outline-secondary');
      const next = controls.locator('.btn-primary');
      const shuffle = controls.locator('.btn-link');
      for (const width of [320, 390, 400, 760, 1200]) {
        await page.setViewportSize({ width, height: 844 });
        const [p, n, s] = await Promise.all([previous.boundingBox(), next.boundingBox(), shuffle.boundingBox()]);
        check(Math.abs(p.y - n.y) < 1 && Math.abs(p.height - n.height) < 1 && p.x + p.width <= n.x,
          `Previous and Next must share a horizontal row at ${width}px (${language})`);
        if (width <= 760) {
          check(s.y >= Math.max(p.y + p.height, n.y + n.height),
            `Shuffle must be below navigation at ${width}px (${language})`);
        } else {
          check(Math.abs(s.y - p.y) < 2 && s.x > p.x && s.x < n.x,
            'Desktop must retain Previous / Shuffle / Next on one row');
        }
        check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          `Horizontal overflow at ${width}px (${language})`);
        if (width === 400) await page.screenshot({ path: `output/playwright/mobile-controls-${language}.png`, fullPage: true });
      }
      await page.setViewportSize({ width: 400, height: 844 });
      check(await previous.isDisabled(), 'Previous must be disabled on the first card');
      await next.click();
      await page.waitForFunction(() => !document.querySelector('.practice-controls .btn-outline-secondary').disabled);
      await previous.click();
      await page.waitForFunction(() => document.querySelector('.practice-controls .btn-outline-secondary').disabled);
      await next.click();
      await shuffle.click();
      await page.waitForFunction(() => document.querySelector('.practice-controls .btn-outline-secondary').disabled);
      check(await next.isEnabled(), 'Next must remain available after reshuffling');
    }
    return { result: 'PASS', checks: 'FR/EN 320/390/400/760px navigation row and shuffle below, desktop layout, no overflow, real previous/next/reshuffle controls' };
  } finally {
    await page.evaluate(value => {
      if (value === null) localStorage.removeItem('kids-flashcards-language');
      else localStorage.setItem('kids-flashcards-language', value);
    }, originalLanguage);
    if (originalViewport) await page.setViewportSize(originalViewport);
    await page.goto(`${base}/set/${set.id}/practice`);
  }
}
