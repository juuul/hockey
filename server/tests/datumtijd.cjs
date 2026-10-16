// Echte datum-/tijdkiezer in Chrome; alle data is fictief, API-verkeer wordt geblokkeerd.
const assert = require('node:assert/strict')
const puppeteer = require('/usr/src/app/node_modules/puppeteer')
;(async () => {
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium-browser', args: ['--no-sandbox'] })
  try {
    const page = await browser.newPage()
    const fouten = []
    page.on('pageerror', e => fouten.push(e.message))
    await page.setViewport({ width: 360, height: 640 })
    await page.setRequestInterception(true)
    page.on('request', req => {
      const u = new URL(req.url())
      if (u.hostname !== '127.0.0.1' || u.pathname.includes('/api/')) return req.abort()
      if (u.pathname === '/__datumtest') return req.respond({ contentType: 'text/html', body: `<div id="root"></div><script type="module">
        import React from '/node_modules/.vite/deps/react.js';
        import ReactDOM from '/node_modules/.vite/deps/react-dom_client.js';
        import RefreshRuntime from '/@react-refresh';
        RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;
        await import('/src/index.css');await import('/src/components/Modal.css');
        const {default:Kiezer}=await import('/src/components/DatumTijdKiezer.tsx');
        function App(){const [datum,D]=React.useState('2026-10-16');const [tijd,T]=React.useState('09:30');window.waarden={datum,tijd};return React.createElement('div',{className:'modal show'},React.createElement('div',{className:'modal-content'},
          React.createElement(Kiezer,{soort:'date',waarde:datum,onChange:D}),React.createElement(Kiezer,{soort:'time',waarde:tijd,onChange:T,optioneel:true}),
          React.createElement('input',{id:'notitie',defaultValue:'Bewaar deze invoer'}),React.createElement('button',{id:'opslaan',onClick:()=>window.opgeslagen=true},'Opslaan')))}
        ReactDOM.createRoot(document.querySelector('#root')).render(React.createElement(App));
      </script>` })
      req.continue()
    })
    await page.goto('http://127.0.0.1:5187/__datumtest')
    await page.waitForSelector('.datumtijd-veld')
    await page.click('.datumtijd-veld')
    await page.waitForSelector('dialog[open]')
    if (process.env.SCREENSHOT) await page.screenshot({ path: process.env.SCREENSHOT })
    assert.equal(await page.$eval('.datumtijd-dag', e => parseFloat(getComputedStyle(e).fontSize) >= 22), true)
    // Klikken waar Opslaan zich bevindt mag nooit het onderliggende formulier activeren.
    const rect = await page.$eval('#opslaan', e => { const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })
    await page.mouse.click(rect.x, rect.y)
    assert.equal(await page.evaluate(() => !!window.opgeslagen), false)
    await page.click('[aria-label="31 oktober 2026"]')
    assert.equal(await page.evaluate(() => window.waarden.datum), '2026-10-16', 'Selectie nog niet bevestigd')
    await page.evaluate(() => [...document.querySelectorAll('dialog button')].find(b => b.textContent === 'Kiezen').click())
    await page.waitForFunction(() => !document.querySelector('dialog'))
    assert.equal(await page.evaluate(() => window.waarden.datum), '2026-10-31')
    assert.equal(await page.$eval('#notitie', e => e.value), 'Bewaar deze invoer')
    await page.click('.datumtijd-veld')
    await page.click('[aria-label="Vorige maand"]')
    await page.keyboard.press('Escape')
    await page.waitForFunction(() => !document.querySelector('dialog'))
    assert.equal(await page.evaluate(() => window.waarden.datum), '2026-10-31')
    await page.evaluate(() => document.querySelectorAll('.datumtijd-veld')[1].click())
    await page.waitForSelector('dialog[open]')
    await page.$$eval('dialog input', els => {
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
      for (const [i, e] of els.entries()) { set.call(e, i ? '75' : '25'); e.dispatchEvent(new Event('input', { bubbles: true })) }
    })
    assert.equal(await page.$eval('dialog .btn-primary', e => e.disabled), true)
    await page.$$eval('dialog input', els => {
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
      for (const [i, e] of els.entries()) { set.call(e, i ? '5' : '11'); e.dispatchEvent(new Event('input', { bubbles: true })) }
    })
    await page.evaluate(() => document.querySelector('dialog .btn-primary').click())
    await page.waitForFunction(() => !document.querySelector('dialog'))
    assert.equal(await page.evaluate(() => window.waarden.tijd), '11:05')
    assert.equal(await page.evaluate(() => !!window.opgeslagen), false)
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    await page.evaluate(() => document.querySelectorAll('.datumtijd-veld')[1].click())
    await page.waitForSelector('dialog[open]')
    await page.goBack()
    await page.waitForFunction(() => !document.querySelector('dialog'))
    assert.equal(await page.evaluate(() => window.waarden.tijd), '11:05')
    assert.deepEqual(fouten, [])
    console.log('DATUMTIJD_OK: achtergrond geblokkeerd, datum pas na bevestigen, invoer behouden, tijdvalidatie, Escape/telefoonterug en 360px-layout.')
  } finally { await browser.close() }
})().catch(e => { console.error(e); process.exit(1) })
