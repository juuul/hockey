// Echte kopieerfunctie met fictieve teams; geen netwerk of echte namen.
const assert = require('node:assert/strict')
const fs = require('node:fs'), vm = require('node:vm'), path = require('node:path')
class Record {
 constructor(id, data={}) { this.id=typeof id==='string'?id:'';this.data=structuredClone(data) }
 getString(k){return this.data[k]||''} getBool(k){return !!this.data[k]} getStringSlice(k){return this.data[k]||[]}
 verified(){return !!this.data.verified} set(k,v){this.data[k]=v}
}
const sandbox={Record,module:{exports:{}}}
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../pb_hooks/zaalspelers.js'),'utf8'),sandbox)
const {overnemen}=sandbox.module.exports
function fixture(){
 const user=new Record('beheer',{verified:true})
 const doel=new Record('zaal',{officieelTeam:'off-zaal',beheerders:['beheer']})
 const bron=new Record('veld',{officieelTeam:'off-veld',beheerders:['beheer']})
 const zaal=new Record('off-zaal',{naam:'Demo zMO11-1',clubBronId:'CLUB123',seizoen:'2026-2027',spelvorm:'Zaal'})
 const veld=new Record('off-veld',{...zaal.data,naam:'Demo MO11-1',spelvorm:'Veld'})
 const spelers=[new Record('oud1',{naam:'T Noor',team:'veld',voorkeur1:'K',voorkeur2:'LW',wissels:8}),new Record('oud2',{naam:'T Emma',team:'veld',voorkeur1:'CM',voorkeur2:'',goals:4})]
 const teams=[bron],opgeslagen=[]
 const app={
  findRecordById:(t,id)=>{assert.equal(t,'catalogus_teams');return id==='off-zaal'?zaal:veld},
  findRecordsByFilter:(t,f,s,n,skip,p)=>t==='teams'?teams.filter(t=>t.data.beheerders.includes(p.u)&&t.id!==p.t):[...spelers,...opgeslagen].filter(r=>r.data.team===p.t).slice(0,n||undefined),
  findCollectionByNameOrId:t=>({name:t}),
  save:r=>{assert.equal(r.data.team,'zaal');r.id='nieuw'+(opgeslagen.length+1);opgeslagen.push(r)},
 }
 return {app,user,doel,bron,zaal,veld,spelers,teams,opgeslagen}
}
{
 const f=fixture(),bron=JSON.stringify(f.spelers)
 const r=overnemen(f.app,f.doel,f.user);assert.equal(r.aantal,2);assert.equal(r.bronTeam,'veld')
 assert.equal(JSON.stringify(f.spelers),bron)
 assert.deepEqual(f.opgeslagen.map(r=>r.data),f.spelers.map(s=>({team:'zaal',naam:s.data.naam,voorkeur1:s.data.voorkeur1,voorkeur2:s.data.voorkeur2})))
 assert.ok(f.opgeslagen.every(r=>!f.spelers.some(s=>s.id===r.id)))
 assert.equal(overnemen(f.app,f.doel,f.user).status,'al-spelers');assert.equal(f.opgeslagen.length,2)
}
for(const wijzig of [f=>f.user.set('gast',true),f=>f.user.set('verified',false),f=>f.doel.set('beheerders',[]),f=>f.bron.set('beheerders',[]),f=>f.veld.set('clubBronId','ANDERS'),f=>f.veld.set('seizoen','2025-2026'),f=>f.veld.set('naam','Demo MO11-2'),f=>f.zaal.set('spelvorm','Veld'),f=>f.teams.push(new Record('dubbel',{...f.bron.data}))]){
 const f=fixture();wijzig(f);assert.equal(overnemen(f.app,f.doel,f.user).aantal,0);assert.equal(f.opgeslagen.length,0)
}
{
 const f=fixture();f.veld.set('naam','Demo H1');f.zaal.set('naam','Demo zH1');assert.equal(overnemen(f.app,f.doel,f.user).aantal,2)
}
console.log('ZAALSPELERS_OK: namen/voorkeuren en nieuwe IDs, bron intact, geen historie/tellers, herhaling veilig, bestaande spelers beschermd, beheer/bevestiging/club/seizoen/teamnummer en dubbelzinnigheid gecontroleerd.')
