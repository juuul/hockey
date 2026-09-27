/// <reference path="../pb_data/types.d.ts" />

// De app staat op https://hockey.juliaan.eu/ (juliaan.eu/hockey/ stuurt daarheen door): wachtwoordlinks naar het nieuwe adres
migrate((app) => {
  const settings = app.settings()
  settings.meta.appURL = "https://hockey.juliaan.eu/"
  app.save(settings)
}, (app) => {
  const settings = app.settings()
  settings.meta.appURL = "https://juliaan.eu/hockey/"
  app.save(settings)
})
