const { chromium } = require('playwright');
const DEMO = __dirname + '/../../checkin-story.json';
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, locale: 'es-MX', colorScheme: 'dark', timezoneId: 'UTC' });
  const page = await ctx.newPage();
  await page.goto('http://localhost:4175/'); await page.locator('.onboarding input[type=file]').setInputFiles(DEMO);
  await page.waitForTimeout(1500);
  for (const [name, hash] of [['analytics', 'analytics'], ['today', 'today'], ['trades', 'trades']]) {
    await page.goto('http://localhost:4175/#/' + hash); await page.locator('main h1').waitFor(); await page.waitForTimeout(1200);
    await page.screenshot({ path: `shots/${name}-view.png` });
    await page.screenshot({ path: `shots/${name}-full.png`, fullPage: true });
    const dims = await page.evaluate(() => ({ w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight }));
    console.log(name, JSON.stringify(dims));
  }
  await page.goto('http://localhost:4175/#/analytics'); await page.locator('main h1').waitFor(); await page.waitForTimeout(1000);
  const ws = await page.evaluate(() => [...document.querySelectorAll('[data-widget]')].map((e) => { const r = e.getBoundingClientRect(); return [e.dataset.widget, Math.round(r.x), Math.round(r.y + scrollY), Math.round(r.width), Math.round(r.height)] }));
  console.log('widgets', JSON.stringify(ws));
  const rows = await page.evaluate(() => [...document.querySelectorAll('[data-widget=byEmotion] .bar-list__row')].map((e) => { const r = e.getBoundingClientRect(); return [e.innerText.replace(/\n/g, ' '), Math.round(r.x), Math.round(r.y + scrollY), Math.round(r.width), Math.round(r.height)] }));
  console.log('emoRows', JSON.stringify(rows));
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
