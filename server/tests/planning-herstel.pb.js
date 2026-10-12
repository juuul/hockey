// Alleen als tijdelijke CLI-hook op een geïsoleerde testkopie.
$app.rootCmd.addCommand(new Command({use:'test-planning-herstel',run:()=>{
 if($os.getenv('HOCKEY_ENV')!=='test')throw new Error('Alleen test')
 const check=(v,m)=>{if(!v)throw new Error(m)}
 let afgerond=false
 try{$app.runInTransaction(tx=>{
  const p=tx.findRecordsByFilter('programma',"bronId != ''",'',1,0)[0]
  const team=tx.findRecordById('teams',p.getString('team'))
  const w=tx.findFirstRecordByData('catalogus_wedstrijden','bronId',p.getString('bronId'))
  const speler=tx.findRecordsByFilter('spelers','team = {:id}','',1,0,{id:team.id})[0]
  p.set('spelen','23:59');p.set('datum','2027-06-30');p.set('verzamelModus','handmatig');p.set('verzamelen','22:00');p.set('locatieAdres','Fictieve eigen locatie');p.set('notitie','Fixture behouden');p.set('fruit',speler.id);tx.save(p)
  require(`${__hooks}/catalogus.js`).herstel(tx,p,team,'alles')
  const nieuw=tx.findRecordById('programma',p.id)
  check(nieuw.getString('datum')===w.getString('datum')&&nieuw.getString('spelen')===w.getString('spelen'),'brondata niet hersteld')
  check(nieuw.getString('locatieAdres')===w.getString('locatieAdres'),'adres niet hersteld')
  check(nieuw.getString('verzamelModus')==='automatisch','niet automatisch')
  check(nieuw.getString('notitie')==='Fixture behouden'&&nieuw.getString('fruit')===speler.id,'eigen taken verloren')
  const voor=nieuw.getString('spelen');let fout=false;try{require(`${__hooks}/catalogus.js`).herstel(tx,nieuw,team,'onbekend')}catch(_){fout=true}check(fout&&nieuw.getString('spelen')===voor,'ongeldig veld geaccepteerd')
  const geplande=tx.findRecordsByFilter('programma',"bronId = '' && bronPlanning != null",'',0,0).find(r=>{try{return !!JSON.parse(r.getString('bronPlanning')).datum}catch(_){return false}})
  if(geplande){
    const basis=JSON.parse(geplande.getString('bronPlanning')),omgeving=tx.findRecordById('teams',geplande.getString('team'))
    geplande.set('datum','2027-06-30');geplande.set('spelen','09:35');geplande.set('tegenstander','Fictieve tegenstander');geplande.set('locatieAdres','Fictief adres');geplande.set('notitie','Kalendernotitie behouden');tx.save(geplande)
    require(`${__hooks}/catalogus.js`).herstel(tx,geplande,omgeving,'alles')
    const hersteld=tx.findRecordById('programma',geplande.id)
    check(hersteld.getString('datum')===basis.datum&&hersteld.getString('verzamelModus')==='automatisch','kalender niet hersteld')
    if(!hersteld.getString('bronId'))check(!hersteld.getString('spelen')&&!hersteld.getString('tegenstander')&&!hersteld.getString('locatieAdres'),'eigen planning niet gewist')
    check(hersteld.getString('notitie')==='Kalendernotitie behouden','kalendernotitie verloren')
  }
  afgerond=true;throw new Error('TEST_ROLLBACK')
 })}catch(e){if(!afgerond)throw e}
 console.log('HERSTEL_OK: officiële planning, automatisch, taak/notitie behouden, onbekend veld geweigerd')
}}))
