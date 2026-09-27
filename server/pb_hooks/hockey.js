// Gedeelde functies voor de hooks (handlers draaien los van elkaar, dus alles via require)

const ROL_VELD = { beheerder: "beheerders", kijker: "kijkers" }

// Alleen links terug naar onze eigen app
const TOEGESTAAN = [
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

function stuurUitnodiging(app, inv) {
  const team = app.findRecordById("teams", inv.getString("team"))
  const link = inv.getString("terug") + "#uitnodiging=" + inv.getString("token")
  const rolTekst = { beheerder: "beheerder (mag alles bijhouden en regelen)", kijker: "kijker (kijkt mee)" }[inv.getString("rol")]
  const meta = app.settings().meta
  const msg = new MailerMessage({
    from: { address: meta.senderAddress, name: meta.senderName },
    to: [{ address: inv.getString("email") }],
    subject: "Uitnodiging voor " + team.getString("naam") + " in de Hockey Wissel-app",
    html:
      "<p>Hallo,</p>" +
      "<p>Je bent uitgenodigd voor <strong>" + escape(team.getString("naam")) + "</strong> als " + escape(rolTekst) + ".</p>" +
      "<p><a href=\"" + escape(link) + "\">Uitnodiging openen</a></p>" +
      "<p>De link is " + GELDIG_DAGEN + " dagen geldig.</p>",
  })
  app.newMailClient().send(msg)
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

module.exports = { ROL_VELD, TOEGESTAAN, vindUitnodiging, stuurUitnodiging, escape, mail, nodigUit, vindAanmelding, beheerderEmails, vindTeamMetAanvraaglink, beslisAanvraag, aanvraagInfo }
