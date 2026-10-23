const APPS = { website: 'juliaan.eu', hockey: 'Hockey', finance: 'Finance Planner', 'finance-web': 'Finance Planner web-app' }
const datum = ms => new Date(ms).toISOString().replace('T', ' ')
// countRecords gebruikt SQL-expressies; findRecordsByFilter gebruikt PocketBase-filters.
const aantal = (app, collectie, filter, params) => app.countRecords(collectie, $dbx.exp(filter.replace(/&&/g, 'AND').replace(/\|\|/g, 'OR'), params || {}))

function eigenaar(e) {
  const id = $os.getenv('FEEDBACK_ADMIN_ID')
  const test = $os.getenv('HOCKEY_ENV') === 'test'
  if (!e.auth || e.auth.collection().name !== 'users' || !e.auth.getBool('superadmin') || (id ? e.auth.id !== id : !test)) {
    throw new ForbiddenError('Alleen Juliaan heeft toegang tot feedbackbeheer.')
  }
  e.response.header().set('Cache-Control', 'no-store')
}

function inzenden(e) {
  const b = e.requestInfo().body
  // Een spamval krijgt dezelfde bevestiging, maar wordt niet bewaard of gemaild.
  if (b.website) return e.json(200, { ontvangen: true })
  if (typeof b.app !== 'string' || !Object.prototype.hasOwnProperty.call(APPS, b.app) ||
      typeof b.bericht !== 'string' || b.bericht.trim().length < 3 || b.bericht.length > 5000 ||
      (b.naam != null && typeof b.naam !== 'string') || (b.email != null && typeof b.email !== 'string') ||
      typeof b.inzending !== 'string' || !/^[a-f0-9-]{36}$/.test(b.inzending)) {
    throw new BadRequestError('Kies een app en vul een bericht van 3 tot 5000 tekens in.')
  }
  const naam = (b.naam || '').trim()
  const email = (b.email || '').trim().toLowerCase()
  if (naam.length > 100 || /[\r\n]/.test(naam) || email.length > 254 || (email && !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email))) {
    throw new BadRequestError('Controleer je naam en e-mailadres.')
  }
  const sleutel = $os.getenv('FEEDBACK_RATE_KEY') || ($os.getenv('HOCKEY_ENV') === 'test' ? 'uitsluitend-test' : '')
  if (!sleutel) throw new BadRequestError('Het formulier is tijdelijk niet beschikbaar.')
  const nu = Date.now()
  const ipHash = $security.hs256(new Date(nu).toISOString().slice(0, 10) + ':' + e.realIP(), sleutel)
  const contactHash = email ? $security.hs256(email, sleutel) : ''
  e.app.runInTransaction(app => {
    // Herhalen na een verbindingsfout maakt geen tweede bericht of mail.
    if (aantal(app, 'feedback', 'inzending = {:i}', { i: b.inzending })) return
    if (aantal(app, 'feedback_limieten', 'created > {:t}', { t: datum(nu - 3600000) }) >= 10 ||
        aantal(app, 'feedback_limieten', 'bezoeker = {:ip} && created > {:t}', { ip: ipHash, t: datum(nu - 900000) }) >= 3) {
      throw new TooManyRequestsError('Er zijn te veel berichten verstuurd. Probeer het later nog eens.')
    }
    const bevestigen = email && !aantal(app, 'feedback_limieten', 'contact = {:c} && created > {:t}', { c: contactHash, t: datum(nu - 86400000) })
    const limiet = new Record(app.findCollectionByNameOrId('feedback_limieten'))
    limiet.set('bezoeker', ipHash); limiet.set('contact', contactHash); app.save(limiet)
    const r = new Record(app.findCollectionByNameOrId('feedback'))
    for (const [k, v] of Object.entries({ app: b.app, bericht: b.bericht.trim(), naam, email, inzending: b.inzending })) r.set(k, v)
    app.save(r)
    for (const soort of bevestigen ? ['melding', 'bevestiging'] : ['melding']) {
      const mail = new Record(app.findCollectionByNameOrId('feedback_mail'))
      mail.set('feedback', r.id); mail.set('soort', soort); mail.set('status', 'wacht'); app.save(mail)
    }
  })
  return e.json(200, { ontvangen: true })
}

