migrate(app => {
  for (const p of app.findRecordsByFilter("programma", "", "", 0, 0)) {
    p.set("verzamelModus", "automatisch")
    app.save(p)
  }
}, () => { throw new Error("Herstel via gecontroleerde back-up") })
