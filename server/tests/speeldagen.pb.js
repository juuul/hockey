// Kopieer deze CLI-hook uitsluitend naar een tijdelijke hooksmap van de testserver.
// Alle gegevens zijn fictief en worden binnen dezelfde transactie opgeruimd.
$app.rootCmd.addCommand(new Command({ use: "test-speeldagen", run: () => {
  if ($os.getenv("HOCKEY_ENV") !== "test") throw new Error("Alleen op de losse testserver")
  const check = (ok, tekst) => { if (!ok) throw new Error(tekst) }
  $app.runInTransaction((app) => {
    const cat = require(`${__hooks}/catalogus.js`), gemaakt = []
    const maak = (collectie, data) => {
      const r = new Record(app.findCollectionByNameOrId(collectie))
      for (const k of Object.keys(data)) r.set(k, data[k])
      app.save(r); gemaakt.push(r); return r
    }
    const bron = "test-" + $security.randomString(10)
    const club = maak("catalogus_clubs", { bronId: bron, naam: "Voorbeeldclub", district: "Testdistrict" })
    const officieel = maak("catalogus_teams", { bronId: bron, clubBronId: club.getString("bronId"), naam: "Voorbeeld MO11-1", seizoen: "2099-2100", leeftijd: "O11", spelvorm: "Veld" })
    const veld = maak("catalogus_kalenders", { bronId: bron + "-veld", naam: "Testveld", seizoen: "2099-2100", district: "Testdistrict", spelvorm: "Veld", bron: "https://example.invalid/kalender", autoLeeftijden: ["O11"], dagen: [{ datum: "2099-10-31", status: "speeldag" }, { datum: "2100-03-27", status: "reserve" }, { datum: "2100-04-24", status: "reserve" }] })
    maak("catalogus_kalenders", { bronId: bron + "-zaal", naam: "Testzaal", seizoen: "2099-2100", district: "Testdistrict", spelvorm: "Zaal", bron: "https://example.invalid/kalender", autoLeeftijden: ["O11"], dagen: [{ datum: "2099-12-05", status: "speeldag" }, { datum: "2099-12-06", status: "reserve" }] })
    const team = maak("teams", { naam: "Voorbeeld planning", officieelTeam: officieel.id })
    const regels = () => app.findRecordsByFilter("programma", "team = {:t}", "datum", 0, 0, { t: team.id })
    cat.synchroniseer(app, team)
    check(regels().length === 5, "Veld en zaal niet automatisch toegevoegd")
    cat.synchroniseer(app, team); check(regels().length === 5, "Dubbele datums na herhalen")
    const p = regels().find(r => r.getString("datum") === "2099-10-31"), id = p.id
    p.set("verzamelen", "08:00"); p.set("spelen", "09:00"); p.set("notitie", "Eigen afspraak"); app.save(p)
    const fixture = { bronId: bron + "-wedstrijd", seizoen: "2099-2100", thuisBronId: bron, uitBronId: bron + "-tegenstander", datum: "2099-10-31", spelen: "10:00", thuisNaam: "Voorbeeld MO11-1", uitNaam: "Voorbeeld tegenstander", locatie: "Veld 2" }
    cat.importeer(app, { clubs: [], teams: [], wedstrijden: [fixture] })
    const ingevuld = app.findRecordById("programma", id)
    check(ingevuld.getString("bronId") === fixture.bronId && ingevuld.getBool("thuis"), "Speeldag niet aangevuld")
    check(ingevuld.getString("tegenstander") === fixture.uitNaam, "Tegenstander ontbreekt")
    check(ingevuld.getString("spelen") === "09:00" && ingevuld.getString("verzamelen") === "08:00" && ingevuld.getString("notitie") === "Eigen afspraak", "Eigen afspraken overschreven")
    check(JSON.parse(ingevuld.getString("bronWijziging")).spelen === "10:00", "Afwijkende bronwaarde niet zichtbaar")
    fixture.spelen = "11:00"; cat.importeer(app, { clubs: [], teams: [], wedstrijden: [fixture] })
    check(regels().length === 5 && app.findRecordById("programma", id).getString("spelen") === "09:00", "Herhaalde update overschrijft of dupliceert")
    const weg = regels().find(r => r.getString("datum") === "2100-03-27")
    team.set("bronGenegeerd", [JSON.parse(weg.getString("bronPlanning")).id]); app.save(team); app.delete(weg)
    cat.synchroniseer(app, team); check(regels().length === 4, "Verwijderde reserve teruggekomen")
    const verplaatst = regels().find(r => r.getString("datum") === "2100-04-24")
    verplaatst.set("datum", "2100-04-25"); app.save(verplaatst)
    cat.synchroniseer(app, team); check(regels().length === 4, "Verplaatste speeldag opnieuw aangemaakt")
    const dagen = JSON.parse(veld.getString("dagen")); dagen[0].status = "reserve"; veld.set("dagen", dagen); app.save(veld)
    cat.synchroniseer(app, team)
    check(JSON.parse(app.findRecordById("programma", id).getString("bronPlanning")).status === "reserve", "Kalenderupdate niet verwerkt")
    for (const r of regels()) app.delete(r)
    for (const r of app.findRecordsByFilter("clubs", "team = {:t}", "", 0, 0, { t: team.id })) app.delete(r)
    app.delete(app.findFirstRecordByData("catalogus_wedstrijden", "bronId", fixture.bronId))
    for (const r of gemaakt.reverse()) app.delete(r)
  })
  console.log("SPEELDAGEN_TEST_OK: veld, zaal, reserve, aanvullen, eigen afspraken, herhaling, verwijderen en kalenderupdate")
} }))
