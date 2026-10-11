/// <reference path="../pb_data/types.d.ts" />

// Mail via hockey@juliaan.eu: instellingen uit server/.env, wachtwoord alleen in het geheugen
onBootstrap((e) => {
  e.next()
  require(`${__hooks}/hockey.js`).mailInstellen(e.app)
})

onSettingsReload((e) => {
  e.next()
  require(`${__hooks}/hockey.js`).mailInGeheugen(e.app)
})

// Opslaan in het beheerscherm: het wachtwoord uit de omgeving niet mee de database in schrijven
onSettingsUpdateRequest((e) => {
  if ($os.getenv("SMTP_PASS")) e.newSettings.smtp.password = ""
  e.next()
})

// Elke mail van de server (ook wachtwoord vergeten) telt mee voor de limiet per uur
onMailerSend((e) => {
  require(`${__hooks}/hockey.js`).telMail(e.app)
  e.next()
})

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

// Inloggen of de app openen (inlog verversen): bijhouden voor 'Gebruik per team' (superadmin), met het toestel-id
// dat de app meestuurt. Zelfde gebruiker op hetzelfde toestel binnen 10 minuten telt niet opnieuw
onRecordAuthRequest((e) => {
  e.next()
  try {
    let toestel = ""
    try { toestel = String(e.requestInfo().body.toestel || "").replace(/[^a-z0-9]/gi, "").slice(0, 40) } catch (_) {}
    const sinds = new Date(Date.now() - 10 * 60 * 1000).toISOString().replace("T", " ")
    if (e.app.findRecordsByFilter("bezoeken", "user = {:u} && toestel = {:t} && created > {:s}", "", 1, 0, { u: e.record.id, t: toestel, s: sinds }).length) return
    const b = new Record(e.app.findCollectionByNameOrId("bezoeken"))
    b.set("user", e.record.id)
    b.set("toestel", toestel)
    e.app.save(b)
  } catch (err) {
    console.log("bezoek bijhouden mislukt", err)
  }
}, "users")

