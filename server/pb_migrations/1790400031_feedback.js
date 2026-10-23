// Feedback staat los van teams; uitsluitend de eigen routes geven toegang.
migrate(app => {
  const locked = { listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null }
  const feedback = new Collection({
    ...locked, type: 'base', name: 'feedback',
    fields: [
      { type: 'select', name: 'app', values: ['website', 'hockey', 'finance', 'finance-web'], maxSelect: 1, required: true },
      { type: 'text', name: 'bericht', required: true, max: 5000 },
      { type: 'text', name: 'naam', max: 100 },
      { type: 'email', name: 'email' },
      { type: 'text', name: 'inzending', required: true, max: 80, hidden: true },
      { type: 'bool', name: 'afgehandeld' },
      { type: 'autodate', name: 'created', onCreate: true },
      { type: 'autodate', name: 'updated', onCreate: true, onUpdate: true },
    ], indexes: ['CREATE UNIQUE INDEX idx_feedback_inzending ON feedback (inzending)'],
  })
  app.save(feedback)
  app.save(new Collection({
    ...locked, type: 'base', name: 'feedback_mail',
    fields: [
      { type: 'relation', name: 'feedback', collectionId: feedback.id, required: true, maxSelect: 1, cascadeDelete: true },
      { type: 'select', name: 'soort', values: ['melding', 'bevestiging'], required: true, maxSelect: 1 },
      { type: 'select', name: 'status', values: ['wacht', 'bezig', 'verzonden', 'fout'], required: true, maxSelect: 1 },
      { type: 'number', name: 'pogingen', min: 0 },
      { type: 'date', name: 'probeerOp' },
      { type: 'date', name: 'verzondenOp' },
      { type: 'autodate', name: 'created', onCreate: true },
      { type: 'autodate', name: 'updated', onCreate: true, onUpdate: true },
    ], indexes: ['CREATE INDEX idx_feedback_mail_status ON feedback_mail (status, probeerOp)'],
  }))
  app.save(new Collection({
    ...locked, type: 'base', name: 'feedback_limieten',
    fields: [
      { type: 'text', name: 'bezoeker', required: true, hidden: true },
      { type: 'text', name: 'contact', hidden: true },
      { type: 'autodate', name: 'created', onCreate: true },
    ], indexes: ['CREATE INDEX idx_feedback_limieten_created ON feedback_limieten (created)'],
  }))
}, () => { throw new Error('Feedback niet automatisch wissen; herstel via gecontroleerde back-up') })
