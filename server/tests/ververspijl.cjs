// De echte ververscomponent met een bewust trage/afgewezen taak; geen serververkeer.
const assert = require('node:assert/strict')
const puppeteer = require('/usr/src/app/node_modules/puppeteer')
;(async () => {
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium-browser', args: ['--no-sandbox'] })
  try {
    const page = await browser.newPage()
    const fouten = []
    page.on('pageerror', e => fouten.push(e.message))
    await page.setRequestInterception(true)
    page.on('request', req => {
      const u = new URL(req.url())
      if (u.hostname !== '127.0.0.1') return req.abort()
      if (u.pathname === '/__pijltest') return req.respond({ contentType: 'text/html', body: `<div id="root"></div><script type="module">
        import React from '/node_modules/.vite/deps/react.js';import ReactDOM from '/node_modules/.vite/deps/react-dom_client.js';
        import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;
        const {default:Verversen}=await import('/src/components/Verversen.tsx');window.rondes=0;
        function App(){const ref=React.useRef();return React.createElement('div',{ref,className:'content'},React.createElement('div',{id:'trek'},'Trekken'),React.createElement(Verversen,{scrollVak:ref,onVervers:()=>{window.rondes++;return new Promise((resolve,reject)=>{window.voltooi=resolve;window.faal=reject})}}))}
        window.root=ReactDOM.createRoot(document.querySelector('#root'));window.root.render(React.createElement(App));
      </script>` })
      req.continue()
    })
    await page.goto('http://127.0.0.1:5187/__pijltest')
    await page.waitForSelector('#trek')
    const trek = () => page.evaluate(() => {
      const el = document.querySelector('#trek')
      for (const [type, y] of [['touchstart', 20], ['touchmove', 110], ['touchend', 110]]) el.dispatchEvent(new TouchEvent(type, { bubbles: true, touches: type === 'touchend' ? [] : [new Touch({ identifier: 1, target: el, clientX: 20, clientY: y })] }))
    })
    await trek()
    await page.waitForSelector('.verversen.laden')
    assert.equal(await page.evaluate(() => window.rondes), 1)
    await page.waitForFunction(() => !document.querySelector('.verversen'), { timeout: 2700 })
    await trek()
    assert.equal(await page.evaluate(() => window.rondes), 1, 'Geen dubbele taak zolang de eerste nog draait')
    await page.evaluate(() => window.voltooi())
    await trek()
    await page.waitForFunction(() => window.rondes === 2)
    await page.evaluate(() => window.faal(new Error('Fictieve netwerkstoring')))
    await page.waitForFunction(() => !document.querySelector('.verversen'))
    await trek()
    await page.waitForFunction(() => window.rondes === 3)
    await page.evaluate(() => window.voltooi())
    await page.waitForFunction(() => !document.querySelector('.verversen'))
    assert.deepEqual(fouten, [])
    console.log('VERVERSPIJL_OK: trage taak loopt door zonder blijvende pijl, geen dubbele rondes, herstel na slagen en netwerkfout.')
  } finally { await browser.close() }
})().catch(e => { console.error(e); process.exit(1) })
