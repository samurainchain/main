const { chromium } = require('playwright');
const fs = require('fs');
const FPS = 30;
const [stage, mode] = [process.argv[2], process.argv[3]];
(async () => {
  const b = await chromium.launch();
  const page = await (await b.newContext({ viewport: { width: 1080, height: 1920 } })).newPage();
  await page.goto('file://' + __dirname + '/' + stage);
  await page.waitForLoadState('load');
  await page.evaluate(() => Promise.all([...document.images].map((i) => i.decode())));
  const name = stage.replace('.html', '');
  if (mode !== 'all') {
    for (const t of mode.split(',').map(Number)) { await page.evaluate((t) => render(t), t); await page.screenshot({ path: `peek-${name}-${t}.png` }); }
  } else {
    const dir = `frames-${name}`; fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir);
    const total = Math.round(await page.evaluate(() => DURATION) * FPS);
    for (let i = 0; i < total; i++) { await page.evaluate((t) => render(t), i / FPS); await page.screenshot({ path: `${dir}/${String(i).padStart(4, '0')}.jpg`, type: 'jpeg', quality: 93 }); }
  }
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
