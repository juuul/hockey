$app.rootCmd.addCommand(new Command({ use: "reis-synchroniseer", run: () => {
  $app.runInTransaction(tx => { require(`${__hooks}/reiscache.js`).synchroniseer(tx); require(`${__hooks}/verzamelen.js`).alle(tx) })
  console.log("REIS_SYNC_OK")
} }))
$app.rootCmd.addCommand(new Command({ use: "reis-taken", run: () => {
  const routes = $app.findRecordsByFilter("reis_routes", "status = 'nieuw'", "id", 100, 0)
  console.log(JSON.stringify(routes.map(r => {
    const a = $app.findRecordById("reis_locaties", r.getString("vertrek")), b = $app.findRecordById("reis_locaties", r.getString("bestemming"))
    return { id: r.id, vertrek: { id: a.id, adres: a.getString("adres"), punt: require(`${__hooks}/reiscache.js`).punt(a) }, bestemming: { id: b.id, adres: b.getString("adres"), punt: require(`${__hooks}/reiscache.js`).punt(b) } }
  })))
} }))
$app.rootCmd.addCommand(new Command({ use: "reis-import", run: (cmd, args) => {
  const data = JSON.parse(toString($os.readFile(args[0])))
  $app.runInTransaction(tx => {
    for (const l of data.locaties || []) {
      if (!l.punt || !Number.isFinite(l.punt.lon) || !Number.isFinite(l.punt.lat) || l.punt.lon < 3 || l.punt.lon > 8 || l.punt.lat < 50 || l.punt.lat > 54) throw new Error("Ongeldig Nederlands adrespunt")
      const r = tx.findRecordById("reis_locaties", l.id)
      r.set("punt", l.punt); r.set("geocodeBron", "PDOK/BAG"); tx.save(r)
    }
    for (const route of data.routes || []) {
      const r = tx.findRecordById("reis_routes", route.id)
      if (r.getString("status") === "klaar") continue
      if (route.fout) { r.set("status", "fout"); r.set("fout", String(route.fout).slice(0, 300)) }
      else {
        const minuten = require(`${__hooks}/reiscache.js`).rijMinuten(route.seconden)
        r.set("seconden", route.seconden); r.set("minuten", minuten); r.set("status", "klaar")
        r.set("bron", "OpenStreetMap/OSRM"); r.set("kaartVersie", String(route.kaartVersie || "")); r.set("berekend", new Date().toISOString()); r.set("fout", "")
      }
      tx.save(r)
    }
  })
  console.log("REIS_IMPORT_OK")
} }))
routerAdd("POST", "/api/hockey/reiscache/team/{id}", e => {
  require(`${__hooks}/reizen.js`).beheerder(e)
  const b = e.requestInfo().body
  for (const veld of ["vertrekAdres", "locatieAdres"]) if (typeof b[veld] !== "string" || b[veld].length > 300) throw new BadRequestError("Ongeldig adres")
  const h = require(`${__hooks}/reiscache.js`), r = h.zoek(e.app, b.vertrekAdres, b.locatieAdres)
  return e.json(200, h.resultaat(r) || { beschikbaar: false, status: r?.getString("status") || "onbekend" })
})
// Openbare bronlocaties en tijden, zonder leden, teamafspraken of privéadressen.
routerAdd("GET", "/api/hockey/reisdata", e => {
  const routes = e.app.findRecordsByFilter("reis_routes", "status = 'klaar'", "id", 10000, 0)
  return e.json(200, { licentie: "OpenStreetMap ODbL; adrespunten PDOK/BAG", routes: routes.map(r => {
    const a = e.app.findRecordById("reis_locaties", r.getString("vertrek")), b = e.app.findRecordById("reis_locaties", r.getString("bestemming"))
    return { vertrekAdres: a.getString("adres"), bestemmingAdres: b.getString("adres"), minuten: r.getFloat("minuten"), bron: r.getString("bron"), kaartVersie: r.getString("kaartVersie"), berekend: r.getString("berekend") }
  }) })
})
