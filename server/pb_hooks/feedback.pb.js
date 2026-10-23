// Alleen een gesaneerde kopie van de publieke bestanden, zonder Git of privéconfiguratie.
if ($os.getenv('HOCKEY_ENV') === 'test') {
  routerAdd('GET', '/api/feedback/voorbeeld/{path...}', $apis.static('/pb/feedback-preview', false))
}

routerAdd('POST', '/api/feedback/inzenden', e => {
  return require(`${__hooks}/feedback.js`).inzenden(e)
}, $apis.bodyLimit(16000), $apis.skipSuccessActivityLog())

routerAdd('GET', '/api/feedback/beheer', e => {
  return require(`${__hooks}/feedback.js`).overzicht(e)
}, $apis.requireAuth('users'), $apis.skipSuccessActivityLog())

routerAdd('PATCH', '/api/feedback/beheer/{id}', e => {
  return require(`${__hooks}/feedback.js`).wijzigen(e)
}, $apis.requireAuth('users'), $apis.bodyLimit(1000), $apis.skipSuccessActivityLog())

routerAdd('DELETE', '/api/feedback/beheer/{id}', e => {
  return require(`${__hooks}/feedback.js`).verwijderen(e)
}, $apis.requireAuth('users'), $apis.skipSuccessActivityLog())

cronAdd('feedback-mail', '* * * * *', () => {
  if ($os.getenv('FEEDBACK_MAIL_PAUSED') === '1') return
  try { require(`${__hooks}/feedback.js`).verwerk($app) }
  catch (_) { $app.logger().error('Feedbackmailverwerking mislukt; opgeslagen berichten blijven bewaard') }
})
