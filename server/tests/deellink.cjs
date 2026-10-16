// Test de echte componentcode met nagebootst deelmenu/klembord, zonder server of echte links.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const bron = fs.readFileSync(path.resolve(__dirname, '../../src/components/DeelKijklink.tsx'), 'utf8')
const code = ts.transpileModule(bron, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
const url = 'https://example.invalid/#aanvraag=testteam.testtoken'

async function test(soort, scenario) {
  const gedeeld = []
  const gekopieerd = []
  const meldingen = []
  const navigator = {
    clipboard: { writeText: async tekst => {
      if (scenario === 'handmatig') throw Error('Klembord geblokkeerd')
      gekopieerd.push(tekst)
    } },
  }
  if (scenario !== 'klembord' && scenario !== 'handmatig') navigator.share = async data => {
    gedeeld.push(data)
    if (scenario === 'geannuleerd') throw Object.assign(Error('Geannuleerd'), { name: 'AbortError' })
    if (scenario === 'deelfout') throw Error('Deelmenu niet beschikbaar')
  }
  const modules = {
    react: { useState: begin => [begin, waarde => meldingen.push(waarde)] },
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    '../context/AccountContext': { useAccount: () => ({ gebruiker: { id: 'testouder' }, actiefTeam: { id: 'testteam', naam: 'Testteam' }, teamsLaden: async () => {} }) },
    '../server': { foutTekst: String, rolIn: () => 'beheerder', haalAanvraagLink: async () => url, haalKijkLink: async () => url },
    '../statistiek': { tel: () => {} },
    './ResetModal': {},
    './DeelKijklink.css': {},
  }
  const exports = {}
  vm.runInNewContext(code, { exports, navigator, require: naam => {
    assert.ok(naam in modules, `Onverwachte import: ${naam}`)
    return modules[naam]
  } })
  const component = exports.default({ soort })
  await component.props.children[0].props.onClick()
  // Serialiseren verwijdert alleen de prototypes uit de andere VM-context.
  if (navigator.share) assert.deepEqual(JSON.parse(JSON.stringify(gedeeld)), [{ url }])
  assert.deepEqual(gekopieerd, scenario === 'klembord' || scenario === 'deelfout' ? [url] : [])
  if (scenario === 'handmatig') assert.ok(meldingen.includes(url))
  if (scenario === 'geannuleerd') assert.equal(meldingen.some(m => m?.fout), false)
}

;(async () => {
  for (const soort of ['kijk', 'aanvraag']) {
    for (const scenario of ['delen', 'klembord', 'deelfout', 'handmatig', 'geannuleerd']) await test(soort, scenario)
  }
  console.log('DEELLINK_OK: beide linksoorten delen uitsluitend de URL; klembord, handmatige terugval en annuleren werken.')
})().catch(err => { console.error(err); process.exit(1) })
