const { chromium } = require('playwright');
const DEMO = __dirname + '/../../checkin-story.json';
const rect = (sel) => [...document.querySelectorAll(sel)].map((e) => { const r = e.getBoundingClientRect(); return [e.innerText.replace(/\n/g, ' | ').slice(0, 70), Math.round(r.x), Math.round(r.y + scrollY), Math.round(r.width), Math.round(r.height)] });
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, locale: 'es-MX', colorScheme: 'dark', timezoneId: 'UTC' });
  const page = await ctx.newPage();
  await page.goto('http://localhost:4175/'); await page.locator('.onboarding input[type=file]').setInputFiles(DEMO); await page.waitForTimeout(1500);
  await page.goto('http://localhost:4175/#/analytics'); await page.locator('main h1').waitFor(); await page.waitForTimeout(1000);
  for (const w of ['performance', 'mistakeCost', 'byHold']) console.log(w, JSON.stringify(await page.evaluate(rect, `[data-widget=${w}] .bar-list__row, [data-widget=${w}] .dash-stat, [data-widget=${w}] .pnl--hero`)))
  await page.goto('http://localhost:4175/#/trades'); await page.locator('main h1').waitFor(); await page.waitForTimeout(800);
  await page.getByRole('button', { name: /Nueva operación/ }).first().click(); await page.waitForTimeout(800);
  const stop = page.getByLabel('Stop loss', { exact: false }).first()
  await stop.evaluate((e) => e.scrollIntoView({ block: 'center' })); await page.waitForTimeout(400)
  await page.screenshot({ path: 'shots/entry-stop.png' })
  console.log('stop', JSON.stringify(await stop.boundingBox()))
  await stop.fill('66,300'); await page.waitForTimeout(300); await page.screenshot({ path: 'shots/entry-stop-typed.png' })
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
