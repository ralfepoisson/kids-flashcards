async page => {
  const root = new URL('/flashcards/', page.url()).href;
  const origin = new URL(root).origin;
  const errors = [];
  const onError = error => errors.push(error.message);
  page.on('pageerror', onError);
  const check = (condition, message) => { if (!condition) throw new Error(message); };
  try {
    await page.goto(root);
    await page.evaluate(() => localStorage.setItem('kids-flashcards-language', 'en'));
    await page.reload();
    await page.getByRole('button', { name: 'Log in', exact: true }).waitFor();
    check(await page.locator('base').getAttribute('href') === '/flashcards/', 'Compiled base prefix');
    const health = await page.request.get(root + 'api/health');
    check((await health.json()).database === 'ok', 'Real PostgreSQL health');
    const listing = await page.request.get(root + 'api/sets');
    const sets = await listing.json();
    check(listing.status() === 200 && sets.every(s => s.is_public && !s.can_edit), 'Public read-only listing');
    check(listing.headers()['cache-control'].includes('no-store'), 'Metadata not cached');
    check((await page.request.post(root + 'api/sets', {data:{name:'Unauthorized'},headers:{Origin:origin}})).status() === 401, 'Guest writes denied');
    check((await page.request.get(root + 'api/missing')).status() === 404, 'API misses remain errors');
    check((await page.request.get(root + 'uploads/missing.png')).status() === 404, 'Protected upload misses remain errors');
    const set = sets.find(s => s.card_count >= 2);
    if (set) {
      await page.getByRole('button').filter({hasText:set.name}).last().click();
      await page.locator('.practice-card').waitFor();
      check(new URL(page.url()).pathname === `/flashcards/set/${set.id}/practice`, 'Prefixed navigation');
      await page.reload();
      await page.locator('.practice-card').waitFor();
      const detail = await (await page.request.get(root + 'api/sets/' + set.id)).json();
      for (const card of detail.cards) for (const face of ['front','back']) if (card[face+'_type'] === 'image') {
        const reference=card[face+'_content'];
        check(reference.startsWith('/uploads/'), 'Canonical stored image reference');
        const picture=await page.request.get(root + reference.slice(1));
        check(picture.status() === 200 && picture.headers()['cache-control'].includes('no-store'), 'Prefixed protected public image');
      }
      await page.locator('.practice-card').click();
      await page.locator('.practice-card-inner.is-flipped').waitFor();
      await page.getByRole('button', {name:'Next card',exact:true}).click();
      await page.locator('.practice-card-inner:not(.is-flipped)').waitFor();
      await page.getByRole('button', {name:'Previous',exact:true}).click();
      await page.goto(root + `set/${set.id}/edit`);
      await page.locator('.practice-card').waitFor();
      check(new URL(page.url()).pathname.endsWith('/practice'), 'Guest edit falls back to practice');
      const rendered=await page.locator('.practice-card img').evaluateAll(imgs=>imgs.every(img=>img.getAttribute('src').startsWith('/flashcards/uploads/') && img.complete && img.naturalWidth>0));
      check(rendered, 'Rendered pictures load under prefix');
    }
    for (const width of [320,390,1200]) {
      await page.setViewportSize({width,height:900});
      check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth), 'No horizontal overflow at '+width);
    }
    await page.screenshot({path:'output/playwright/deployment-subpath.png',fullPage:true});
    await page.goto(root + 'auth/callback?handoff_code=invalid');
    await page.getByRole('button',{name:'Log in',exact:true}).waitFor();
    await page.locator('.toast-error').waitFor();
    check(new URL(page.url()).pathname === '/flashcards/' && !new URL(page.url()).search, 'Callback code scrubbed within mount');
    await page.goto(root + 'unknown-page');
    await page.getByRole('button',{name:'Log in',exact:true}).waitFor();
    await page.waitForURL(/\/flashcards\/?$/);
    check(/^\/flashcards\/?$/.test(new URL(page.url()).pathname), 'Unknown SPA path recovers to library');
    check(errors.length===0, 'No browser script errors: '+errors.join('; '));
    return {result:'PASS',publicSetCount:sets.length,practiceChecked:!!set,checks:'real DB/API, base path, deep-link reload, guest denial, API/upload errors, callback scrubbing, mobile overflow and existing public practice/images when present'};
  } finally {page.off('pageerror',onError);}
}
