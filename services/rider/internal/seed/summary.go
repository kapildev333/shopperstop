package seed

// Summary is what `rider-admin seed-demo` prints after a load: the demo
// sign-ins and the fixed ids of PLAN.md D20. TestSummaryMatchesSeed fails when a
// line here, a seeded row or docs/postman/local.postman_environment.json drifts.
const Summary = `seed-demo: demo riders and delivery loaded (local databases only)

sign-ins (email, password, store)
  rider1-koramangala@shopperstop.local  rider12345  Koramangala
  rider2-koramangala@shopperstop.local  rider12345  Koramangala
  rider1-indiranagar@shopperstop.local  rider12345  Indiranagar
  rider2-indiranagar@shopperstop.local  rider12345  Indiranagar

fixed ids (id, table, what)
  00000000-0000-4000-8000-000000000801  riders  Arjun Rao, Koramangala (Postman riderId)
  00000000-0000-4000-8000-000000000802  riders  Meera Iyer, Koramangala
  00000000-0000-4000-8000-000000000803  riders  Kabir Shah, Indiranagar
  00000000-0000-4000-8000-000000000804  riders  Divya Nair, Indiranagar
  00000000-0000-4000-8000-000000000901  deliveries  SS-DEMOAAAB by Arjun Rao, delivered (Postman deliveryId)
`
