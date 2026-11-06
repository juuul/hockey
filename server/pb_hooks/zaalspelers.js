// Eenmalige startkopie; aanroepen binnen de transactie die het zaalteam activeert.
function teamnaam(team) {
  return team.getString("naam").trim().toUpperCase().replace(/\s+/g, " ")
    .replace(/(^|\s)Z(?=(?:MO|JO|M|J|D|H|G|X|O)\d)/g, "$1")
}

function overnemen(app, doel, gebruiker) {
  const leeg = { aantal: 0 }
  if (!gebruiker || gebruiker.getBool("gast") || !gebruiker.verified() || !doel.getStringSlice("beheerders").includes(gebruiker.id)) return { ...leeg, status: "geen-toegang" }
  if (!doel.getString("officieelTeam")) return { ...leeg, status: "niet-gekoppeld" }
  const zaal = app.findRecordById("catalogus_teams", doel.getString("officieelTeam"))
  if (zaal.getString("spelvorm") !== "Zaal") return { ...leeg, status: "geen-zaalteam" }
  if (app.findRecordsByFilter("spelers", "team = {:t}", "", 1, 0, { t: doel.id }).length) return { ...leeg, status: "al-spelers" }
  const bronnen = []
  for (const team of app.findRecordsByFilter("teams", "officieelTeam != '' && beheerders.id ?= {:u} && id != {:t}", "id", 0, 0, { u: gebruiker.id, t: doel.id })) {
    const veld = app.findRecordById("catalogus_teams", team.getString("officieelTeam"))
    if (veld.getString("spelvorm") !== "Veld" || !veld.getString("clubBronId") || !veld.getString("seizoen")) continue
    if (veld.getString("clubBronId") !== zaal.getString("clubBronId") || veld.getString("seizoen") !== zaal.getString("seizoen") || teamnaam(veld) !== teamnaam(zaal)) continue
    bronnen.push(team)
  }
  if (bronnen.length !== 1) return { ...leeg, status: bronnen.length ? "meerdere-veldteams" : "geen-veldteam" }
  const bron = bronnen[0]
  const spelers = app.findRecordsByFilter("spelers", "team = {:t}", "id", 0, 0, { t: bron.id })
  for (const speler of spelers) {
    const nieuw = new Record(app.findCollectionByNameOrId("spelers"))
    nieuw.set("team", doel.id)
    for (const veld of ["naam", "voorkeur1", "voorkeur2"]) nieuw.set(veld, speler.getString(veld))
    app.save(nieuw)
  }
  return { status: "overgenomen", aantal: spelers.length, bronTeam: bron.id }
}

module.exports = { overnemen }
