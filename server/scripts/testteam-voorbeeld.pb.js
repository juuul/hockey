// Alleen expliciet als lokale CLI-hook; nooit opnemen in de publieke serverhooks.
$app.rootCmd.addCommand(new Command({ use: 'testteam-voorbeeld', run: (cmd, args) => {
  if ($os.getenv('HOCKEY_ENV') !== 'test' || args.length !== 1) throw new Error('Alleen de testomgeving, met een gesaneerd exportbestand')
  const data = JSON.parse(toString($os.readFile(args[0])))
  if (!data.doelteam || !Array.isArray(data.spelers) || !data.spelers.length || !data.spelers.every(s => /^Demo /.test(s.naam))) throw new Error('Ongeldige fictieve spelers')
  const team = $app.findRecordById('teams', data.doelteam)
  const officieel = $app.findRecordById('catalogus_teams', team.getString('officieelTeam'))
  if (officieel.getString('bronId') !== '46179') throw new Error('Doelteam is niet het bedoelde SCHC MO11-1-testteam')
  $app.runInTransaction(tx => {
    for (const collectie of ['programma', 'wedstrijden', 'spelers', 'clubs']) {
      for (const record of tx.findRecordsByFilter(collectie, 'team = {:team}', '', 0, 0, { team: team.id })) tx.delete(record)
    }
    for (const [collectie, records] of [['spelers', data.spelers], ['clubs', data.clubs], ['programma', data.programma]]) {
      for (const velden of records) {
        const r = new Record(tx.findCollectionByNameOrId(collectie))
        r.id = velden.id; r.set('team', team.id)
        for (const [k, v] of Object.entries(velden)) if (k !== 'id' && k !== 'team') r.set(k, v)
        tx.save(r)
      }
    }
    const t = tx.findRecordById('teams', team.id)
    t.set('naam', data.naam); t.set('omgevingNaam', 'Fictieve testplanning'); tx.save(t)
    let st
    try { st = tx.findRecordById('standen', team.id) } catch (_) { st = new Record(tx.findCollectionByNameOrId('standen')); st.id = team.id; st.set('team', team.id) }
    st.set('stand', data.stand); st.set('bron', 'fictieve-testplanning'); st.set('versie', st.getInt('versie') + 1); tx.save(st)
  })
  console.log('DEMO_IMPORT_OK: ' + data.spelers.length + ' fictieve spelers, ' + data.programma.length + ' datums; bestaande testleden behouden')
} }))
