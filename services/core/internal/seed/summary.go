package seed

// Summary is what `core-admin seed-demo` prints after a load: the demo
// sign-ins of Spec 2 §11 and the fixed ids of PLAN.md D20. It is the one place
// they are documented. docs/postman/local.postman_environment.json carries the
// four ids marked "Postman"; TestSummaryMatchesSeed fails when a line here, a
// seeded row or that file drifts from the others.
const Summary = `seed-demo: demo data loaded (local databases only)

sign-ins (email, password, role)
  admin@shopperstop.local        admin12345  admin
  koramangala@shopperstop.local  staff12345  store_staff
  indiranagar@shopperstop.local  staff12345  store_staff
  demo@shopperstop.local         demo12345   customer

fixed ids (id, table, what)
  00000000-0000-4000-8000-000000000101  staff_users  admin
  00000000-0000-4000-8000-000000000102  staff_users  Koramangala store staff
  00000000-0000-4000-8000-000000000103  staff_users  Indiranagar store staff
  00000000-0000-4000-8000-000000000201  customers    demo customer
  00000000-0000-4000-8000-000000000301  addresses    Home, 560034, default (Postman addressId)
  00000000-0000-4000-8000-000000000302  addresses    Work, 560038
  00000000-0000-4000-8000-000000000401  stores       Koramangala, serves 560034 and 560095 (Postman storeId)
  00000000-0000-4000-8000-000000000402  stores       Indiranagar, serves 560038 and 560008
  00000000-0000-4000-8000-000000000601  products     Banana Robusta, first of 148: ...0601 to ...0694, hex (Postman productId)
  00000000-0000-4000-8000-000000000701  orders       SS-DEMOAAAB, delivered
  00000000-0000-4000-8000-000000000702  orders       SS-DEMOAAAC, cancelled
  00000000-0000-4000-8000-000000000703  orders       SS-DEMOAAAD, placed (Postman orderId)
  00000000-0000-4000-8000-000000000704  orders       SS-DEMOAAAE, placed, paid online (reference fake_demo_0a01)
`
