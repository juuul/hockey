import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import assert from 'node:assert/strict'
const sandbox = { module: {exports:{}} }
runInNewContext(readFileSync(new URL('../pb_hooks/reiscache.js', import.meta.url),'utf8'), sandbox)
const h = sandbox.module.exports
for (const [sec, min] of [[0,0],[0.1,5],[299.9,5],[300,5],[300.1,10],[2100.1,40],[86400,1440]]) assert.equal(h.rijMinuten(sec), min)
for (const sec of [-1, NaN, Infinity, '300', 86401]) assert.throws(() => h.rijMinuten(sec))
assert.equal(h.resultaat(null), null)
assert.equal(h.resultaat({getString: () => 'nieuw'}), null)
const waarden = {status:'klaar', minuten:0, bron:'zelfde locatie', berekend:'2026-10-12'}
assert.deepEqual(JSON.parse(JSON.stringify(h.resultaat({getString:k=>waarden[k],getFloat:k=>waarden[k]}))), {minuten:0,bron:'zelfde locatie',berekend:'2026-10-12',opgeslagen:true})
console.log('REISCACHE_TEST_OK: grenzen, omhoog afronden, onbekend versus nul')
