/// <reference path="../pb_data/types.d.ts" />

// Uitnodiging aanmaken: token en maker bepaalt de server, daarna gaat de mail eruit
onRecordCreateRequest((e) => {
  const h = require(`${__hooks}/hockey.js`)
  if (!h.TOEGESTAAN.includes(e.record.getString("terug"))) throw new BadRequestError("Onbekend terugadres")
  e.record.set("email", e.record.getString("email").trim().toLowerCase())
  e.record.set("token", $security.randomString(40))
  e.record.set("maker", e.auth ? e.auth.id : "")
  e.next()
  try {
    h.stuurUitnodiging(e.app, e.record)
  } catch (err) {
    e.app.delete(e.record)
    throw new BadRequestError("De uitnodiging kon niet worden gemaild: " + err)
  }
}, "uitnodigingen")

// Inloggen of de app openen (inlog verversen): bijhouden voor 'Gebruik per team' (superadmin).
// Binnen 10 minuten nog eens telt niet opnieuw
onRecordAuthRequest((e) => {
  e.next()
  try {
    const sinds = new Date(Date.now() - 10 * 60 * 1000).toISOString().replace("T", " ")
    if (e.app.findRecordsByFilter("bezoeken", "user = {:u} && created > {:s}", "", 1, 0, { u: e.record.id, s: sinds }).length) return
    const b = new Record(e.app.findCollectionByNameOrId("bezoeken"))
    b.set("user", e.record.id)
    e.app.save(b)
  } catch (err) {
    console.log("bezoek bijhouden mislukt", err)
  }
}, "users")

// Superadmin: per team hoe vaak de leden inlogden/de app openden en wanneer het laatst
routerAdd("GET", "/api/hockey/gebruik", (e) => {
  if (!e.auth || e.auth.collection().name !== "users" || !e.auth.getBool("superadmin")) throw new ForbiddenError("Alleen superadmins")
  const nu = Date.now(), dag = 24 * 3600 * 1000
  const tijd = (r) => new Date(r.getDateTime("created").string().replace(" ", "T")).getTime()
  const sinds = new Date(nu - 30 * dag).toISOString().replace("T", " ")
  const perUser = {}
  for (const b of e.app.findRecordsByFilter("bezoeken", "created > {:s}", "", 0, 0, { s: sinds })) {
    (perUser[b.getString("user")] = perUser[b.getString("user")] || []).push(tijd(b))
  }
  // Laatste ooit (ook ouder dan 30 dagen)
  const laatsteOoit = (id) => {
    const r = e.app.findRecordsByFilter("bezoeken", "user = {:u}", "-created", 1, 0, { u: id })
    return r.length ? tijd(r[0]) : 0
  }
  const naamVan = {}
  const teams = e.app.findRecordsByFilter("teams", "id != ''", "naam", 0, 0).map((t) => {
    const leden = [...new Set([...t.getStringSlice("beheerders"), ...t.getStringSlice("kijkers")])]
    let week = 0, maand = 0, laatst = 0, wie = ""
    for (const id of leden) {
      const ts = perUser[id] || []
      week += ts.filter((x) => x > nu - 7 * dag).length
      maand += ts.length
      const l = ts.length ? Math.max(...ts) : laatsteOoit(id)
      if (l > laatst) {
        laatst = l
        if (!(id in naamVan)) {
          try {
            const u = e.app.findRecordById("users", id)
            naamVan[id] = u.getBool("gast") ? "meekijklink" : (u.getString("name") || u.email())
          } catch (_) { naamVan[id] = "" }
        }
        wie = naamVan[id]
      }
    }
    return { id: t.id, naam: t.getString("naam"), leden: leden.length, week, maand, laatst: laatst ? new Date(laatst).toISOString() : null, wie }
  })
  teams.sort((a, b) => (b.laatst || "").localeCompare(a.laatst || ""))
  return e.json(200, { teams })
})

// Elke dag om 10:00 (NL-zomertijd): herinneringen en verlopen uitnodigingen/lege teams opruimen
cronAdd("uitnodigingen", "0 8 * * *", () => {
  require(`${__hooks}/hockey.js`).ruimUitnodigingenOp($app)
})

