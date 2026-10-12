/// <reference path="../pb_data/types.d.ts" />
migrate(app => {
  const prive = { listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null }
  app.save(new Collection({ name: "reis_locaties", type: "base", ...prive, fields: [
    { type: "text", name: "sleutel", required: true }, { type: "text", name: "adres", required: true, max: 300 },
    { type: "json", name: "labels", maxSize: 3000 }, { type: "json", name: "clubs", maxSize: 3000 },
    { type: "json", name: "punt", maxSize: 500 }, { type: "text", name: "geocodeBron" },
  ], indexes: ["CREATE UNIQUE INDEX idx_reis_locatie ON reis_locaties (sleutel)"] }))
  const locaties = app.findCollectionByNameOrId("reis_locaties")
  app.save(new Collection({ name: "reis_routes", type: "base", ...prive, fields: [
    { type: "relation", name: "vertrek", collectionId: locaties.id, maxSelect: 1, required: true },
    { type: "relation", name: "bestemming", collectionId: locaties.id, maxSelect: 1, required: true },
    { type: "text", name: "status", required: true }, { type: "number", name: "seconden", min: 0, max: 86400 },
    { type: "number", name: "minuten", min: 0, max: 1440, onlyInt: true },
    { type: "text", name: "bron" }, { type: "text", name: "kaartVersie" }, { type: "text", name: "berekend" },
    { type: "text", name: "fout", max: 300 },
  ], indexes: ["CREATE UNIQUE INDEX idx_reis_route ON reis_routes (vertrek, bestemming)"] }))
}, () => { throw new Error("Herstel via gecontroleerde back-up") })
