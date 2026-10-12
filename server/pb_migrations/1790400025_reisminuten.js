/// <reference path="../pb_data/types.d.ts" />
// Hergebruik de oorspronkelijke seconden; alleen de openbare cache verandert.
migrate(app => {
  for (const r of app.findRecordsByFilter("reis_routes", "status = 'klaar'", "", 0, 0)) {
    r.set("minuten", Math.ceil(r.getFloat("seconden") / 60))
    app.save(r)
  }
}, () => { throw new Error("Herstel via gecontroleerde back-up") })
