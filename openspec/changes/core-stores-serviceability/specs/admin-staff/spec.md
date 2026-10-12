## ADDED Requirements

### Requirement: Store staff belong to an existing store
Creating a store-staff user whose `storeId` names no store SHALL answer 400 `validation` with field `storeId` and create nothing.

#### Scenario: Unknown store
- **WHEN** an admin creates a `store_staff` user with `storeId` `00000000-0000-4000-8000-000000000000` and no such store exists
- **THEN** the response is 400 with code `validation` and field `storeId`

### Requirement: Demo store staff
`core-admin seed-demo --reset` SHALL also leave the active store-staff users `koramangala@shopperstop.local` (id `00000000-0000-4000-8000-000000000102`, store `00000000-0000-4000-8000-000000000401`) and `indiranagar@shopperstop.local` (id `00000000-0000-4000-8000-000000000103`, store `00000000-0000-4000-8000-000000000402`), both with password `staff12345`.

#### Scenario: Store staff signs in after reset
- **WHEN** `seed-demo --reset` has run and `koramangala@shopperstop.local` signs in at `/admin/auth/sign-in` with `staff12345`
- **THEN** the response is 200 with `staff.role` `store_staff` and `staff.storeId` `00000000-0000-4000-8000-000000000401`
