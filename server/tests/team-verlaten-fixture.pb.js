// Alleen expliciet als CLI laden op een lege, geïsoleerde testdatabase.
$app.rootCmd.addCommand(new Command({use:'team-verlaten-fixture',run:()=>{
 if($os.getenv('HOCKEY_ENV')!=='test'||$app.countRecords('users'))throw Error('Vereist lege fictieve testdatabase')
 $app.runInTransaction(tx=>{
  for(let n=1;n<=3;n++){
   const u=new Record(tx.findCollectionByNameOrId('users'));u.id='verlaatuser000'+n;u.setEmail('verlaten'+n+'@example.invalid');u.setPassword('Fictief-Verlaten-123!');u.setVerified(true);tx.save(u)
  }
  for(let n=1;n<=3;n++){
   const t=new Record(tx.findCollectionByNameOrId('teams'));t.id='verlaatteam000'+n;t.set('naam','Fictief team '+n)
   t.set('beheerders',n===1?['verlaatuser0001','verlaatuser0002']:['verlaatuser000'+(n===2?1:2)])
   t.set('kijkers',n===1?['verlaatuser0003']:[]);tx.save(t)
  }
  const s=new Record(tx.findCollectionByNameOrId('spelers'));s.id='verlaatkind0001';s.set('naam','T Fictief');s.set('team','verlaatteam0001');tx.save(s)
 })
 console.log('TEAM_VERLATEN_FIXTURE_OK')
}}))
