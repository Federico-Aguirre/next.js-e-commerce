const { chromium } = require('playwright');
require('dotenv').config();
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage();
  await p.setContent('<div id="box"></div>');
  await p.addScriptTag({ url: 'https://www.sandbox.paypal.com/web-sdk/v6/core' });
  const result = await p.evaluate(async (clientId) => {
    const sdk = await window.paypal.createInstance({
      clientId,
      components: ['paypal-payments'],
      pageType: 'checkout',
    });
    const methods = await sdk.findEligibleMethods({ currencyCode: 'USD' });
    const button = document.createElement('paypal-button');
    button.setAttribute('type', 'pay');
    document.querySelector('#box').appendChild(button);
    await new Promise((r) => setTimeout(r, 300));
    return {
      eligible: methods.isEligible('paypal'),
      buttonRendered: Boolean(document.querySelector('paypal-button')),
    };
  }, process.env.PAYPAL_CLIENT_ID);
  console.log(JSON.stringify(result));
  await b.close();
})();
