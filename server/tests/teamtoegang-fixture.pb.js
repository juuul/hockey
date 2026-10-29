// Alleen expliciet als CLI-hook laden: geïsoleerde QA of twee fictieve voorbeelden in het bestaande testteam.
$app.rootCmd.addCommand(new Command({ use: "test-teamtoegang-fixture", run: () => {
  if ($os.getenv("HOCKEY_ENV") !== "test" || $app.countRecords("teams") !== 0) throw new Error("Vereist lege testdatabase")
  for (const [id, naam] of [["toegangbeheer01", "beheer"], ["toegangander001", "ander"]]) {
    const u = new Record($app.findCollectionByNameOrId("users"))
    u.id = id; u.setEmail(naam + "@example.invalid"); u.setPassword("Fictief-Toegang-Test-123!"); u.setVerified(true); u.set("emailVisibility", true); u.set("name", "Demo " + naam); $app.save(u)
  }
  const officieel = new Record($app.findCollectionByNameOrId("catalogus_teams"))
  officieel.id = "toegangbron0001"; officieel.set("bronId", "fictief"); officieel.set("clubBronId", "FICTIEF"); officieel.set("naam", "Demo MO11-1"); officieel.set("seizoen", "2026-2027"); $app.save(officieel)
  for (const [id, user] of [["toegangteam0001", "toegangbeheer01"], ["toegangteam0002", "toegangander001"]]) {
    const t = new Record($app.findCollectionByNameOrId("teams"))
    t.id = id; t.set("naam", "Demo " + id); t.set("beheerders", [user]); t.set("officieelTeam", officieel.id); t.set("aanvraaglink", "FictieveTeamlinkMetVoldoendeTekens123"); $app.save(t)
  }
  const p = new Record($app.findCollectionByNameOrId("spelers"))
  p.id = "toegangkind0001"; p.set("team", "toegangteam0001"); p.set("naam", "Demo speler"); $app.save(p)
  console.log("TEAMTOEGANG_FIXTURE_OK")
} }))

$app.rootCmd.addCommand(new Command({ use: "test-teamtoegang-voorbeeld", run: (cmd, args) => {
  if ($os.getenv("HOCKEY_ENV") !== "test" || args[0] !== "8t20pfu2d0ajrmw") throw new Error("Alleen het expliciete fictieve testteam")
  const team = $app.findRecordById("teams", args[0]), h = require(`${__hooks}/teamtoegang.js`)
  $app.runInTransaction(tx => {
    for (const [id, naam, email] of [
      ["demotoegang0001", "Demo Nieuwe Ouder", "demo-nieuwe-ouder@example.invalid"],
      ["demotoegang0002", "Demo Geblokkeerde Ouder", "demo-geblokkeerde-ouder@example.invalid"],
    ]) {
      let u
      try { u = tx.findAuthRecordByEmail("users", email) } catch (_) {
        u = new Record(tx.findCollectionByNameOrId("users")); u.id = id; u.setEmail(email); u.setPassword($security.randomString(40)); u.setVerified(true); u.set("emailVisibility", true); u.set("name", naam); tx.save(u)
      }
      if (id === "demotoegang0001") {
        const t = tx.findRecordById("teams", team.id)
        if (!t.getStringSlice("kijkers").includes(u.id)) { t.set("kijkers", [...t.getStringSlice("kijkers"), u.id]); tx.save(t) }
        const bestaand = tx.findRecordsByFilter("toegangsaanvragen", "team = {:t} && email = {:e}", "", 1, 0, { t: team.id, e: email })
        const a = bestaand[0] || new Record(tx.findCollectionByNameOrId("toegangsaanvragen"))
        for (const [k,v] of Object.entries({ team: team.id, naam, email, terug: "https://hockey.juliaan.eu/test/", token: $security.randomString(40), status: "toegelaten", automatisch: true, gezien: false })) a.set(k,v)
        tx.save(a)
      } else h.blokkeer(tx, team, email, naam, "")
    }
  })
  console.log("TEAMTOEGANG_VOORBEELD_OK: één nieuw lid en één geblokkeerde ouder")
} }))
