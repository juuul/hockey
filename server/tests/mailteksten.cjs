// Controleer de echte mailfuncties zonder netwerk, met uitsluitend fictieve gegevens.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const path = require('node:path')
const sandbox = { module: { exports: {} }, $os: { getenv: () => 'test' }, MailerMessage: function (data) { Object.assign(this, data) }, console }
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../pb_hooks/hockey.js'), 'utf8'), sandbox)
const h = sandbox.module.exports, mails = []
const team = { getString: veld => veld === 'naam' ? 'Demo <team>' : '' }
const app = { findRecordById: () => team, settings: () => ({ meta: { senderAddress: 'hockey@example.invalid', senderName: 'Hockey TEST' } }), newMailClient: () => ({ send: mail => mails.push(mail) }), save: () => {} }
for (const rol of ['kijker', 'beheerder']) for (const herinnering of [false, true]) {
  const data = { team: 'demo', terug: 'https://hockey.juliaan.eu/test/', token: 'FictieveTokenZonderToegang1234567890', naam: 'Demo <ouder>', email: 'demo@example.invalid', rol }
  h.stuurUitnodiging(app, { getString: veld => data[veld] || '' }, herinnering)
  const mail = mails.at(-1)
  assert.ok(mail.html.includes('Demo &lt;ouder&gt;') && mail.html.includes('Demo &lt;team&gt;'))
  assert.ok(mail.html.includes('e-mailadres te bevestigen en aan te sluiten'))
  assert.ok(mail.html.includes('#uitnodiging=' + data.token))
  assert.ok(mail.html.includes('Heb je nog geen account?'))
  assert.ok(mail.html.includes('7 dagen na de oorspronkelijke verzending'))
  assert.ok(mail.html.includes('Vraag om een nieuwe uitnodiging'))
  assert.ok(!mail.html.includes('team verwijderd') && !mail.html.includes('Je bent nu lid'))
  assert.equal(mail.subject.startsWith('Herinnering:'), herinnering)
  assert.equal(mail.html.includes('Deze uitnodiging is nog niet geaccepteerd'), herinnering)
  assert.ok(mail.html.includes(rol === 'beheerder' ? 'mag alles bijhouden en regelen' : 'kijkt mee'))
}
// Oude afwijzingsroutes blijven uitsluitend een afwijzing beschrijven.
for (const soort of ['toegang', 'team']) {
  const data = { status: 'nieuw', email: 'demo@example.invalid', naam: 'Demo ouder', team: 'demo', teamnaam: 'Demo team' }
  const record = { getString: veld => data[veld] || '', set: (veld, waarde) => { data[veld] = waarde } }
  if (soort === 'toegang') h.beslisAanvraag(app, record, 'af', 'demobeheerder')
  else h.beslisAanmelding(app, record, 'af')
  assert.equal(data.status, 'afgewezen')
  assert.ok(mails.at(-1).html.includes('niet goedgekeurd'))
  assert.ok(!mails.at(-1).html.includes('#uitnodiging='))
}
console.log('MAILTEKSTEN_OK: uitnodiging en herinnering voor beide rollen, processtap/e-mailbevestiging, geldigheid, escaping en oude afwijzingen')
