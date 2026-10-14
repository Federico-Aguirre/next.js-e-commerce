const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage();
  await p
    .goto('http://127.0.0.1:3001/checkout/paypal', { waitUntil: 'domcontentloaded' })
    .catch(() => {});
  if (!(await p.evaluate(() => Boolean(window.paypal))))
    await p.addScriptTag({ url: 'https://www.sandbox.paypal.com/web-sdk/v6/core' });
  const out = await p.evaluate(async () => {
    const cfg = await fetch('/api/paypal/auth/browser-safe-client-token').then((r) => r.json());
    const sdk = await window.paypal.createInstance({
      clientToken: cfg.clientToken,
      components: ['paypal-payments'],
      pageType: 'checkout',
    });
    const methods = await sdk.findEligibleMethods({ currencyCode: 'USD' });
    return { paypal: methods.isEligible('paypal'), details: methods.getDetails('paypal') };
  });
  console.log(JSON.stringify(out, null, 2));
  await b.close();
})();
