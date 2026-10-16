// Alleen op een nieuwe geïsoleerde testdatabase, geen echte accounts of mails.
$app.rootCmd.addCommand(new Command({ use: 'test-rijden-fixture', run: () => {
  if ($os.getenv('HOCKEY_ENV') !== 'test' || $app.countRecords('teams') !== 0) throw new Error('Vereist lege testdatabase')
  for (const rol of ['beheer', 'kijker', 'ander']) {
    const u = new Record($app.findCollectionByNameOrId('users'))
    u.id = 'rijtest' + rol.padEnd(8, '0'); u.set('email', rol + '@example.invalid'); u.set('password', 'Fictief-Rijden-Test-123!'); u.set('verified', true); $app.save(u)
  }
  const t = new Record($app.findCollectionByNameOrId('teams'))
  t.id = 'rijtestteam0001'; t.set('naam', 'Voorbeeld'); t.set('beheerders', ['rijtestbeheer00']); t.set('kijkers', ['rijtestkijker00']); $app.save(t)
  const p = new Record($app.findCollectionByNameOrId('programma'))
  p.id = 'rijtestpot00001'; p.set('team', t.id); p.set('datum', '2026-11-01'); p.set('soort', 'wedstrijd'); p.set('thuis', false); p.set('rijders', ['kindvoorbeeld', '-', '']); $app.save(p)
  console.log('RIJDEN_FIXTURE_OK: controleer opgeslagen rijbeurten via rijden.mjs')
} }))
