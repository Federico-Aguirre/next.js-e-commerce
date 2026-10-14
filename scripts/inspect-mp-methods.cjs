const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage();
  await p.goto('http://127.0.0.1:3001/checkout', { waitUntil: 'domcontentloaded' }).catch(() => {});
  await p.waitForTimeout(1500);
  const out = await p.evaluate(() => {
    const C = window.MercadoPago;
    if (!C) return { loaded: false };
    return { loaded: true, proto: Object.getOwnPropertyNames(C.prototype || {}) };
  });
  console.log(JSON.stringify(out));
  await b.close();
})();
