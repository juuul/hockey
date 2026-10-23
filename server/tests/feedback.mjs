// Alleen de lege fixture op localhost 8099, met Mailpit en fictieve accounts.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
const base = 'http://127.0.0.1:8099'
async function request(path, method = 'GET', body, token) {
  return fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: token } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) })
}
async function login(email) {
  // Respecteer ook op de fixture de bestaande aanmeldlimiet.
  await new Promise(resolve => setTimeout(resolve, 1200))
  const r = await request('/api/collections/users/auth-with-password', 'POST', { identity: email, password: 'FeedbackTest123!' })
  assert.equal(r.status, 200, await r.clone().text())
  return (await r.json()).token
}
const owner = await login('owner@example.invalid')
const user = await login('user@example.invalid')
const other = await login('other@example.invalid')
for (const token of [undefined, user, other]) {
  const response = await request('/api/feedback/beheer', 'GET', undefined, token)
  assert.ok([401, 403].includes(response.status), 'Alleen eigenaar mag lezen')
}
for (const col of ['feedback', 'feedback_mail', 'feedback_limieten']) {
  for (const token of [undefined, user, owner]) {
    assert.equal((await request('/api/collections/' + col + '/records', 'GET', undefined, token)).status, 403)
    assert.equal((await request('/api/collections/' + col + '/records', 'POST', { bericht: 'Omweg' }, token)).status, 403)
  }
}
const submit = body => request('/api/feedback/inzenden', 'POST', { app: 'hockey', bericht: 'QA fictieve feedback', inzending: randomUUID(), ...body })
for (const body of [{ app: 'onbekend' }, { app: 'contact' }, { app: 'contact', email: 'contact@example.invalid' }, { app: 'contact', naam: 'Test' }, { bericht: '' }, { email: 'geen-email' }, { email: 'a@b.nl\r\nBcc: ander@b.nl' }, { bericht: 'x'.repeat(5001) }, { inzending: 'ongeldig' }]) assert.equal((await submit(body)).status, 400)
assert.equal((await submit({ website: 'spam.example' })).status, 200)
const idempotency = randomUUID()
assert.equal((await submit({ inzending: idempotency })).status, 200)
assert.equal((await submit({ email: 'tester@example.invalid', naam: '<script>alert(1)</script>', app: 'finance', bericht: 'QA fictief contactbericht <img src=x onerror=alert(1)>' })).status, 200)
assert.equal((await submit({ email: 'tester@example.invalid', naam: 'Contacttest', app: 'contact' })).status, 200)
assert.equal((await submit({})).status, 429)
assert.equal((await submit({ inzending: idempotency })).status, 200)
const overview = await (await request('/api/feedback/beheer', 'GET', undefined, owner)).json()
assert.equal(overview.totaal, 3)
assert.equal(overview.items.reduce((n, r) => n + r.mails.length, 0), 4, 'Een bevestiging per adres per dag')
const contact = overview.items.find(r => r.app === 'finance')
assert.ok(contact.naam.startsWith('<script>'), 'Tekst bewaren, frontend ontsnapt via textContent')
for (const token of [undefined, user, other]) {
  for (const method of ['PATCH', 'DELETE']) assert.ok([401, 403].includes((await request('/api/feedback/beheer/' + contact.id, method, method === 'PATCH' ? { afgehandeld: true } : undefined, token)).status))
}
assert.equal((await request('/api/feedback/beheer/' + contact.id, 'PATCH', { afgehandeld: true, bericht: 'vervangen' }, owner)).status, 400)
assert.equal((await request('/api/feedback/beheer/' + contact.id, 'PATCH', { afgehandeld: true }, owner)).status, 200)
const filtered = await (await request('/api/feedback/beheer?app=finance&status=afgehandeld', 'GET', undefined, owner)).json()
assert.equal(filtered.totaal, 1)
const remove = overview.items.find(r => r.app === 'contact')
assert.ok(remove, 'Contactaanvraag opgeslagen')
assert.equal((await request('/api/feedback/beheer/' + remove.id, 'DELETE', undefined, owner)).status, 200)
assert.equal((await request('/api/collections/feedback/records/' + contact.id)).status, 403)
execFileSync('docker', ['exec', 'hockey-feedback-qa', '/pb/pocketbase', 'test-feedback-verwerk'], { stdio: 'pipe' })
const after = await (await request('/api/feedback/beheer', 'GET', undefined, owner)).json()
assert.equal(after.totaal, 2)
assert.ok(after.items.every(r => r.mails.every(m => m.status === 'verzonden')), JSON.stringify(after))
const messages = await (await fetch('http://127.0.0.1:8092/api/v1/messages')).json()
assert.ok(messages.messages.some(m => m.Subject === 'Feedback: Hockey'))
assert.ok(messages.messages.some(m => m.Subject === 'Bedankt voor je feedback'))
console.log('FEEDBACK_OK: rechten, eigenaar, validatie, limieten, idempotentie, filters, afhandelen, verwijderen, wachtrij en Mailpit.')
