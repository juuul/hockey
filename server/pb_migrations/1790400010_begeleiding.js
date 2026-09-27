/// <reference path="../pb_data/types.d.ts" />

// Spelbegeleiding: '' = nog te bepalen, '-' = niet nodig, anders een speler-id (ouder van).
// Per team de standaard: bij uit/thuis geen begeleiding nodig ({ uitGeenBegeleiding, thuisGeenBegeleiding }).
// Bestaande uitwedstrijden zonder naam: niet nodig (de thuisclub regelt dan de begeleiding).
migrate((app) => {
  const teams = app.findCollectionByNameOrId("teams")
  teams.fields.add(new JSONField({ name: "instellingen", maxSize: 2000 }))
  app.save(teams)

  for (const p of app.findRecordsByFilter("programma", "soort = 'wedstrijd' && thuis = false", "", 0, 0)) {
    let gewijzigd = false
    for (const veld of ["begeleider1", "begeleider2"]) {
      if (p.getString(veld) === "") {
        p.set(veld, "-")
        gewijzigd = true
      }
    }
    if (gewijzigd) app.save(p)
  }
}, (app) => {
  const teams = app.findCollectionByNameOrId("teams")
  teams.fields.removeByName("instellingen")
  app.save(teams)
})
