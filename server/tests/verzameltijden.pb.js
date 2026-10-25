// Alleen als tijdelijke CLI-hook in een geïsoleerde testcontainer.
$app.rootCmd.addCommand(new Command({use:'test-tijden',run:()=>{
 if($os.getenv('HOCKEY_ENV')!=='test')throw new Error('Alleen geïsoleerde testomgeving')
 const check=(v,m)=>{if(!v)throw new Error(m)}
 $app.runInTransaction(tx=>{
 const team=tx.findRecordsByFilter('teams',"officieelTeam != ''",'',1,0)[0]
 const r=new Record(tx.findCollectionByNameOrId('programma'))
 r.set('team',team.id);r.set('soort','wedstrijd');r.set('datum','2026-10-31');r.set('spelen','10:30');r.set('thuis',true);r.set('verzamelModus','automatisch');tx.save(r)
 check(r.getString('verzamelen')==='09:55','automatisch thuis')
 r.set('spelen','11:00');tx.save(r);check(r.getString('verzamelen')==='10:25','aanvang update')
 r.set('verzamelModus','handmatig');r.set('verzamelen','08:00');tx.save(r);r.set('spelen','12:00');tx.save(r);check(r.getString('verzamelen')==='08:00'&&r.getString('verzamelModus')==='handmatig','handmatig moet behouden blijven')
 r.set('verzamelModus','wissen');tx.save(r);r.set('spelen','13:00');tx.save(r);check(r.getString('verzamelen')==='12:25'&&r.getString('verzamelModus')==='automatisch','wissen mag automatisch niet blokkeren')
 r.set('verzamelModus','automatisch');r.set('thuis',false);r.set('locatieAdres','Oostwaard 32, 3602AA Maarssen');tx.save(r)
 check(r.getString('verzamelen')!==''&&r.getString('verzamelen')!=='12:25','uitrit cache')
 r.set('locatieAdres','Onbekend');tx.save(r);check(r.getString('verzamelen')==='','onbekend geen nul')
 r.set('thuis',true);r.set('locatieAdres','');r.set('datum','2027-01-01');r.set('spelen','00:10');tx.save(r);check(r.getString('verzamelen')==='23:35'&&r.getString('verzamelDatum')==='2026-12-31','vorige dag')
 tx.delete(r)
 });console.log('TIJDEN_OK: automatisch, gewijzigde aanvang, handmatig behouden, oude wissenmodus, cache, onbekend en middernacht')
}}))
