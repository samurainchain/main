const { chromium } = require('playwright');
const DEMO = __dirname + '/../../checkin-story.json';
const prices = (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ currency: 'usd', monthly: '15.99', annual: '44.99', sandbox: false }) });
const rows = async (page, sel, box) => (await page.locator(sel).evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, text: e.innerText.replace(/\n/g, ' ').slice(0, 60) } }))).map((r) => ({ ...r, x: +(r.x - box.x).toFixed(1), y: +(r.y - box.y).toFixed(1), w: +r.w.toFixed(1), h: +r.h.toFixed(1) }));
(async () => {
  const b = await chromium.launch();
  const mk = async (site) => {
    const page = await (await b.newContext({ viewport: { width: 390, height: 1600 }, deviceScaleFactor: 3, locale: 'es-MX', colorScheme: 'dark', timezoneId: 'UTC' })).newPage();
    await page.route('**/functions/v1/**', prices);
    await page.goto(site); await page.locator('.onboarding input[type=file]').setInputFiles(DEMO); await page.locator('.tabbar .nav-add').waitFor();
    return page;
  };
  const page = await mk('http://localhost:4175/');
  await page.goto('http://localhost:4175/#/analytics'); await page.locator('main h1').waitFor(); await page.waitForTimeout(900);
  await page.addStyleTag({ content: '.tabbar,.app-bar{display:none!important}' });
  for (const id of ['performance', 'mistakeCost', 'byEmotion', 'byHold']) {
    const w = page.locator(`[data-widget=${id}]`); await w.scrollIntoViewIfNeeded(); await page.waitForTimeout(250);
    await w.screenshot({ path: `${id}.png` }); const box = await w.boundingBox();
    console.log(id, JSON.stringify({ w: box.width, h: box.height }), JSON.stringify(await rows(page, `[data-widget=${id}] .bar-list__row, [data-widget=${id}] .pnl--hero, [data-widget=${id}] .dash-stat`, box)));
  }
  // Trades with the revenge flag, as a list.
  await page.goto('http://localhost:4175/#/trades'); await page.locator('main h1').waitFor(); await page.waitForTimeout(700);
  await page.addStyleTag({ content: '.tabbar,.app-bar{display:none!important}' });
  const list = page.locator('main .list-card').first();
  if (await list.count()) { await list.screenshot({ path: 'trades.png' }); console.log('trades', JSON.stringify(await list.boundingBox())); }
  console.log('flags', JSON.stringify(await page.locator('main').evaluate((m) => [...m.querySelectorAll('[class*=flag], .badge, .tag')].slice(0, 12).map((e) => e.className + ':' + e.innerText))));
  // Live build: Pro page with the launch offer.
  const p2 = await mk('http://localhost:4173/');
  await p2.goto('http://localhost:4173/#/pro'); await p2.locator('main h1').waitFor(); await p2.waitForTimeout(900);
  await p2.addStyleTag({ content: '.tabbar,.app-bar{display:none!important}' });
  await p2.locator('.pro-hero').screenshot({ path: 'pro-hero.png' });
  await p2.locator('.pro-compare .card').first().screenshot({ path: 'pro-free.png' });
  const hb = await p2.locator('.pro-hero').boundingBox();
  console.log('hero', JSON.stringify({ w: hb.width, h: hb.height }), JSON.stringify(await rows(p2, '.pro-offer', hb)));
  console.log('free', JSON.stringify(await p2.locator('.pro-compare .card').first().boundingBox()));
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
