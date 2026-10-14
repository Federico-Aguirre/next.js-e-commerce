const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page
    .goto('http://127.0.0.1:3001/checkout/paypal', { waitUntil: 'domcontentloaded' })
    .catch(() => {});
  if (!(await page.evaluate(() => Boolean(window.paypal)))) {
    await page.addScriptTag({ url: 'https://www.sandbox.paypal.com/web-sdk/v6/core' });
  }
  const out = await page.evaluate(async () => {
    const cfg = await fetch('/api/paypal/auth/browser-safe-client-token').then((r) => r.json());
    const sdk = await window.paypal.createInstance({
      clientToken: cfg.clientToken,
      components: ['card-fields'],
      pageType: 'checkout',
    });
    const methods = await sdk.findEligibleMethods({ currencyCode: 'USD' });
    const proto = Object.getOwnPropertyNames(Object.getPrototypeOf(methods) || {});
    const own = {};
    for (const k of Object.keys(methods)) {
      try {
        const v = methods[k];
        own[k] = typeof v === 'function' ? '[function]' : v;
      } catch {}
    }
    const checks = {};
    for (const name of ['advanced_cards', 'paypal', 'card', 'venmo', 'paylater']) {
      try {
        checks[name] = methods.isEligible(name);
      } catch (e) {
        checks[name] = 'ERR';
      }
    }
    return { proto, own, checks };
  });
  console.log(JSON.stringify(out, null, 2));
  await browser.close();
})();
