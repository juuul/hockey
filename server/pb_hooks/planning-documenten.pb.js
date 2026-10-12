routerAdd("GET", "/api/hockey/planning/documenten", e => {
  if (!e.auth || e.auth.collection().name !== "users" || !e.auth.getBool("superadmin")) throw new ForbiddenError("Alleen superadmins")
  try { return e.json(200, JSON.parse(toString($os.readFile("/pb/planning_documenten/status.json")))) }
  catch (_) { return e.json(200, { bijgewerkt: null, documenten: [], wachtendeMails: 0 }) }
})