function overzicht(e) {
  eigenaar(e)
  const q = e.requestInfo().query
  const pagina = Math.max(1, Math.min(100000, parseInt(q.pagina || '1', 10) || 1))
  const filters = ['id != ""'], params = {}
  if (q.app && Object.prototype.hasOwnProperty.call(APPS, q.app)) { filters.push('app = {:app}'); params.app = q.app }
  if (q.status === 'nieuw') filters.push('afgehandeld = false')
  if (q.status === 'afgehandeld') filters.push('afgehandeld = true')
  const filter = filters.join(' && ')
  const items = e.app.findRecordsByFilter('feedback', filter, '-created,-id', 25, (pagina - 1) * 25, params).map(r => ({
    id: r.id, app: r.getString('app'), bericht: r.getString('bericht'), naam: r.getString('naam'), email: r.getString('email'),
    afgehandeld: r.getBool('afgehandeld'), created: r.getString('created'),
    mails: e.app.findRecordsByFilter('feedback_mail', 'feedback = {:id}', 'created', 2, 0, { id: r.id }).map(m => ({
      soort: m.getString('soort'), status: m.getString('status'), verzondenOp: m.getString('verzondenOp'),
    })),
  }))
  return e.json(200, { items, pagina, totaal: aantal(e.app, 'feedback', filter, params) })
}

function wijzigen(e) {
  eigenaar(e)
  const body = e.requestInfo().body
  if (typeof body.afgehandeld !== 'boolean' || Object.keys(body).length !== 1) throw new BadRequestError('Ongeldige wijziging.')
  const r = e.app.findRecordById('feedback', e.request.pathValue('id'))
  r.set('afgehandeld', body.afgehandeld); e.app.save(r)
  return e.json(200, { bijgewerkt: true })
}

function verwijderen(e) {
  eigenaar(e)
  e.app.runInTransaction(app => {
    const id = e.request.pathValue('id')
    if (aantal(app, 'feedback_mail', 'feedback = {:id} && status = "bezig"', { id })) {
      throw new BadRequestError('Dit bericht wordt net gemaild. Probeer verwijderen over een minuut opnieuw.')
    }
    app.delete(app.findRecordById('feedback', id))
  })
  return e.json(200, { verwijderd: true })
}

function verwerk(app) {
  const nu = Date.now()
  // Een afgebroken proces laat zijn taak na tien minuten opnieuw proberen.
  for (const m of app.findRecordsByFilter('feedback_mail', 'status = "bezig" && updated < {:t}', '', 100, 0, { t: datum(nu - 600000) })) {
    m.set('status', 'fout'); app.save(m)
  }
  const map = app.dataDir() + '/feedback-mail'
  $os.mkdirAll(map, 0o700)
  const taken = app.findRecordsByFilter('feedback_mail', '(status = "wacht" || status = "fout") && (probeerOp = "" || probeerOp <= {:nu})', 'created', 3, 0, { nu: datum(nu) })
  for (const taak of taken) {
    let claim = null
    app.runInTransaction(tx => {
      let m
      try { m = tx.findRecordById('feedback_mail', taak.id) } catch (_) { return }
      if (!['wacht', 'fout'].includes(m.getString('status'))) return
      m.set('status', 'bezig'); m.set('pogingen', m.getInt('pogingen') + 1); tx.save(m)
      const r = tx.findRecordById('feedback', m.getString('feedback'))
      claim = { id: m.id, soort: m.getString('soort'), app: APPS[r.getString('app')], bericht: r.getString('bericht'), naam: r.getString('naam'), email: r.getString('email'), datum: new Date().toISOString() }
    })
    if (!claim) continue
    const pad = map + '/' + claim.id + '.json'
    let geslaagd = false
    try {
      $os.writeFile(pad, JSON.stringify(claim), 0o600)
      const uitkomst = JSON.parse(toString($os.cmd('python3', '/pb/scripts/feedback-mail.py', 'verstuur', pad).output()))
      geslaagd = uitkomst.verzonden === true
    } catch (_) { app.logger().error('Feedbackmail mislukt; taak blijft in de wachtrij') }
    finally { try { $os.remove(pad) } catch (_) {} }
    const m = app.findRecordById('feedback_mail', claim.id)
    m.set('status', geslaagd ? 'verzonden' : 'fout')
    if (geslaagd) m.set('verzondenOp', datum(Date.now()))
    else m.set('probeerOp', datum(Date.now() + 3600000))
    app.save(m)
  }
  if ($os.getenv('HOCKEY_ENV') !== 'test') {
    try { $os.cmd('python3', '/pb/scripts/feedback-mail.py', 'archiveer', app.dataDir() + '/feedback-verzonden').output() }
    catch (_) { app.logger().error('Feedbackkopieën wachten op IMAP-archivering') }
  }
  app.db().newQuery('DELETE FROM feedback_limieten WHERE created < {:t}').bind({ t: datum(nu - 2 * 86400000) }).execute()
}

module.exports = { inzenden, overzicht, wijzigen, verwijderen, verwerk }
