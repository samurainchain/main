const { chromium } = require('playwright');
const DEMO = __dirname + '/../../checkin-story.json';
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, locale: 'es-MX', colorScheme: 'dark', timezoneId: 'UTC' });
  const page = await ctx.newPage();
  await page.goto('http://localhost:4175/'); await page.locator('.onboarding input[type=file]').setInputFiles(DEMO); await page.waitForTimeout(1500);
  await page.goto('http://localhost:4175/#/trades'); await page.locator('main h1').waitFor(); await page.waitForTimeout(800);
  await page.getByText('Por día', { exact: true }).first().click(); await page.waitForTimeout(800);
  await page.screenshot({ path: 'shots/byday-full.png', fullPage: true });
  const info = await page.evaluate(() => {
    const out = { days: [], rows: [] }
    for (const h of document.querySelectorAll('main h2, main h3')) { const r = h.getBoundingClientRect(); out.days.push([h.innerText, Math.round(r.x), Math.round(r.y + scrollY), Math.round(r.width), Math.round(r.height)]) }
    for (const el of document.querySelectorAll('main li, main [class*=trade-row], main [class*=list-row]')) { const r = el.getBoundingClientRect(); if (r.height > 30 && r.height < 200) out.rows.push([el.className, el.innerText.replace(/\n/g, ' | ').slice(0, 120), Math.round(r.x), Math.round(r.y + scrollY), Math.round(r.width), Math.round(r.height)]) }
    return out
  }); console.log(JSON.stringify(info.days)); info.rows.forEach((r) => console.log(JSON.stringify(r)))
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
