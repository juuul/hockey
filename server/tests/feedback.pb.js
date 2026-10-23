// Alleen een lege geïsoleerde testdatabase, niet de gewone test- of productieomgeving.
$app.rootCmd.addCommand(new Command({ use: 'test-feedback-fixture', run: () => {
  if ($os.getenv('HOCKEY_ENV') !== 'test' || $app.countRecords('users')) throw new Error('Vereist lege geïsoleerde testdatabase')
  for (const [id, email, superadmin] of [
    ['feedbackowner01', 'owner@example.invalid', true],
    ['feedbackuser001', 'user@example.invalid', false],
    ['feedbackowner02', 'other@example.invalid', true],
  ]) {
    const user = new Record($app.findCollectionByNameOrId('users'))
    user.id = id; user.set('email', email); user.set('password', 'FeedbackTest123!'); user.set('superadmin', superadmin); user.set('verified', true)
    $app.save(user)
  }
  console.log('FEEDBACK_FIXTURE_OK')
} }))
$app.rootCmd.addCommand(new Command({ use: 'test-feedback-verwerk', run: () => {
  if ($os.getenv('HOCKEY_ENV') !== 'test' || $os.getenv('FEEDBACK_MAIL_PAUSED') !== '1') throw new Error('Alleen geïsoleerde test')
  require(`${__hooks}/feedback.js`).verwerk($app)
  console.log('FEEDBACK_MAIL_TEST_OK')
} }))
$app.rootCmd.addCommand(new Command({ use: 'test-feedback-reset', run: () => {
  if ($os.getenv('HOCKEY_ENV') !== 'test' || $os.getenv('FEEDBACK_MAIL_PAUSED') !== '1' || $os.getenv('FEEDBACK_ADMIN_ID') !== 'feedbackowner01') throw new Error('Alleen geïsoleerde fixture')
  if ($app.findRecordById('users', 'feedbackowner01').email() !== 'owner@example.invalid') throw new Error('Geen fictieve eigenaar')
  for (const col of ['feedback', 'feedback_limieten']) for (const r of $app.findRecordsByFilter(col, 'id != ""', '', 0, 0)) $app.delete(r)
  console.log('FEEDBACK_FIXTURE_RESET_OK')
} }))
