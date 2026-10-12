// Alleen openbare competitiegegevens. Imports veranderen geen leden of spelers.
function json(r, veld) {
  try { return JSON.parse(r.getString(veld) || "null") } catch (_) { return null }
}
function upsert(app, collectie, filter, params, velden) {
  let r
  try { r = app.findFirstRecordByFilter(collectie, filter, params) } catch (_) { r = new Record(app.findCollectionByNameOrId(collectie)) }
  for (const k of Object.keys(velden)) r.set(k, velden[k])
  app.save(r)
  return r
}
function importeer(app, data) {
  if (!Array.isArray(data.clubs) || !Array.isArray(data.teams) || !Array.isArray(data.wedstrijden)) throw new Error("Ongeldige catalogusimport")
  if (data.clubs.length > 1000 || data.teams.length > 1000 || data.wedstrijden.length > 3000) throw new Error("Import te groot")
  app.runInTransaction((tx) => {
    for (const c of data.clubs) upsert(tx, "catalogus_clubs", "bronId = {:id}", { id: c.bronId }, c)
    for (const t of data.teams) {
      if (!/^\d{4}-\d{4}$/.test(t.seizoen)) throw new Error("Ongeldig seizoen")
      // Clublijst bevat geen competitieklasse; eerder gecontroleerde klasse bewaren.
      let vorige
      try { vorige = tx.findFirstRecordByFilter("catalogus_teams", "bronId = {:id} && seizoen = {:s}", { id: t.bronId, s: t.seizoen }) } catch (_) {}
      if (vorige && !t.klasse) t.klasse = vorige.getString("klasse")
      upsert(tx, "catalogus_teams", "bronId = {:id} && seizoen = {:s}", { id: t.bronId, s: t.seizoen }, t)
    }
    for (const w of data.wedstrijden) upsert(tx, "catalogus_wedstrijden", "bronId = {:id}", { id: w.bronId }, w)
    // Bronwaarden bijwerken in gekoppelde privéomgevingen, handmatige waarden beschermen.
    for (const team of tx.findRecordsByFilter("teams", "officieelTeam != ''", "", 0, 0)) synchroniseer(tx, team)
  })
}
function veldenVan(w, officieel) {
  const thuis = w.getString("thuisBronId") === officieel.getString("bronId")
  return { datum: w.getString("datum"), spelen: w.getString("spelen"), thuis, tegenstander: w.getString(thuis ? "uitNaam" : "thuisNaam"), locatie: w.getString("locatie"), locatieAdres: w.getString("locatieAdres") }
}
function kalendersVoor(app, team, officieel) {
  let kalenders = json(team, "planningKalenders")
  if (!Array.isArray(kalenders)) {
    const club = app.findFirstRecordByData("catalogus_clubs", "bronId", officieel.getString("clubBronId"))
    // Alleen ondubbelzinnige jeugdprofielen automatisch kiezen. Andere klassen
    // hebben verschillende kalenders; de beheerder kiest dan expliciet.
    kalenders = app.findRecordsByFilter("catalogus_kalenders", "seizoen = {:s} && district = {:d} && (spelvorm = {:v} || ({:v} = 'Veld' && spelvorm = 'Zaal'))", "", 0, 0, { s: officieel.getString("seizoen"), d: club.getString("district"), v: officieel.getString("spelvorm") })
      .filter(k => (json(k, "autoLeeftijden") || []).includes(officieel.getString("leeftijd")) && !/landelijk|super|subtop|topklasse/i.test(officieel.getString("klasse")))
      .map(k => k.id)
  }
  return kalenders
}
function synchroniseer(app, team) {
  const officieel = app.findRecordById("catalogus_teams", team.getString("officieelTeam"))
  const lijst = app.findRecordsByFilter("catalogus_wedstrijden", "seizoen = {:s} && (thuisBronId = {:id} || uitBronId = {:id})", "datum", 0, 0, { s: officieel.getString("seizoen"), id: officieel.getString("bronId") })
  const genegeerd = json(team, "bronGenegeerd") || []
  const kalenders = kalendersVoor(app, team, officieel)
  for (const id of kalenders) {
    const kalender = app.findRecordById("catalogus_kalenders", id)
    if (kalender.getString("seizoen") !== officieel.getString("seizoen")) continue
    for (const dag of json(kalender, "dagen") || []) {
      if (dag.datum < new Date().toISOString().slice(0, 10)) continue
      const sleutel = "planning:" + kalender.getString("spelvorm") + ":" + dag.datum
      if (genegeerd.includes(sleutel)) continue
      const regels = app.findRecordsByFilter("programma", "team = {:t}", "", 0, 0, { t: team.id })
      const planning = { id: sleutel, datum: dag.datum, status: dag.status, bron: kalender.getString("bron"), spelvorm: kalender.getString("spelvorm"), kalender: kalender.id, omschrijving: dag.omschrijving || "" }
      const bestaand = regels.find(r => json(r, "bronPlanning")?.id === sleutel)
      if (bestaand) {
        bestaand.set("bronPlanning", planning); app.save(bestaand)
        continue
      }
      // Een verplaatste, ingevulde of al gekoppelde speeldag behoudt zijn identiteit.
      if (regels.some(r => json(r, "bronPlanning")?.id === sleutel || r.getString("datum") === dag.datum) || (kalender.getString("spelvorm") === officieel.getString("spelvorm") && lijst.some(w => w.getString("datum") === dag.datum))) continue
      const p = new Record(app.findCollectionByNameOrId("programma"))
      p.set("team", team.id); p.set("soort", "wedstrijd"); p.set("datum", dag.datum)
      p.set("bronPlanning", planning)
      app.save(p)
    }
  }
  for (const w of lijst) {
    const bronId = w.getString("bronId"), nieuw = veldenVan(w, officieel)
    if (genegeerd.includes(bronId) || genegeerd.includes("planning:" + officieel.getString("spelvorm") + ":" + nieuw.datum)) continue
    let p, bestaand = false
    try { p = app.findFirstRecordByFilter("programma", "team = {:t} && bronId = {:id}", { t: team.id, id: bronId }) } catch (_) {}
    if (!p) {
      // Alleen een unieke, inhoudelijk passende bestaande regel koppelen; nooit op datum alleen.
      const kandidaten = app.findRecordsByFilter("programma", "team = {:t} && bronId = '' && soort = 'wedstrijd' && datum = {:d}", "", 0, 0, { t: team.id, d: nieuw.datum })
        .filter((r) => r.getString("tegenstander").trim().toLowerCase() === nieuw.tegenstander.toLowerCase() && r.getBool("thuis") === nieuw.thuis)
      if (kandidaten.length === 1) { p = kandidaten[0]; bestaand = true }
      else if (kandidaten.length === 0) {
        // Alleen een expliciet geplande, unieke lege speeldag aanvullen; geen gewone
        // handmatige wedstrijd op datum alleen koppelen, en geen doubleheader gokken.
        const planning = app.findRecordsByFilter("programma", "team = {:t} && bronId = '' && soort = 'wedstrijd' && datum = {:d} && tegenstander = '' && clubId = ''", "", 0, 0, { t: team.id, d: nieuw.datum })
          .filter(r => json(r, "bronPlanning")?.spelvorm === officieel.getString("spelvorm"))
        if (planning.length === 1 && lijst.filter(x => x.getString("datum") === nieuw.datum).length === 1) {
          p = planning[0]
          // Lege bronvelden vormen de basis; eigen tijden/locatie blijven behouden.
          p.set("bronBasis", { datum: p.getString("datum"), spelen: "", thuis: p.getBool("thuis"), tegenstander: "", locatie: "", locatieAdres: "" })
        }
      }
    }
    if (!p) {
      p = new Record(app.findCollectionByNameOrId("programma"))
      p.set("team", team.id); p.set("soort", "wedstrijd")
      for (const k of Object.keys(nieuw)) p.set(k, nieuw[k])
    }
    const basis = json(p, "bronBasis") || (bestaand ? nieuw : null)
    if (basis && !Object.prototype.hasOwnProperty.call(basis, "locatieAdres")) basis.locatieAdres = ""
    const wijzigingen = {}
    for (const k of Object.keys(nieuw)) {
      const huidig = k === "thuis" ? p.getBool(k) : p.getString(k)
      // Bij het eerste koppelen bestaande ingevulde waarden bewaren; lege tijd mag aangevuld.
      const eigen = basis && huidig !== basis[k] && !(bestaand && huidig === "")
      if (eigen) {
        if (huidig !== nieuw[k]) wijzigingen[k] = nieuw[k]
      } else p.set(k, nieuw[k])
    }
    // Basis blijft per veld staan zolang er een eigen aanpassing is, ook na meerdere imports.
    const volgendeBasis = { ...nieuw }
    for (const k of Object.keys(wijzigingen)) volgendeBasis[k] = basis[k]
    // Dashboard en historie gebruiken een privéclub-id. Hergebruik dezelfde tegenstander,
    // zodat een geïmporteerde wedstrijd ook bij klaarzetten zijn naam behoudt.
    const tegenstander = p.getString("tegenstander")
    let club
    try { club = app.findRecordById("clubs", p.getString("clubId")) } catch (_) {}
    if (club && club.getString("team") !== team.id) club = null
    const vorigeNaam = basis && basis.tegenstander
    // Een eigen weergavenaam van een bestaande tegenstander behouden.
    if (tegenstander && (!club || (club.getString("naam") !== tegenstander && club.getString("naam") === vorigeNaam))) {
      try { club = app.findFirstRecordByFilter("clubs", "team = {:t} && naam = {:n}", { t: team.id, n: tegenstander }) }
      catch (_) {
        club = new Record(app.findCollectionByNameOrId("clubs"))
        club.set("team", team.id); club.set("naam", tegenstander); app.save(club)
      }
      p.set("clubId", club.id)
    }
    p.set("bronStatus", w.getString("status")); p.set("bronId", bronId); p.set("bronBasis", volgendeBasis); p.set("bronWijziging", wijzigingen)
    app.save(p)
  }
}
function zetTaak(app, club, team) {
  const sleutel = team ? "team:" + team.getString("bronId") + ":" + team.getString("seizoen") : "club:" + club.getString("bronId")
  let taak
  try { taak = app.findFirstRecordByData("catalogus_taken", "sleutel", sleutel) } catch (_) {}
  if (taak && ["nieuw", "bezig"].includes(taak.getString("status"))) return
  if (taak && Date.now() - new Date(taak.getString("updated")).getTime() < 3600000) return
  upsert(app, "catalogus_taken", "sleutel = {:s}", { s: sleutel }, { sleutel, clubBronId: club.getString("bronId"), teamBronId: team ? team.getString("bronId") : "", pouleId: team ? team.getString("pouleId") : "", status: "nieuw", fout: "" })
}
module.exports = { importeer, synchroniseer, zetTaak, kalendersVoor }
