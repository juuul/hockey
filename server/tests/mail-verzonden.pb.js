// Tijdelijke CLI-hook, alleen in een geïsoleerde container met Mailpit.
$app.rootCmd.addCommand(new Command({ use: "test-mail-verzonden", run: () => {
  if ($os.getenv("HOCKEY_ENV") !== "test" || $os.getenv("IMAP_SENT_ENABLED") !== "1") throw new Error("Alleen geïsoleerde test")
  const h = require(`${__hooks}/hockey.js`)
  h.mailInstellen($app)
  h.mail($app, ["test@example.invalid"], "Fictieve archieftest", "<p>Fictieve inhoud</p>")
  const map = $app.dataDir() + "/mail-verzonden"
  const bestanden = $os.readDir(map).filter(f => f.name().endsWith(".json"))
  if (bestanden.length !== 1) throw new Error("Geslaagde mail niet in wachtrij")
  const item = JSON.parse(toString($os.readFile(map + "/" + bestanden[0].name())))
  if (item.subject !== "Fictieve archieftest" || item.to[0].address !== "test@example.invalid" || item.html !== "<p>Fictieve inhoud</p>") throw new Error("Inhoud onjuist")
  $app.settings().smtp.port = 1
  let mislukt = false
  try { h.mail($app, ["test@example.invalid"], "Moet mislukken", "<p>Niet verstuurd</p>") } catch (_) { mislukt = true }
  if (!mislukt || $os.readDir(map).filter(f => f.name().endsWith(".json")).length !== 1) throw new Error("Mislukte mail onterecht gearchiveerd")
  console.log("MAIL_VERZONDEN_OK: succesvolle mail bewaard, mislukte mail niet bewaard")
} }))
