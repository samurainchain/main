// node x3d/render60.cjs stage.html outDir fps worker workers
const { chromium } = require('playwright');
const fs = require('fs');
const [stage, dir, fps, k, n] = [process.argv[2], process.argv[3], +process.argv[4], +process.argv[5], +process.argv[6]];
(async () => {
  const b = await chromium.launch();
  const page = await (await b.newContext({ viewport: { width: 1080, height: 1920 } })).newPage();
  await page.goto('file://' + process.cwd() + '/' + stage); await page.waitForLoadState('load');
  await page.evaluate(() => Promise.all([...document.images].map((i) => i.decode())));
  fs.mkdirSync(dir, { recursive: true });
  const total = Math.round(await page.evaluate(() => DURATION) * fps);
  for (let i = k; i < total; i += n) { await page.evaluate((t) => render(t), i / fps); await page.screenshot({ path: `${dir}/${String(i).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 92 }); }
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
