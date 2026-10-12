function bereken(datum, tijd, minuten, instellingen) {
  if (!/^\d{4}-\d\d-\d\d$/.test(datum) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(tijd) || !Number.isInteger(minuten) || minuten < 0) return null
  const d = new Date(`${datum}T${tijd}:00Z`)
  if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0, 10) !== datum) return null
  return new Date(d.getTime() - (minuten + instellingen.voorbereidingMinuten + instellingen.bufferMinuten) * 60000).toISOString()
}
function pasAan(app, p) {
  const modus = p.getString("verzamelModus") || (p.getString("verzamelen") ? "handmatig" : "automatisch")
  if (!["automatisch", "handmatig", "wissen"].includes(modus)) throw new BadRequestError("Ongeldige verzameltijdkeuze")
  p.set("verzamelModus", modus)
  if (modus === "handmatig") return
  let tijd = null
  if (modus === "automatisch" && p.getString("soort") === "wedstrijd") {
    const team = app.findRecordById("teams", p.getString("team"))
    const info = require(`${__hooks}/reizen.js`).teamInfo(app, team)
    let planning = {}; try { planning = JSON.parse(p.getString("bronPlanning") || "{}") || {} } catch (_) {}
    const zaal = planning.spelvorm === "Zaal" || info.spelvorm === "Zaal"
    const adres = p.getString("locatieAdres") || (p.getBool("thuis") && !zaal ? info.clubAdres : "")
    const vertrek = info.effectief.vertrekAdres
    if (adres && vertrek) {
      const cache = require(`${__hooks}/reiscache.js`)
      const r = cache.resultaat(cache.zoek(app, vertrek, adres))
      const minuten = adres.trim().toLowerCase() === vertrek.trim().toLowerCase() ? 0 : r?.minuten
      if (minuten != null) tijd = bereken(p.getString("datum"), p.getString("spelen"), minuten, info.effectief)
    }
  }
  p.set("verzamelen", tijd ? tijd.slice(11, 16) : "")
  p.set("verzamelDatum", tijd ? tijd.slice(0, 10) : "")
}
function alle(app) {
  for (const p of app.findRecordsByFilter("programma", "verzamelModus = 'automatisch'", "", 0, 0)) {
    const oud = p.getString("verzamelen") + p.getString("verzamelDatum")
    pasAan(app, p)
    if (oud !== p.getString("verzamelen") + p.getString("verzamelDatum")) app.save(p)
  }
}
module.exports = { bereken, pasAan, alle }
