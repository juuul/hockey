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

// ── Nieuwe teams aanmelden (openbaar) en goedkeuren door een superadmin via de link in de mail ──

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

  // Nogmaals op de knop gedrukt: niet opnieuw mailen
  try {
    e.app.findFirstRecordByFilter("aanmeldingen", "email = {:email} && teamnaam = {:teamnaam} && status = 'nieuw'", { email, teamnaam })
    return e.json(200, { ok: true })
  } catch (_) {}

  const superadmins = e.app.findRecordsByFilter("users", "superadmin = true", "", 0, 0).map((u) => u.email())
  if (!superadmins.length) throw new BadRequestError("Aanmelden kan nu niet")

  const a = new Record(e.app.findCollectionByNameOrId("aanmeldingen"))
  a.set("teamnaam", teamnaam)
  a.set("naam", naam)
  a.set("email", email)
  a.set("bericht", bericht)
  a.set("terug", terug)
  a.set("token", $security.randomString(40))
  a.set("status", "nieuw")
  e.app.save(a)

  const link = terug + "#aanmelding=" + a.getString("token")
  try {
    h.mail(e.app, superadmins, "Nieuwe teamaanmelding: " + teamnaam,
      "<p>Er is een nieuw team aangemeld voor de Hockey Wissel-app.</p>" +
      "<p><strong>Team:</strong> " + h.escape(teamnaam) + "<br><strong>Naam:</strong> " + h.escape(naam || "-") +
      "<br><strong>E-mail:</strong> " + h.escape(email) + "</p>" +
      (bericht ? "<p><strong>Bericht:</strong><br>" + h.escape(bericht).replace(/\n/g, "<br>") + "</p>" : "") +
      "<p><a href=\"" + h.escape(link) + "\">Aanmelding bekijken en goedkeuren of afwijzen</a></p>" +
      "<p>Deze link blijft geldig tot de aanmelding is behandeld.</p>")
    h.mail(e.app, [email], "Aanmelding ontvangen: " + teamnaam,
      "<p>Hallo" + (naam ? " " + h.escape(naam) : "") + ",</p>" +
      "<p>We hebben je aanmelding voor <strong>" + h.escape(teamnaam) + "</strong> ontvangen. " +
      "Zodra die is goedgekeurd, krijg je een mail met een link om je account te maken.</p>")
  } catch (err) {
    e.app.delete(a)
    throw new BadRequestError("De aanmelding kon niet worden gemaild. Probeer het later nog eens.")
  }
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

// Hetzelfde vanuit de app (Instellingen → Aanvragen): alleen voor een ingelogde superadmin
routerAdd("POST", "/api/hockey/aanmelding-id/{id}", (e) => {
  const h = require(`${__hooks}/hockey.js`)
  if (!e.auth || e.auth.collection().name !== "users" || !e.auth.getBool("superadmin")) throw new ForbiddenError("Alleen superadmins")
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

// Aanvraag versturen: bewaren en alle beheerders mailen
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

  // Nogmaals verstuurd: geen tweede mail
  try {
    e.app.findFirstRecordByFilter("toegangsaanvragen", "team = {:team} && email = {:email} && status = 'nieuw'", { team: team.id, email })
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

  const link = terug + "#toegang=" + a.getString("token")
  try {
    h.mail(e.app, h.beheerderEmails(e.app, team), "Toegang gevraagd voor " + team.getString("naam") + ": " + naam,
      "<p><strong>" + h.escape(naam) + "</strong> (ouder van <strong>" + h.escape(kindNaam) + "</strong>) vraagt toegang tot <strong>" +
      h.escape(team.getString("naam")) + "</strong> in de Hockey Wissel-app.</p><p>E-mail: " + h.escape(email) + "</p>" +
      "<p><a href=\"" + h.escape(link) + "\">Aanvraag bekijken en toelaten of afwijzen</a></p>" +
      "<p>Je vindt open aanvragen ook in de app bij Instellingen → Leden.</p>")
  } catch (err) {
    e.app.delete(a)
    throw new BadRequestError("De aanvraag kon niet worden gemaild. Probeer het later nog eens.")
  }
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