// Superadmin: per team deze week de actieve leden (met account) en de toestellen via de meekijklink, en de laatste keer
routerAdd("GET", "/api/hockey/gebruik", (e) => {
  if (!e.auth || e.auth.collection().name !== "users" || !e.auth.getBool("superadmin")) throw new ForbiddenError("Alleen superadmins")
  const tijd = (r) => new Date(r.getDateTime("created").string().replace(" ", "T")).getTime()
  const sinds = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString().replace("T", " ")
  const dezeWeek = {} // user -> Set(toestel)
  for (const b of e.app.findRecordsByFilter("bezoeken", "created > {:s}", "", 0, 0, { s: sinds })) {
    (dezeWeek[b.getString("user")] = dezeWeek[b.getString("user")] || new Set()).add(b.getString("toestel"))
  }
  const users = {}
  const user = (id) => {
    if (!(id in users)) { try { users[id] = e.app.findRecordById("users", id) } catch (_) { users[id] = null } }
    return users[id]
  }
  const laatsteVan = (id) => {
    const r = e.app.findRecordsByFilter("bezoeken", "user = {:u}", "-created", 1, 0, { u: id })
    return r.length ? tijd(r[0]) : 0
  }
  const teams = e.app.findRecordsByFilter("teams", "id != ''", "naam", 0, 0).map((t) => {
    const leden = [...new Set([...t.getStringSlice("beheerders"), ...t.getStringSlice("kijkers")])].filter((id) => user(id))
    const gewoon = leden.filter((id) => !user(id).getBool("gast"))
    const gasten = leden.filter((id) => user(id).getBool("gast"))
    let laatst = 0, wie = ""
    for (const id of leden) {
      const l = laatsteVan(id)
      if (l > laatst) { laatst = l; wie = user(id).getBool("gast") ? "meekijklink" : (user(id).getString("name") || user(id).email()) }
    }
    const toestellen = new Set()
    for (const id of gasten) for (const x of (dezeWeek[id] || [])) toestellen.add(x)
    return {
      id: t.id, naam: t.getString("naam"),
      leden: gewoon.length,
      actief: gewoon.filter((id) => dezeWeek[id]).length,
      meekijklink: gasten.length > 0,
      meekijkers: toestellen.size,
      laatst: laatst ? new Date(laatst).toISOString() : null, wie,
    }
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
  let inv = h.vindUitnodiging(e.app, e.request.pathValue("token"))
  const email = inv.getString("email")
  let bestaat = true

  e.app.runInTransaction((tx) => {
    inv = tx.findRecordById("uitnodigingen", inv.id)
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
    if (!team.getStringSlice("beheerders").length && team.original().getStringSlice("beheerders").length) throw new BadRequestError("De laatste beheerder kan geen kijker worden; wijs eerst een andere beheerder aan")
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
  let officieel
  if (b.officieelTeam) officieel = e.app.findRecordById("catalogus_teams", String(b.officieelTeam))
  if (!officieel) throw new BadRequestError("Kies je club, seizoen en team")
  const omgevingNaam = tekst(b.omgevingNaam, 40)
  const teamnaam = (officieel.getString("naam") + " · " + officieel.getString("seizoen") + (omgevingNaam ? " · " + omgevingNaam : "")).slice(0, 60)
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
  a.set("officieelTeam", officieel.id)
  a.set("omgevingNaam", omgevingNaam)
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
routerAdd("POST", "/api/hockey/kijklink/{team}", () => {
  throw new BadRequestError("Gebruik de aanmeldlink; meekijken vereist goedkeuring van de beheerder.")
})

routerAdd("POST", "/api/hockey/aanvraaglink/{team}", (e) => {
  if (!e.auth || e.auth.collection().name !== "users" || e.auth.getBool("gast")) throw new UnauthorizedError("Log eerst in")
  const b = e.requestInfo().body
  const team = e.app.findRecordById("teams", e.request.pathValue("team"))
  const beheerder = e.auth.getBool("superadmin") || team.getStringSlice("beheerders").includes(e.auth.id)
  if (!beheerder && !team.getStringSlice("kijkers").includes(e.auth.id)) throw new ForbiddenError("Alleen leden van dit team")
  if (team.getString("aanvraaglink") && !b.vernieuw) return e.json(200, { token: team.getString("aanvraaglink") })
  if (!beheerder) throw new ForbiddenError("Vraag de beheerder eerst om een aanmeldlink")
  const token = $security.randomString(32)
  team.set("aanvraaglink", token)
  e.app.save(team)
  return e.json(200, { token })
})

// Publiek formulier: uitsluitend de omgevingsnaam, nooit spelers of leden.
routerAdd("GET", "/api/hockey/aanvraag/{waarde}", (e) => {
  const h = require(`${__hooks}/hockey.js`)
  const team = h.vindTeamMetAanvraaglink(e.app, e.request.pathValue("waarde"))
  return e.json(200, { team: team.getString("naam") })
})
routerAdd("POST", "/api/hockey/aanvraag/{waarde}", (e) => {
  const h = require(`${__hooks}/hockey.js`)
  const team = h.vindTeamMetAanvraaglink(e.app, e.request.pathValue("waarde"))
  return e.json(200, h.maakAanvraag(e.app, team, e.requestInfo().body))
})

// Een maillink wijst de aanvraag aan; de huidige beheerrol geeft het beslisrecht.
routerAdd("GET", "/api/hockey/toegang/{token}", (e) => {
  const h = require(`${__hooks}/hockey.js`)
  const a = e.app.findFirstRecordByData("toegangsaanvragen", "token", e.request.pathValue("token"))
  const team = e.app.findRecordById("teams", a.getString("team"))
  if (!e.auth || e.auth.collection().name !== "users" || (!e.auth.getBool("superadmin") && !team.getStringSlice("beheerders").includes(e.auth.id))) throw new ForbiddenError("Log in als beheerder van dit team")
  return e.json(200, h.aanvraagInfo(e.app, a))
})
routerAdd("POST", "/api/hockey/toegang/{token}", (e) => {
  const h = require(`${__hooks}/hockey.js`)
  const a = e.app.findFirstRecordByData("toegangsaanvragen", "token", e.request.pathValue("token"))
  const team = e.app.findRecordById("teams", a.getString("team"))
  if (!e.auth || e.auth.collection().name !== "users" || (!e.auth.getBool("superadmin") && !team.getStringSlice("beheerders").includes(e.auth.id))) throw new ForbiddenError("Log in als beheerder van dit team")
  return e.json(200, { status: h.beslisAanvraag(e.app, a, e.requestInfo().body.besluit, e.auth.id) })
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
