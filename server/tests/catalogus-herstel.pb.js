// Alleen als tijdelijke CLI-hook op een nieuwe QA-database, nooit op echte omgevingen laden.
$app.rootCmd.addCommand(new Command({use:'test-clubherstel-fixture',run:()=>{
 if($os.getenv('HOCKEY_ENV')!=='test' || $app.countRecords('catalogus_clubs')!==0)throw new Error('Vereist lege QA-database');
 const c=new Record($app.findCollectionByNameOrId('catalogus_clubs'));c.id='herstelclub0001';c.set('bronId','FICTIEF');c.set('naam','Demo club');$app.save(c);
 const t=new Record($app.findCollectionByNameOrId('catalogus_taken'));t.id='hersteltaak0001';t.set('sleutel','club:FICTIEF');t.set('clubBronId','FICTIEF');t.set('status','fout');t.set('opnieuwNa','2099-01-01T21:46:00Z');t.set('pogingen',2);t.set('fout','Privé fouttekst niet publiceren');$app.save(t);
 const team=new Record($app.findCollectionByNameOrId('catalogus_teams'));team.set('clubBronId','FICTIEF');team.set('bronId','123');team.set('naam','Demo O11');team.set('seizoen','2026-2027');team.set('actief',true);$app.save(team);
 console.log('CLUBHERSTEL_FIXTURE_OK');
}}));
