const { chromium } = require('playwright');
const DEMO = __dirname + '/../../checkin-story.json';
const prices = (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ currency: 'usd', monthly: '15.99', annual: '44.99', sandbox: false }) });
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, locale: 'es-MX', colorScheme: 'dark', timezoneId: 'UTC' });
  const page = await ctx.newPage(); await page.route('**/functions/v1/**', prices);
  await page.goto('http://localhost:4173/'); await page.locator('.onboarding input[type=file]').setInputFiles(DEMO); await page.waitForTimeout(1500);
  await page.goto('http://localhost:4173/#/pro'); await page.locator('main h1').waitFor(); await page.waitForTimeout(1200);
  await page.screenshot({ path: 'shots/pro-view.png' });
  for (const sel of ['.pro-hero', '.pro-offer', '.pro-compare .card']) console.log(sel, JSON.stringify(await page.evaluate((s) => [...document.querySelectorAll(s)].map((e) => { const r = e.getBoundingClientRect(); return [e.innerText.replace(/\n/g, ' | ').slice(0, 80), Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)] }), sel)))
  await page.goto('http://localhost:4173/#/today'); await page.locator('main h1').waitFor(); await page.waitForTimeout(1000);
  await page.screenshot({ path: 'shots/today-view2.png' });
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
