// Alleen lokale CLI-fixture voor een lege, geïsoleerde testdatabase met fictieve gegevens.
$app.rootCmd.addCommand(new Command({use:'zaal-fixture',run:()=>{
 if($os.getenv('HOCKEY_ENV')!=='test'||$app.countRecords('users'))throw Error('Alleen lege fictieve testdatabase')
 const u=new Record($app.findCollectionByNameOrId('users'));u.id='zzqa00000000001';u.setEmail('zaal-fictief@example.invalid');u.setPassword('Fictief-Zaal-123456!');u.setVerified(true);$app.save(u)
 const c=new Record($app.findCollectionByNameOrId('catalogus_clubs'));c.id='zzqa00000000005';c.set('bronId','ZZQA123');c.set('naam','Fictieve zaalclub');$app.save(c)
 for(const [n,v,naam]of[['3','Veld','Fictieve MO11-1'],['4','Zaal','Fictieve zMO11-1']]){
 const o=new Record($app.findCollectionByNameOrId('catalogus_teams'));o.id='zzqa0000000000'+n;o.set('bronId','zzqa'+n);o.set('clubBronId','ZZQA123');o.set('naam',naam);o.set('seizoen','2026-2027');o.set('spelvorm',v);$app.save(o)
 }
 const t=new Record($app.findCollectionByNameOrId('teams'));t.id='zzqa00000000002';t.set('naam','Fictieve veldgroep');t.set('officieelTeam','zzqa00000000003');t.set('beheerders',[u.id]);$app.save(t)
 for(const [naam,v]of[['T Noor','K'],['T Emma','LW']]){const s=new Record($app.findCollectionByNameOrId('spelers'));s.set('team',t.id);s.set('naam',naam);s.set('voorkeur1',v);$app.save(s)}
 console.log('ZAAL_FIXTURE_OK')
}}))
$app.rootCmd.addCommand(new Command({use:'zaal-uitnodiging-fixture',run:()=>{
 if($os.getenv('HOCKEY_ENV')!=='test')throw Error('Alleen test')
 const u=$app.findRecordById('users','zzqa00000000001');if(u.email()!=='zaal-fictief@example.invalid')throw Error('Geen fixture')
 u.setVerified(false);$app.save(u)
 const t=new Record($app.findCollectionByNameOrId('teams'));t.id='zzqa00000000006';t.set('naam','Fictieve zaaluitnodiging');t.set('officieelTeam','zzqa00000000004');t.set('beheerders',[]);$app.save(t)
 const i=new Record($app.findCollectionByNameOrId('uitnodigingen'));i.set('team',t.id);i.set('email',u.email());i.set('naam','T Ouder');i.set('rol','beheerder');i.set('terug','https://hockey.juliaan.eu/test/');i.set('token','FictieveZaalUitnodiging12345678901234567890');$app.save(i)
 console.log('ZAAL_UITNODIGING_FIXTURE_OK')
}}))
