/// <reference path="../pb_data/types.d.ts" />

// Spelersnamen uniek per team (hoofdletters tellen niet mee). Alleen voornamen; dubbele voornamen maakt de beheerder
// zelf uniek (bv. 'Sarah E.'). De app controleert dit ook; dit is de vangrail als twee toestellen tegelijk toevoegen.
migrate((app) => {
  const spelers = app.findCollectionByNameOrId("spelers")
  spelers.addIndex("idx_spelers_team_naam", true, "team, naam COLLATE NOCASE", "")
  app.save(spelers)
}, (app) => {
  const spelers = app.findCollectionByNameOrId("spelers")
  spelers.removeIndex("idx_spelers_team_naam")
  app.save(spelers)
})
