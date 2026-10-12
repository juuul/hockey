function json(r, veld) { try { return JSON.parse(r.getString(veld) || "null") } catch (_) { return null } }
function canon(adres) { return String(adres).trim().toLowerCase().replace(/\b(\d{4})\s+([a-z]{2})\b/g, "$1$2").replace(/[,\n]+/g, " ").replace(/\s+/g, " ") }
function locatie(app, adres, label, club) {
  if (!adres || adres.length > 300) return null
  const sleutel = $security.sha256(canon(adres))
  let r
  try { r = app.findFirstRecordByData("reis_locaties", "sleutel", sleutel) } catch (_) { r = new Record(app.findCollectionByNameOrId("reis_locaties")); r.set("sleutel", sleutel); r.set("adres", adres) }
  const labels = json(r, "labels") || [], clubs = json(r, "clubs") || []
  if (label && !labels.includes(label)) labels.push(label)
  if (club && !clubs.includes(club)) clubs.push(club)
  r.set("labels", labels); r.set("clubs", clubs); app.save(r)
  return r
}
function rijMinuten(seconden) {
  if (typeof seconden !== "number" || !Number.isFinite(seconden) || seconden < 0 || seconden > 86400) throw new Error("Ongeldige routeafstand in tijd")
  return Math.ceil(seconden / 60)
}
function zorgRoute(app, vertrek, bestemming) {
  let r
  try { return app.findFirstRecordByFilter("reis_routes", "vertrek = {:a} && bestemming = {:b}", { a: vertrek.id, b: bestemming.id }) } catch (_) {}
  r = new Record(app.findCollectionByNameOrId("reis_routes"))
  r.set("vertrek", vertrek.id); r.set("bestemming", bestemming.id); r.set("status", vertrek.id === bestemming.id ? "klaar" : "nieuw")
  if (vertrek.id === bestemming.id) { r.set("seconden", 0); r.set("minuten", 0); r.set("bron", "zelfde locatie"); r.set("berekend", new Date().toISOString()) }
  app.save(r); return r
}
function synchroniseer(app) {
  const clubs = app.findRecordsByFilter("catalogus_clubs", "", "", 0, 0)
  const teams = app.findRecordsByFilter("catalogus_teams", "", "", 0, 0)
  const wedstrijden = app.findRecordsByFilter("catalogus_wedstrijden", "locatieAdres != ''", "", 0, 0)
  const basis = new Map(), venues = new Map(), groepen = new Map()
  for (const c of clubs) if (c.getString("adres")) basis.set(c.getString("bronId"), locatie(app, c.getString("adres"), c.getString("naam"), c.getString("bronId")))
  for (const w of wedstrijden) {
    const t = teams.find(t => t.getString("bronId") === w.getString("thuisBronId") && t.getString("seizoen") === w.getString("seizoen"))
    if (!t) continue
    const r = locatie(app, w.getString("locatieAdres"), w.getString("locatie") || t.getString("naam"), t.getString("clubBronId"))
    const key = t.getString("bronId") + ":" + t.getString("seizoen")
    if (!venues.has(key)) venues.set(key, new Map())
    venues.get(key).set(r.id, r)
  }
  for (const t of teams) {
    if (!t.getString("pouleId")) continue
    const group = t.getString("seizoen") + ":" + t.getString("spelvorm") + ":" + t.getString("pouleId")
    if (!groepen.has(group)) groepen.set(group, [])
    groepen.get(group).push(t)
  }
  const voorTeam = t => {
    const gevonden = new Map(venues.get(t.getString("bronId") + ":" + t.getString("seizoen")) || [])
    const club = basis.get(t.getString("clubBronId"))
    if (club) gevonden.set(club.id, club)
    return [...gevonden.values()]
  }
  for (const groep of groepen.values()) for (const a of groep) for (const b of groep) {
    if (a.id === b.id) continue
    for (const vertrek of voorTeam(a)) for (const bestemming of voorTeam(b)) zorgRoute(app, vertrek, bestemming)
  }
  // Ook werkelijk gepubliceerde ontmoetingen meenemen als poulemetadata ontbreekt.
  for (const w of wedstrijden) {
    const a = teams.find(t => t.getString("bronId") === w.getString("thuisBronId") && t.getString("seizoen") === w.getString("seizoen"))
    const b = teams.find(t => t.getString("bronId") === w.getString("uitBronId") && t.getString("seizoen") === w.getString("seizoen"))
    if (a && b) for (const x of voorTeam(a)) for (const y of voorTeam(b)) { zorgRoute(app, x, y); zorgRoute(app, y, x) }
  }
}
function zoek(app, vertrekAdres, locatieAdres) {
  let a, b
  try {
    a = app.findFirstRecordByData("reis_locaties", "sleutel", $security.sha256(canon(vertrekAdres)))
    b = app.findFirstRecordByData("reis_locaties", "sleutel", $security.sha256(canon(locatieAdres)))
    return app.findFirstRecordByFilter("reis_routes", "vertrek = {:a} && bestemming = {:b}", { a: a.id, b: b.id })
  } catch (_) { return null }
}
function resultaat(r) {
  return r && r.getString("status") === "klaar" ? { minuten: r.getFloat("minuten"), bron: r.getString("bron"), berekend: r.getString("berekend"), opgeslagen: true } : null
}
function punt(r) { return json(r, "punt") }
module.exports = { punt, synchroniseer, rijMinuten, zoek, resultaat }
