// Lokale CLI-testhook, alleen toevoegen aan een tijdelijke hooksmap van de testserver.
$app.rootCmd.addCommand(new Command({use:"test-google-reis",run:()=>{
 if($os.getenv("HOCKEY_ENV")!=="test")throw new Error("Alleen test")
 const h=require(`${__hooks}/reizen.js`)
 const check=(v,m)=>{if(!v)throw new Error(m)}
 let gezien=false
 const minuten=h.haalReistijd(" Voorbeeldclub "," Voorbeeld sporthal ","fictieve-testwaarde",c=>{
  const b=JSON.parse(c.body)
  check(c.url==="https://routes.googleapis.com/directions/v2:computeRoutes","URL onjuist")
  check(c.headers["X-Goog-FieldMask"]==="routes.duration","Veldmasker onjuist")
  check(b.origin.address==="Voorbeeldclub"&&b.destination.address==="Voorbeeld sporthal"&&b.travelMode==="DRIVE","Route onjuist")
  gezien=true;return {statusCode:200,json:{routes:[{duration:"2100.1s"}]}}
 })
 check(gezien&&minuten===40,"Reistijd/afronding onjuist")
 for(const antwoord of [{statusCode:403,json:{}},{statusCode:200,json:{routes:[]}},{statusCode:200,json:{routes:[{duration:"onbekend"}]}}]){
  let geweigerd=false;try{h.haalReistijd("Club","Hal","fictieve-testwaarde",()=>antwoord)}catch(_){geweigerd=true}
  check(geweigerd,"Foutantwoord geaccepteerd")
 }
 console.log("GOOGLE_REIS_TEST_OK: verzoek, afronding, afwijzing, ontbrekende route en ongeldige duur")
}}))