// Wat staat er in de uitnodiging (voor het welkomstscherm in de app)
routerAdd("GET", "/api/hockey/uitnodiging/{token}", (e) => {
  const h = require(`${__hooks}/hockey.js`)
  const inv = h.vindUitnodiging(e.app, e.request.pathValue("token"))
  const team = e.app.findRecordById("teams", inv.getString("team"))
  let bestaat = true
  try {
    e.app.findAuthRecordByEmail("users", inv.getString("email"))
  } catch (_) {
    bestaat = false
  }
  return e.json(200, { team: team.getString("naam"), email: inv.getString("email"), rol: inv.getString("rol"), naam: inv.getString("naam"), bestaat })
})

// Uitnodiging aannemen: nieuw account (met wachtwoord) of bestaand account aan het team toevoegen.
// Wie de link heeft, heeft de mail ontvangen: daarmee is het e-mailadres bevestigd
routerAdd("POST", "/api/hockey/uitnodiging/{token}", (e) => {
  const h = require(`${__hooks}/hockey.js`)
  const body = e.requestInfo().body
  const inv = h.vindUitnodiging(e.app, e.request.pathValue("token"))
  const email = inv.getString("email")
  let bestaat = true

  e.app.runInTransaction((tx) => {
    let user
    try {
      user = tx.findAuthRecordByEmail("users", email)
    } catch (_) {
      bestaat = false
      const wachtwoord = String(body.wachtwoord || "")
      if (wachtwoord.length < 8) throw new BadRequestError("Kies een wachtwoord van minstens 8 tekens")
      user = new Record(tx.findCollectionByNameOrId("users"))
      user.setEmail(email)
      user.setPassword(wachtwoord)
      user.setVerified(true)
      // Beheerders van hetzelfde team moeten het adres zien; wie het verder ziet bepaalt de listRule
      user.set("emailVisibility", true)
      user.set("name", String(body.naam || inv.getString("naam") || "").trim().slice(0, 60))
      tx.save(user)
    }
    // Kind(eren) uit een toegangsaanvraag: meteen als 'mijn kind' in dit team
    const leesJson = (r, veld, standaard) => {
      try { return JSON.parse(r.getString(veld) || "null") || standaard } catch (_) { return standaard }
    }
    const kinderen = leesJson(inv, "kinderen", [])
    if (Array.isArray(kinderen) && kinderen.length && !user.getBool("gast")) {
      const alle = leesJson(user, "kinderen", {})
      const teamId = inv.getString("team")
      alle[teamId] = [...new Set([...(alle[teamId] || []), ...kinderen])]
      user.set("kinderen", alle)
      tx.save(user)
    }
    const team = tx.findRecordById("teams", inv.getString("team"))
    for (const veld of Object.values(h.ROL_VELD)) {
      team.set(veld, team.getStringSlice(veld).filter((id) => id !== user.id))
    }
    const veld = h.ROL_VELD[inv.getString("rol")]
    team.set(veld, [...team.getStringSlice(veld), user.id])
    tx.save(team)
    tx.delete(inv)
  })

  return e.json(200, { email, bestaat })
})

// ── Nieuwe teams aanmelden (openbaar): meteen team + uitnodiging als beheerder; superadmins krijgen alleen bericht ──

