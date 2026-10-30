const { chromium } = require('playwright');
const DEMO = __dirname + '/../../checkin-story.json';
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, locale: 'es-MX', colorScheme: 'dark', timezoneId: 'UTC' });
  const page = await ctx.newPage();
  await page.goto('http://localhost:4175/'); await page.locator('.onboarding input[type=file]').setInputFiles(DEMO);
  await page.waitForTimeout(1500);
  await page.goto('http://localhost:4175/#/trades'); await page.locator('main h1').waitFor(); await page.waitForTimeout(800);
  await page.getByRole('button', { name: /Nueva operación/ }).first().click(); await page.waitForTimeout(1000);
  await page.locator('input').first().fill('BTCUSDT').catch(() => {})
  await page.locator('.emotion-picker__option').first().evaluate((e) => e.scrollIntoView({ block: 'center' })); await page.waitForTimeout(500)
  await page.screenshot({ path: 'shots/entry-view.png' });
  const pos = await page.evaluate(() => [...document.querySelectorAll('.emotion-picker__option')].map((e) => { const r = e.getBoundingClientRect(); return [e.innerText.trim(), Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)] }))
  console.log('chips', JSON.stringify(pos))
  await page.locator('.emotion-picker__option', { hasText: 'Enojo' }).click(); await page.waitForTimeout(400); await page.screenshot({ path: 'shots/entry-enojo.png' });
  await page.locator('.emotion-picker__option', { hasText: 'Calma' }).click(); await page.waitForTimeout(400); await page.screenshot({ path: 'shots/entry-calma.png' });
  const info = await page.evaluate(() => {
    const out = []
    for (const el of document.querySelectorAll('dialog *, [role=dialog] *')) {
      const txt = (el.innerText || '').trim()
      if (/^(Calma|Enojo|FOMO|Confianza|Miedo|Codicia|Aburrimiento)$/.test(txt) && el.children.length <= 2) { const r = el.getBoundingClientRect(); out.push([txt, el.tagName, el.className, Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]) }
    }
    const d = document.querySelector('dialog, [role=dialog]'); const r = d && d.getBoundingClientRect()
    return { chips: out, dialog: r && [r.x, r.y, r.width, r.height], scroll: d && d.scrollHeight }
  })
  console.log(JSON.stringify(info))
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
