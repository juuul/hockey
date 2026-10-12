onRecordCreate(e => { require(`${__hooks}/verzamelen.js`).pasAan(e.app, e.record); e.next() }, "programma")
onRecordUpdate(e => { require(`${__hooks}/verzamelen.js`).pasAan(e.app, e.record); e.next() }, "programma")
$app.rootCmd.addCommand(new Command({ use: "verzamelen-bijwerken", run: () => {
  $app.runInTransaction(tx => require(`${__hooks}/verzamelen.js`).alle(tx))
  console.log("VERZAMELEN_OK")
} }))