routerAdd("POST", "/api/hockey/aanmelding", (e) => {
  const h = require(`${__hooks}/hockey.js`)
  const b = e.requestInfo().body
  const tekst = (v, max) => String(v || "").trim().slice(0, max)
  const teamnaam = tekst(b.teamnaam, 60)
  const naam = tekst(b.naam, 60)
  const email = tekst(b.email, 200).toLowerCase()
  const bericht = tekst(b.bericht, 1000)
  const terug = String(b.terug || "")
  if (!teamnaam) throw new BadRequestError("Vul de naam van het team in")
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new BadRequestError("Vul een geldig e-mailadres in")
  if (!h.TOEGESTAAN.includes(terug)) throw new BadRequestError("Onbekend terugadres")

  // Nogmaals op de knop gedrukt (zelfde adres en team, afgelopen week): niet opnieuw mailen
  const weekGeleden = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString().replace("T", " ")
  try {
    e.app.findFirstRecordByFilter("aanmeldingen", "email = {:email} && teamnaam = {:teamnaam} && created > {:sinds}", { email, teamnaam, sinds: weekGeleden })
    return e.json(200, { ok: true })
  } catch (_) {}

  // Superadmins en wie de vlag 'teamaanmeldingen' heeft (alleen ter informatie)
  const superadmins = e.app.findRecordsByFilter("users", "superadmin = true || teamaanmeldingen = true", "", 0, 0).map((u) => u.email())

  const a = new Record(e.app.findCollectionByNameOrId("aanmeldingen"))
  a.set("teamnaam", teamnaam)
  a.set("naam", naam)
  a.set("email", email)
  a.set("bericht", bericht)
  a.set("terug", terug)
  a.set("token", $security.randomString(40))
  a.set("status", "nieuw")
  e.app.save(a)

  // Meteen goedkeuren: team maken en de aanvrager als beheerder uitnodigen. Pas met de link uit die mail
  // kan een account worden gemaakt, dus daarmee is het e-mailadres bevestigd
  try {
    h.beslisAanmelding(e.app, a, "goed")
  } catch (err) {
    try { if (a.getString("team")) e.app.delete(e.app.findRecordById("teams", a.getString("team"))) } catch (_) {}
    try { e.app.delete(a) } catch (_) {}
    throw new BadRequestError("De aanmelding kon niet worden gemaild. Probeer het later nog eens.")
  }
  try {
    if (superadmins.length) h.mail(e.app, superadmins, "Nieuw team: " + teamnaam,
      "<p>Er is een nieuw team aangemaakt in de Hockey Wissel-app. De aanvrager heeft een uitnodiging als beheerder gekregen.</p>" +
      "<p><strong>Team:</strong> " + h.escape(teamnaam) + "<br><strong>Naam:</strong> " + h.escape(naam || "-") +
      "<br><strong>E-mail:</strong> " + h.escape(email) + "</p>" +
      (bericht ? "<p><strong>Bericht:</strong><br>" + h.escape(bericht).replace(/\n/g, "<br>") + "</p>" : ""))
  } catch (_) {}
  return e.json(200, { ok: true })
})

routerAdd("GET", "/api/hockey/aanmelding/{token}", (e) => {
  const h = require(`${__hooks}/hockey.js`)
  const a = h.vindAanmelding(e.app, e.request.pathValue("token"))
  return e.json(200, {
    teamnaam: a.getString("teamnaam"),
    naam: a.getString("naam"),
    email: a.getString("email"),
    bericht: a.getString("bericht"),
    status: a.getString("status"),
    created: a.getString("created"),
  })
})

// De link in de mail is het bewijs dat een superadmin dit doet. Openen (GET) verandert niets; pas de knop (POST) beslist
routerAdd("POST", "/api/hockey/aanmelding/{token}", (e) => {
  const h = require(`${__hooks}/hockey.js`)
  const b = e.requestInfo().body
  const a = h.vindAanmelding(e.app, e.request.pathValue("token"))
  if (a.getString("status") !== "nieuw") throw new BadRequestError("Deze aanmelding is al behandeld")
  return e.json(200, { status: h.beslisAanmelding(e.app, a, b.besluit, b.teamnaam) })
})

// Hetzelfde vanuit de app (Instellingen → Aanvragen): alleen voor een ingelogde superadmin of wie de vlag 'teamaanmeldingen' heeft
routerAdd("POST", "/api/hockey/aanmelding-id/{id}", (e) => {
  const h = require(`${__hooks}/hockey.js`)
  if (!e.auth || e.auth.collection().name !== "users" || !(e.auth.getBool("superadmin") || e.auth.getBool("teamaanmeldingen"))) throw new ForbiddenError("Alleen superadmins")
  const b = e.requestInfo().body
  const a = e.app.findRecordById("aanmeldingen", e.request.pathValue("id"))
  if (a.getString("status") !== "nieuw") throw new BadRequestError("Deze aanmelding is al behandeld")
  return e.json(200, { status: h.beslisAanmelding(e.app, a, b.besluit, b.teamnaam) })
})

// ── Foutmeldingen uit de app ──
routerAdd("POST", "/api/hockey/fout", (e) => {
  const b = e.requestInfo().body
  const tekst = (v, max) => String(v == null ? "" : v).slice(0, max)
  const r = new Record(e.app.findCollectionByNameOrId("foutmeldingen"))
  r.set("soort", tekst(b.soort, 30))
  r.set("bericht", tekst(b.bericht, 1000))
  r.set("stack", tekst(b.stack, 4000))
  // Alleen het pad: geen #tokens of ?-parameters bewaren
  r.set("adres", tekst(b.adres, 300).split("#")[0].split("?")[0])
  r.set("versie", tekst(b.versie, 100))
  r.set("agent", tekst(e.request.header.get("User-Agent"), 300))
  r.set("gebruiker", e.auth ? e.auth.id : "")
  e.app.save(r)
  // Oude meldingen opruimen: alleen de laatste 1000 bewaren
  try {
    const oud = e.app.findRecordsByFilter("foutmeldingen", "", "-created", 100, 1000)
    for (const o of oud) e.app.delete(o)
  } catch (_) {}
  return e.json(200, { ok: true })
})

