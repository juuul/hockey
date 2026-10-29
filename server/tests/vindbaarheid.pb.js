// Uitsluitend op een nieuwe, geïsoleerde testdatabase gebruiken; nooit mounten op productie.
$app.rootCmd.addCommand(new Command({ use: 'test-vindbaarheid-fixture', run: () => {
  if ($os.getenv('HOCKEY_ENV') !== 'test') throw new Error('Alleen test')
  if ($app.countRecords('teams') !== 0) throw new Error('Vereist een lege testdatabase')
  const officieel = new Record($app.findCollectionByNameOrId('catalogus_teams'))
  officieel.id = 'testofficieel01'
  for (const [k, v] of Object.entries({ bronId: 'testbron', clubBronId: 'testclub', naam: 'Voorbeeld MO11-1', seizoen: '2026-2027', actief: true })) officieel.set(k, v)
  $app.save(officieel)
  for (let n = 1; n <= 3; n++) {
    const team = new Record($app.findCollectionByNameOrId('teams'))
    team.id = 'testgroep00000' + n
    team.set('naam', 'Voorbeeldgroep ' + n)
    team.set('omgevingNaam', 'Groep ' + n)
    team.set('vindbaar', n === 2)
    if (n !== 3) team.set('officieelTeam', officieel.id)
    $app.save(team)
  }
  const speler = new Record($app.findCollectionByNameOrId('spelers'))
  speler.id = 'testspeler00001'; speler.set('team', 'testgroep000001'); speler.set('naam', 'Voorbeeld')
  $app.save(speler)
  console.log('VINDBAARHEID_FIXTURE_OK')
} }))
$app.rootCmd.addCommand(new Command({ use: 'test-vindbaarheid-controle', run: () => {
  if ($os.getenv('HOCKEY_ENV') !== 'test') throw new Error('Alleen test')
  const check = (v, tekst) => { if (!v) throw new Error(tekst) }
  for (const id of ['testgroep000001', 'testgroep000002']) {
    const team = $app.findRecordById('teams', id)
    const aanvraag = $app.findFirstRecordByData('toegangsaanvragen', 'team', id)
    check(aanvraag.getString('status') === 'toegelaten' && aanvraag.getBool('automatisch') && !aanvraag.getBool('gezien'), 'Directe uitnodiging met ongelezen beheerdersmelding')
    check(!team.getStringSlice('kijkers').length && !team.getStringSlice('beheerders').length, 'Aanvragen mogen geen lidmaatschap maken')
  }
  check($app.countRecords('uitnodigingen') === 2, 'Beide aanmeldingen hebben direct een uitnodiging')
  console.log('VINDBAARHEID_AANSLUITEN_OK')
} }))
