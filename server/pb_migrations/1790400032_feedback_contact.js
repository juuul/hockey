// Contactaanvragen gebruiken dezelfde afgeschermde opslag en mailwachtrij.
migrate(app => {
  const c = app.findCollectionByNameOrId('feedback')
  const veld = c.fields.getByName('app')
  veld.values = ['website', 'hockey', 'finance', 'finance-web', 'contact']
  app.save(c)
}, () => { throw new Error('Contactaanvragen niet automatisch wissen; herstel via gecontroleerde back-up') })