// ── Meekijklink: maken (elk lid, als er nog geen is) of vernieuwen (beheerder/superadmin) ──
routerAdd("POST", "/api/hockey/kijklink/{team}", (e) => {
  if (!e.auth || e.auth.collection().name !== "users") throw new UnauthorizedError("Log eerst in")
  const b = e.requestInfo().body
  const team = e.app.findRecordById("teams", e.request.pathValue("team"))
  const id = e.auth.id
  const beheert = e.auth.getBool("superadmin") || team.getStringSlice("beheerders").includes(id)
  const lid = beheert || team.getStringSlice("kijkers").includes(id)
  if (!lid) throw new ForbiddenError("Je zit niet in dit team")

  const email = "kijk-" + team.id + "@meekijken.invalid"
  // Een link werkt alleen zolang de gast nog kijker is (een beheerder kan hem bij Leden uit het team halen)
  let werkt = false
  try {
    werkt = !!team.getString("kijklink") && team.getStringSlice("kijkers").includes(e.app.findAuthRecordByEmail("users", email).id)
  } catch (_) {}
  if (werkt && !b.vernieuw) return e.json(200, { token: team.getString("kijklink") })
  if (werkt && !beheert) throw new ForbiddenError("Alleen een beheerder kan een nieuwe link maken")

  const token = $security.randomString(32)
  e.app.runInTransaction((tx) => {
    let gast
    try {
      gast = tx.findAuthRecordByEmail("users", email)
    } catch (_) {
      gast = new Record(tx.findCollectionByNameOrId("users"))
      gast.setEmail(email)
      gast.setVerified(true)
      gast.set("gast", true)
      gast.set("name", "Meekijklink")
    }
    // Nieuw wachtwoord: oude links en ingelogde meekijkers vervallen
    gast.setPassword(token)
    tx.save(gast)
    const t = tx.findRecordById("teams", team.id)
    if (!t.getStringSlice("kijkers").includes(gast.id)) t.set("kijkers", [...t.getStringSlice("kijkers"), gast.id])
    t.set("kijklink", token)
    tx.save(t)
  })
  return e.json(200, { token })
})

// ── Toegang aanvragen door ouders via de aanmeldlink van het team ──

// Aanmeldlink maken of vernieuwen (beheerders)
routerAdd("POST", "/api/hockey/aanvraaglink/{team}", (e) => {
  if (!e.auth || e.auth.collection().name !== "users") throw new UnauthorizedError("Log eerst in")
  const b = e.requestInfo().body
  const team = e.app.findRecordById("teams", e.request.pathValue("team"))
  if (!e.auth.getBool("superadmin") && !team.getStringSlice("beheerders").includes(e.auth.id)) throw new ForbiddenError("Alleen beheerders")
  if (team.getString("aanvraaglink") && !b.vernieuw) return e.json(200, { token: team.getString("aanvraaglink") })
  const token = $security.randomString(24)
  team.set("aanvraaglink", token)
  e.app.save(team)
  return e.json(200, { token })
})

// Formulier openen: teamnaam en de spelers (voornamen) om je kind te kiezen
routerAdd("GET", "/api/hockey/aanvraag/{waarde}", (e) => {
  const h = require(`${__hooks}/hockey.js`)
  const team = h.vindTeamMetAanvraaglink(e.app, e.request.pathValue("waarde"))
  const spelers = e.app.findRecordsByFilter("spelers", "team = {:team}", "naam", 0, 0, { team: team.id }).map((s) => ({ id: s.id, naam: s.getString("naam") }))
  return e.json(200, { team: team.getString("naam"), spelers })
})

