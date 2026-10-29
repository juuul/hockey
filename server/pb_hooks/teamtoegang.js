function blokkade(app, team, email) {
  const rows = app.findRecordsByFilter("teamblokkades", "team = {:t} && email = {:e}", "", 1, 0,
    { t: team, e: String(email).trim().toLowerCase() })
  return rows[0] || null
}
function controleer(app, team, email) {
  if (blokkade(app, team, email)) throw new ForbiddenError("Je toegang tot dit team is geblokkeerd. Neem contact op met de teambeheerder.")
}
function beheerder(e, team) {
  if (!e.auth || e.auth.collection().name !== "users" || e.auth.getBool("gast")) throw new UnauthorizedError("Log eerst in")
  if (!e.auth.getBool("superadmin") && !team.getStringSlice("beheerders").includes(e.auth.id)) throw new ForbiddenError("Alleen beheerders van dit team")
}
function aanmelden(app, team, b) {
  const h = require(`${__hooks}/hockey.js`)
  const email = String(b.email || "").trim().toLowerCase(), naam = String(b.naam || "").trim().slice(0, 60)
  if (!naam) throw new BadRequestError("Vul je naam in")
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) throw new BadRequestError("Vul een geldig e-mailadres in")
  if (!h.TOEGESTAAN.includes(String(b.terug || ""))) throw new BadRequestError("Onbekend terugadres")
  let nieuw = false
  app.runInTransaction(tx => {
    controleer(tx, team.id, email)
    let user
    try { user = tx.findAuthRecordByEmail("users", email) } catch (_) {}
    const actueel = tx.findRecordById("teams", team.id)
    if (user && [...actueel.getStringSlice("beheerders"), ...actueel.getStringSlice("kijkers")].includes(user.id)) return
    // Een herhaalde klik verstuurt geen tweede uitnodiging of beheerdersmelding.
    if (tx.findRecordsByFilter("uitnodigingen", "team = {:t} && email = {:e}", "", 1, 0, { t: team.id, e: email }).length) return
    const oud = tx.findRecordsByFilter("toegangsaanvragen", "team = {:t} && email = {:e}", "-created", 1, 0, { t: team.id, e: email })
    const a = oud[0] || new Record(tx.findCollectionByNameOrId("toegangsaanvragen"))
    a.set("team", team.id); a.set("naam", naam); a.set("email", email)
    a.set("kindNaam", String(b.kindNaam || "").trim().slice(0, 60))
    a.set("terug", b.terug); a.set("token", $security.randomString(40))
    a.set("status", "toegelaten"); a.set("automatisch", true); a.set("gezien", false)
    tx.save(a)
    h.nodigUit(tx, team.id, email, "kijker", b.terug, "", naam, [])
    nieuw = true
  })
  if (nieuw) {
    try {
      h.mail(app, h.beheerderEmails(app, team), "Nieuw lid bij " + team.getString("naam"),
        "<p>" + h.escape(naam) + " (" + h.escape(email) + ") heeft zich aangemeld bij " + h.escape(team.getString("naam")) + ". De uitnodiging is direct verstuurd.</p><p>Bekijk de melding in de app bij Instellingen → Aanvragen. Daar kun je deze persoon blokkeren. Geblokkeerde personen staan bij Leden.</p>")
    } catch (_) { /* De ongelezen melding blijft in de app staan. */ }
  }
  return { ok: true }
}
function blokkeer(app, team, email, naam, maker) {
  email = String(email || "").trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new BadRequestError("Ongeldig e-mailadres")
  app.runInTransaction(tx => {
    const t = tx.findRecordById("teams", team.id)
    let user
    try { user = tx.findAuthRecordByEmail("users", email) } catch (_) {}
    if (user?.id === maker) throw new BadRequestError("Je kunt jezelf niet blokkeren")
    if (user?.getBool("superadmin")) throw new BadRequestError("De appbeheerder kan niet worden geblokkeerd")
    if (user && t.getStringSlice("beheerders").includes(user.id) && t.getStringSlice("beheerders").length === 1) throw new BadRequestError("Wijs eerst een andere beheerder aan")
    if (!blokkade(tx, t.id, email)) {
      const r = new Record(tx.findCollectionByNameOrId("teamblokkades"))
      r.set("team", t.id); r.set("email", email); r.set("naam", String(naam || user?.getString("name") || "").slice(0, 60)); tx.save(r)
    }
    if (user) {
      for (const veld of ["beheerders", "kijkers"]) t.set(veld, t.getStringSlice(veld).filter(id => id !== user.id))
      tx.save(t)
    }
    for (const inv of tx.findRecordsByFilter("uitnodigingen", "team = {:t} && email = {:e}", "", 0, 0, { t: t.id, e: email })) tx.delete(inv)
    for (const a of tx.findRecordsByFilter("toegangsaanvragen", "team = {:t} && email = {:e}", "", 0, 0, { t: t.id, e: email })) {
      a.set("status", "geblokkeerd"); a.set("gezien", true); tx.save(a)
    }
  })
}
function deblokkeer(app, team, id, terug) {
  const h = require(`${__hooks}/hockey.js`)
  if (!h.TOEGESTAAN.includes(terug)) throw new BadRequestError("Onbekend terugadres")
  app.runInTransaction(tx => {
    const r = tx.findRecordById("teamblokkades", id)
    if (r.getString("team") !== team.id) throw new ForbiddenError("Andere teamomgeving")
    const email = r.getString("email"), naam = r.getString("naam")
    tx.delete(r)
    let user
    try { user = tx.findAuthRecordByEmail("users", email) } catch (_) {}
    if (user && user.getBool("verified") && !user.getBool("gast")) {
      const t = tx.findRecordById("teams", team.id)
      if (![...t.getStringSlice("beheerders"), ...t.getStringSlice("kijkers")].includes(user.id)) {
        t.set("kijkers", [...t.getStringSlice("kijkers"), user.id]); tx.save(t)
      }
    } else h.nodigUit(tx, team.id, email, "kijker", terug, "", naam, [])
    for (const a of tx.findRecordsByFilter("toegangsaanvragen", "team = {:t} && email = {:e}", "", 0, 0, { t: team.id, e: email })) {
      a.set("status", "toegelaten"); a.set("gezien", true); tx.save(a)
    }
  })
}
module.exports = { blokkade, controleer, beheerder, aanmelden, blokkeer, deblokkeer }
