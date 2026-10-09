// Gedeelde functies voor de hooks (handlers draaien los van elkaar, dus alles via require)

const ROL_VELD = { beheerder: "beheerders", kijker: "kijkers" }

// Alleen links terug naar onze eigen app
const TOEGESTAAN = [
  "https://hockey.juliaan.eu/",
  "https://hockey.juliaan.eu/test/",
  "https://juliaan.eu/hockey/",
  "https://juliaan.eu/hockey/test/",
  "http://192.168.2.50:5173/",
  "http://localhost:5173/",
]

const GELDIG_DAGEN = 7

function vindUitnodiging(app, token) {
  if (!token || token.length < 30) throw new NotFoundError("Uitnodiging niet gevonden")
  let inv
  try {
    inv = app.findFirstRecordByData("uitnodigingen", "token", token)
  } catch (_) {
    throw new NotFoundError("Uitnodiging niet gevonden of al gebruikt")
  }
  const leeftijd = Date.now() - new Date(inv.getDateTime("created").string().replace(" ", "T")).getTime()
  if (leeftijd > GELDIG_DAGEN * 24 * 3600 * 1000) throw new BadRequestError("Deze uitnodiging is verlopen. Vraag een nieuwe aan.")
  return inv
}

function escape(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]))
}

function stuurUitnodiging(app, inv, herinnering) {
  const team = app.findRecordById("teams", inv.getString("team"))
  const link = inv.getString("terug") + "#uitnodiging=" + inv.getString("token")
  const rolTekst = { beheerder: "beheerder (mag alles bijhouden en regelen)", kijker: "kijker (kijkt mee)" }[inv.getString("rol")]
  const meta = app.settings().meta
  const msg = new MailerMessage({
    from: { address: meta.senderAddress, name: meta.senderName },
    to: [{ address: inv.getString("email") }],
    subject: (herinnering ? "Herinnering: uitnodiging voor " : "Uitnodiging voor ") + team.getString("naam") + " in de Hockey Wissel-app",
    html:
      "<p>Hallo,</p>" +
      (herinnering ? "<p>Je hebt je uitnodiging nog niet aangenomen.</p>" : "") +
      "<p>Je bent uitgenodigd voor <strong>" + escape(team.getString("naam")) + "</strong> als " + escape(rolTekst) + ".</p>" +
      "<p><a href=\"" + escape(link) + "\">Uitnodiging openen</a></p>" +
      (herinnering ? "<p>De link werkt nog een paar dagen; daarna vervalt de uitnodiging" + (inv.getString("rol") === "beheerder" ? " en wordt een nieuw, leeg team verwijderd" : "") + ".</p>" : "<p>De link is " + GELDIG_DAGEN + " dagen geldig.</p>"),
  })
  app.newMailClient().send(msg)
}

// Mail gaat via hockey@juliaan.eu (Vimexx). Alles komt uit de omgeving (server/.env); het wachtwoord staat alleen
// in het geheugen, niet in de database
const MAIL_DOMEIN = "@juliaan.eu" // anders faalt DMARC (p=reject)
const MAIL_PER_UUR = 150 // Vimexx staat 200 per uur toe