// Aanvraag versturen: meteen als kijker uitnodigen, beheerders krijgen bericht
routerAdd("POST", "/api/hockey/aanvraag/{waarde}", (e) => {
  const h = require(`${__hooks}/hockey.js`)
  const team = h.vindTeamMetAanvraaglink(e.app, e.request.pathValue("waarde"))
  const b = e.requestInfo().body
  const tekst = (v, max) => String(v || "").trim().replace(/\s+/g, " ").slice(0, max)
  const naam = tekst(b.naam, 60)
  const email = tekst(b.email, 200).toLowerCase()
  const terug = String(b.terug || "")
  if (!naam) throw new BadRequestError("Vul je voornaam in")
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new BadRequestError("Vul een geldig e-mailadres in")
  if (!h.TOEGESTAAN.includes(terug)) throw new BadRequestError("Onbekend terugadres")
  let kindId = "", kindNaam = tekst(b.kindNaam, 60)
  if (b.kindId) {
    try {
      const s = e.app.findRecordById("spelers", String(b.kindId))
      if (s.getString("team") === team.id) { kindId = s.id; kindNaam = s.getString("naam") }
    } catch (_) {}
  }
  if (!kindNaam) throw new BadRequestError("Kies of vul de naam van je kind in")

  // Nogmaals verstuurd (afgelopen week): geen tweede mail
  const weekGeleden = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString().replace("T", " ")
  try {
    e.app.findFirstRecordByFilter("toegangsaanvragen", "team = {:team} && email = {:email} && created > {:sinds}", { team: team.id, email, sinds: weekGeleden })
    return e.json(200, { ok: true })
  } catch (_) {}

  const a = new Record(e.app.findCollectionByNameOrId("toegangsaanvragen"))
  a.set("team", team.id)
  a.set("naam", naam)
  a.set("email", email)
  a.set("kindId", kindId)
  a.set("kindNaam", kindNaam)
  a.set("terug", terug)
  a.set("token", $security.randomString(40))
  a.set("status", "nieuw")
  e.app.save(a)

  // Meteen toelaten als kijker: de uitnodiging gaat naar het opgegeven adres, dus wie een account maakt heeft
  // dat adres bevestigd. Beheerder maken kan alleen een beheerder (Leden)
  try {
    h.beslisAanvraag(e.app, a, "kijker", "")
  } catch (err) {
    try { e.app.delete(a) } catch (_) {}
    throw new BadRequestError("De aanvraag kon niet worden gemaild. Probeer het later nog eens.")
  }
  try {
    h.mail(e.app, h.beheerderEmails(e.app, team), "Nieuwe kijker bij " + team.getString("naam") + ": " + naam,
      "<p><strong>" + h.escape(naam) + "</strong> (ouder van <strong>" + h.escape(kindNaam) + "</strong>) heeft zich aangemeld voor <strong>" +
      h.escape(team.getString("naam")) + "</strong> en krijgt een uitnodiging als kijker.</p><p>E-mail: " + h.escape(email) + "</p>" +
      "<p>Klopt dit niet, haal deze persoon dan weg in de app bij Instellingen → Leden. Daar kun je iemand ook beheerder maken.</p>")
  } catch (_) {}
  return e.json(200, { ok: true })
})

// Beheerder opent de link uit de mail (de link zelf geeft het recht om te beslissen)
routerAdd("GET", "/api/hockey/toegang/{token}", (e) => {
  const h = require(`${__hooks}/hockey.js`)
  let a
  try { a = e.app.findFirstRecordByData("toegangsaanvragen", "token", e.request.pathValue("token")) } catch (_) { throw new NotFoundError("Aanvraag niet gevonden") }
  return e.json(200, h.aanvraagInfo(e.app, a))
})

routerAdd("POST", "/api/hockey/toegang/{token}", (e) => {
  const h = require(`${__hooks}/hockey.js`)
  let a
  try { a = e.app.findFirstRecordByData("toegangsaanvragen", "token", e.request.pathValue("token")) } catch (_) { throw new NotFoundError("Aanvraag niet gevonden") }
  const status = h.beslisAanvraag(e.app, a, e.requestInfo().body.besluit, e.auth ? e.auth.id : "")
  return e.json(200, { status })
})

// Vanuit de app (Leden): alleen beheerders van dat team
routerAdd("POST", "/api/hockey/toegang-id/{id}", (e) => {
  const h = require(`${__hooks}/hockey.js`)
  if (!e.auth || e.auth.collection().name !== "users") throw new UnauthorizedError("Log eerst in")
  const a = e.app.findRecordById("toegangsaanvragen", e.request.pathValue("id"))
  const team = e.app.findRecordById("teams", a.getString("team"))
  if (!e.auth.getBool("superadmin") && !team.getStringSlice("beheerders").includes(e.auth.id)) throw new ForbiddenError("Alleen beheerders")
  const status = h.beslisAanvraag(e.app, a, e.requestInfo().body.besluit, e.auth.id)
  return e.json(200, { status })
})
