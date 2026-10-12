// Alleen lokale CLI; geen publiek mailendpoint. Draait met bestaande SMTP-instellingen.
$app.rootCmd.addCommand(new Command({ use: "planning-mail", run: (cmd, args) => {
  const b = JSON.parse(toString($os.readFile(args[0])))
  if (!Array.isArray(b.aan) || b.aan.length !== 1 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.aan[0]) || typeof b.onderwerp !== "string" || typeof b.html !== "string" || b.html.length > 100000) throw new Error("Ongeldige mail")
  const h = require("/pb/pb_hooks/hockey.js")
  h.mailInGeheugen($app)
  $app.settings().meta.senderAddress = "hockey@juliaan.eu"
  $app.settings().meta.senderName = "Hockey Wissel-app"
  h.telMail($app)
  h.mail($app, b.aan, b.onderwerp, b.html)
  console.log("PLANNING_MAIL_OK")
} }))