function mailConfig() {
  const from = $os.getenv("MAIL_FROM").trim().replace(/^(["'])(.*)\1$/, "$2") // aanhalingstekens mogen
  const m = from.match(/^(.*?)\s*<([^>]+)>$/)
  return {
    host: $os.getenv("SMTP_HOST").trim(),
    port: parseInt($os.getenv("SMTP_PORT") || "465", 10),
    user: $os.getenv("SMTP_USER").trim(),
    pass: $os.getenv("SMTP_PASS"),
    naam: m ? m[1].replace(/^"|"$/g, "").trim() : "",
    adres: (m ? m[2] : from).trim(),
  }
}

function mailFout(cfg) {
  const leeg = ["SMTP_HOST", "SMTP_USER", "SMTP_PASS", "MAIL_FROM"].filter((k) => !$os.getenv(k))
  if (leeg.length) return leeg.join(", ") + " ontbreekt in server/.env"
  if (!cfg.adres.toLowerCase().endsWith(MAIL_DOMEIN)) return "MAIL_FROM moet een " + MAIL_DOMEIN + "-adres zijn (DMARC)"
  if (cfg.port !== 465 && cfg.port !== 587) return "SMTP_PORT moet 465 of 587 zijn"
  return ""
}

// Mailinstellingen in de instellingen zetten: 465 = SSL/TLS, 587 = STARTTLS
function zetMail(settings, cfg, metWachtwoord) {
  settings.smtp.enabled = true
  settings.smtp.host = cfg.host
  settings.smtp.port = cfg.port
  settings.smtp.username = cfg.user
  settings.smtp.password = metWachtwoord ? cfg.pass : ""
  settings.smtp.tls = cfg.port === 465
  settings.smtp.authMethod = "PLAIN"
  settings.meta.senderAddress = cfg.adres
  settings.meta.senderName = cfg.naam
}

// Bij het starten: alles behalve het wachtwoord opslaan (zodat het beheerscherm klopt en het oude Gmail-wachtwoord
// weg is), daarna het wachtwoord alleen in het geheugen
function mailInstellen(app) {
  const cfg = mailConfig()
  const fout = mailFout(cfg)
  if (fout) {
    console.log("MAIL NIET INGESTELD: " + fout)
    return
  }
  const s = app.settings()
  if (s.smtp.host !== cfg.host || s.smtp.port !== cfg.port || s.smtp.username !== cfg.user || s.smtp.password !== "" ||
      s.smtp.tls !== (cfg.port === 465) || !s.smtp.enabled || s.meta.senderAddress !== cfg.adres || s.meta.senderName !== cfg.naam) {
    zetMail(s, cfg, false)
    app.save(s)
  }
  mailInGeheugen(app)
  console.log("Mail via " + cfg.host + ":" + cfg.port + " als " + cfg.naam + " <" + cfg.adres + ">")
}

// Na elk herladen van de instellingen (ook na opslaan in het beheerscherm) het wachtwoord weer uit de omgeving
function mailInGeheugen(app) {
  const cfg = mailConfig()
  if (!mailFout(cfg)) zetMail(app.settings(), cfg, true)
}

// Maximaal MAIL_PER_UUR mails per (glijdend) uur, over alle mails van de server heen
function telMail(app) {
  const nu = Date.now()
  let tijden = []
  try { tijden = JSON.parse(app.store().get("hockey_mailtijden") || "[]") } catch (_) {}
  tijden = tijden.filter((t) => nu - t < 3600 * 1000)
  if (tijden.length >= MAIL_PER_UUR) {
    console.log("MAIL NIET VERSTUURD: limiet van " + MAIL_PER_UUR + " per uur bereikt")
    throw new BadRequestError("Er zijn het afgelopen uur te veel mails verstuurd. Probeer het later opnieuw.")
  }
  tijden.push(nu)
  app.store().set("hockey_mailtijden", JSON.stringify(tijden))
}

function mail(app, aan, onderwerp, html) {
  const meta = app.settings().meta
  app.newMailClient().send(new MailerMessage({
    from: { address: meta.senderAddress, name: meta.senderName },
    to: aan.map((a) => ({ address: a })),
    subject: onderwerp,
    html: html,
  }))
}

// Uitnodiging als beheerder aanmaken en mailen (zelfde als via de app, maar vanuit de server)
function nodigUit(app, teamId, email, rol, terug, makerId, naam, kinderen) {
  const inv = new Record(app.findCollectionByNameOrId("uitnodigingen"))
  inv.set("team", teamId)
  inv.set("email", email)
  inv.set("rol", rol)
  inv.set("terug", terug)
  inv.set("token", $security.randomString(40))
  inv.set("maker", makerId || "")
  inv.set("naam", naam || "")
  inv.set("kinderen", kinderen || [])
  app.save(inv)
  stuurUitnodiging(app, inv)
}

// E-mailadressen van de beheerders van een team (geen meekijklink-gasten); zonder beheerders: de superadmins
function beheerderEmails(app, team) {
  const uit = []
  for (const id of team.getStringSlice("beheerders")) {
    try {
      const u = app.findRecordById("users", id)
      if (!u.getBool("gast")) uit.push(u.email())
    } catch (_) {}
  }
  if (uit.length) return uit
  return app.findRecordsByFilter("users", "superadmin = true", "", 0, 0).map((u) => u.email())
}

// Aanmeldlink van een team: '<teamId>.<token>'
function vindTeamMetAanvraaglink(app, waarde) {
  const punt = String(waarde || "").indexOf(".")
  if (punt < 1) throw new NotFoundError("Deze link werkt niet (meer)")
  let team
  try {
    team = app.findRecordById("teams", waarde.slice(0, punt))
  } catch (_) {
    throw new NotFoundError("Deze link werkt niet (meer)")
  }
  const token = waarde.slice(punt + 1)
  if (!team.getString("aanvraaglink") || team.getString("aanvraaglink") !== token) throw new NotFoundError("Deze link werkt niet (meer). Vraag de beheerder om een nieuwe.")
  return team
}

// Een toegangsaanvraag toelaten (als kijker of beheerder) of afwijzen
function beslisAanvraag(app, a, besluit, makerId) {
  if (a.getString("status") !== "nieuw") throw new BadRequestError("Deze aanvraag is al behandeld")
  if (besluit === "kijker" || besluit === "beheerder") {
    const kind = a.getString("kindId")
    nodigUit(app, a.getString("team"), a.getString("email"), besluit, a.getString("terug"), makerId, a.getString("naam"), kind ? [kind] : [])
    a.set("status", "toegelaten")
    app.save(a)
    return "toegelaten"
  }
  if (besluit === "af") {
    a.set("status", "afgewezen")
    app.save(a)
    try {
      const team = app.findRecordById("teams", a.getString("team"))
      mail(app, [a.getString("email")], "Aanvraag " + team.getString("naam"),
        "<p>Hallo " + escape(a.getString("naam")) + ",</p><p>Je aanvraag voor <strong>" + escape(team.getString("naam")) + "</strong> in de Hockey Wissel-app is niet goedgekeurd. Vraag bij twijfel de trainer of teammanager.</p>")
    } catch (_) {}
    return "afgewezen"
  }
  throw new BadRequestError("Kies toelaten of afwijzen")
}

function aanvraagInfo(app, a) {
  const team = app.findRecordById("teams", a.getString("team"))
  return { team: team.getString("naam"), naam: a.getString("naam"), email: a.getString("email"), kind: a.getString("kindNaam"), status: a.getString("status"), created: a.getString("created") }
}

function vindAanmelding(app, token) {
  if (!token || token.length < 30) throw new NotFoundError("Aanmelding niet gevonden")
  try {
    return app.findFirstRecordByData("aanmeldingen", "token", token)
  } catch (_) {
    throw new NotFoundError("Aanmelding niet gevonden")
  }
}

// Teamaanmelding goedkeuren (team maken + aanvrager uitnodigen als beheerder) of afwijzen (mail naar de aanvrager)
function beslisAanmelding(app, a, besluit, teamnaamIn) {
  const email = a.getString("email")
  const teamnaam = String(teamnaamIn || a.getString("teamnaam")).trim().slice(0, 60)

  if (besluit === "goed") {
    app.runInTransaction((tx) => {
      const team = new Record(tx.findCollectionByNameOrId("teams"))
      team.set("naam", teamnaam)
      tx.save(team)
      a.set("status", "goedgekeurd")
      a.set("teamnaam", teamnaam)
      a.set("team", team.id)
      tx.save(a)
    })
    nodigUit(app, a.getString("team"), email, "beheerder", a.getString("terug"), "", a.getString("naam"))
    return "goedgekeurd"
  }
  if (besluit === "af") {
    a.set("status", "afgewezen")
    app.save(a)
    try {
      mail(app, [email], "Aanmelding " + a.getString("teamnaam"),
        "<p>Hallo,</p><p>Je aanmelding voor <strong>" + escape(a.getString("teamnaam")) + "</strong> is helaas niet goedgekeurd.</p>")
    } catch (_) {}
    return "afgewezen"
  }
  throw new BadRequestError("Kies goedkeuren of afwijzen")
}

// Dagelijks: na 3 dagen een herinnering, na 7 dagen de uitnodiging weg. Een team uit een teamaanmelding dat dan
// nog helemaal leeg is (geen leden, spelers, wedstrijden, programma) wordt ook verwijderd
const HERINNER_DAGEN = 3

function ruimUitnodigingenOp(app) {
  const dag = 24 * 3600 * 1000
  // Bezoeken ouder dan 180 dagen
  try {
    const grens = new Date(Date.now() - 180 * dag).toISOString().replace("T", " ")
    for (const b of app.findRecordsByFilter("bezoeken", "created < {:g}", "", 0, 0, { g: grens })) app.delete(b)
  } catch (_) {}
  const leeftijd = (r) => Date.now() - new Date(r.getDateTime("created").string().replace(" ", "T")).getTime()
  const teVerwijderen = new Set()
  for (const inv of app.findRecordsByFilter("uitnodigingen", "id != ''", "", 0, 0)) {
    const oud = leeftijd(inv)
    if (oud > GELDIG_DAGEN * dag) {
      teVerwijderen.add(inv.getString("team"))
      app.delete(inv)
    } else if (oud > HERINNER_DAGEN * dag && !inv.getBool("herinnerd")) {
      try {
        stuurUitnodiging(app, inv, true)
        inv.set("herinnerd", true)
        app.save(inv)
      } catch (err) {
        console.log("herinnering mislukt", inv.id, err)
      }
      sleep(2000) // niet alles tegelijk naar de mailserver
    }
  }
  for (const teamId of teVerwijderen) {
    try {
      const team = app.findRecordById("teams", teamId)
      const telt = (col) => app.findRecordsByFilter(col, "team = {:t}", "", 1, 0, { t: teamId }).length
      const uitAanmelding = app.findRecordsByFilter("aanmeldingen", "team = {:t}", "", 1, 0, { t: teamId }).length > 0
      const leeg = !team.getStringSlice("beheerders").length && !team.getStringSlice("kijkers").length &&
        !telt("uitnodigingen") && !telt("spelers") && !telt("wedstrijden") && !telt("programma")
      if (uitAanmelding && leeg) app.delete(team)
    } catch (_) {}
  }
}

module.exports = { mailInstellen, mailInGeheugen, telMail, ruimUitnodigingenOp, beslisAanmelding, ROL_VELD, TOEGESTAAN, vindUitnodiging, stuurUitnodiging, escape, mail, nodigUit, vindAanmelding, beheerderEmails, vindTeamMetAanvraaglink, beslisAanvraag, aanvraagInfo }
