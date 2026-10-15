// Alleen na geslaagde SMTP-verzending; geen wachtwoorden in de wachtrij.
function bewaar(app, bericht) {
  if ($os.getenv("IMAP_SENT_ENABLED") !== "1") return
  const map = app.dataDir() + "/mail-verzonden"
  $os.mkdirAll(map, 0o700)
  const id = $security.randomString(32)
  const headers = {}
  for (const k of Object.keys(bericht.headers || {})) headers[k] = bericht.headers[k]
  const item = {
    id, datum: new Date().toISOString(),
    from: bericht.from, to: bericht.to, cc: bericht.cc, bcc: bericht.bcc,
    subject: bericht.subject, text: bericht.text, html: bericht.html, headers,
  }
  // Eerst volledig schrijven, dan atomair beschikbaar maken voor de werker.
  const tijdelijk = map + "/" + id + ".tmp"
  $os.writeFile(tijdelijk, JSON.stringify(item), 0o600)
  $os.rename(tijdelijk, map + "/" + id + ".json")
}

module.exports = { bewaar }
