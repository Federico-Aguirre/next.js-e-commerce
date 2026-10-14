const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('http://localhost:3001/checkout/paypal', { waitUntil: 'domcontentloaded' });
  if (!(await page.evaluate(() => Boolean(window.paypal)))) {
    await page.addScriptTag({ url: 'https://www.sandbox.paypal.com/web-sdk/v6/core' });
  }
  await page.waitForFunction(() => Boolean(window.paypal?.createInstance), null, {
    timeout: 15000,
  });
  const result = await page.evaluate(async () => {
    const r = await fetch('/api/paypal/auth/browser-safe-client-token', { cache: 'no-store' });
    const j = await r.json();
    if (!r.ok || !j.clientToken)
      return { tokenHttp: r.status, token: false, error: j.message || null };
    const sdk = await window.paypal.createInstance({
      clientToken: j.clientToken,
      components: ['card-fields'],
      pageType: 'checkout',
    });
    const methods = await sdk.findEligibleMethods({ currencyCode: 'USD' });
    return {
      tokenHttp: r.status,
      token: true,
      advancedCards: methods.isEligible('advanced_cards'),
    };
  });
  console.log(JSON.stringify(result));
  await browser.close();
})();
