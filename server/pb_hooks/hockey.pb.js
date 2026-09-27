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
  return e.json(200, { team: team.getString("naam"), email: inv.getString("email"), rol: inv.getString("rol"), bestaat })
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
      user.set("name", String(body.naam || "").trim().slice(0, 60))
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
  const email = a.getString("email")
  const teamnaam = String(b.teamnaam || a.getString("teamnaam")).trim().slice(0, 60)

  if (b.besluit === "goed") {
    e.app.runInTransaction((tx) => {
      const team = new Record(tx.findCollectionByNameOrId("teams"))
      team.set("naam", teamnaam)
      tx.save(team)
      a.set("status", "goedgekeurd")
      a.set("teamnaam", teamnaam)
      a.set("team", team.id)
      tx.save(a)
    })
    h.nodigUit(e.app, a.getString("team"), email, "beheerder", a.getString("terug"), "")
    return e.json(200, { status: "goedgekeurd" })
  }
  if (b.besluit === "af") {
    a.set("status", "afgewezen")
    e.app.save(a)
    try {
      h.mail(e.app, [email], "Aanmelding " + a.getString("teamnaam"),
        "<p>Hallo,</p><p>Je aanmelding voor <strong>" + h.escape(a.getString("teamnaam")) + "</strong> is helaas niet goedgekeurd.</p>")
    } catch (_) {}
    return e.json(200, { status: "afgewezen" })
  }
  throw new BadRequestError("Kies goedkeuren of afwijzen")
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
