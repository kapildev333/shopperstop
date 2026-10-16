## ADDED Requirements

### Requirement: App token store
`createTokenStore(key)` from `@shopperstop/ui/app` SHALL return `{ get, set, subscribe }`. It SHALL read the token from `localStorage[key]` once at creation; `get` SHALL answer from memory (`undefined` when none); `set(token)` SHALL update memory, call every subscriber, and write the entry (`undefined` removes it). When storage throws, the store SHALL not throw and the token SHALL live in memory only. The store SHALL hold no expiry.

#### Scenario: Stored token is read at creation
- **WHEN** `localStorage` holds `shopperstop:staff-token` = `tok` and `createTokenStore('shopperstop:staff-token')` is called
- **THEN** `get()` returns `tok`

#### Scenario: Set and clear persist and notify
- **WHEN** a store for `shopperstop:customer-token` has one subscriber and `set('a')` then `set(undefined)` run
- **THEN** after the first `localStorage` holds `a` and `get()` is `a`, after the second the entry is gone and `get()` is `undefined`, and the subscriber was called twice

#### Scenario: Unsubscribed listener is not called
- **WHEN** a subscriber calls the function `subscribe` returned and then `set('a')` runs
- **THEN** the subscriber is not called

#### Scenario: Blocked storage keeps the token in memory
- **WHEN** `localStorage.getItem`, `setItem` and `removeItem` throw, a store is created, and `set('a')` runs
- **THEN** nothing throws, `get()` is `undefined` before the set and `a` after it

### Requirement: App API client
`createApiClient<Paths>({ baseUrl, session?, onUnauthorized?, failureMessage? })` SHALL return an `openapi-fetch` client on `baseUrl` that calls `globalThis.fetch` as it is at each request. With a `session` (any `{ get, set }`), every request SHALL carry `Authorization: Bearer <token>` while `session.get()` returns a token; without one, no `Authorization` header SHALL be added.

#### Scenario: Client attaches the bearer token
- **WHEN** a client on `http://localhost/api/core/v1` has a session holding `tok`, `globalThis.fetch` is replaced after the client was created, and `GET /admin/me` runs
- **THEN** the replacement receives one request to `http://localhost/api/core/v1/admin/me` with `Authorization: Bearer tok`, and the call resolves to its JSON body as `data`

#### Scenario: No session, no header
- **WHEN** a client without a session runs a request
- **THEN** the request has no `Authorization` header

#### Scenario: Empty session, no header
- **WHEN** a client's session holds no token and a request runs
- **THEN** the request has no `Authorization` header

### Requirement: Session ends only on a 401 to the current token
When a response has status 401 and its request carried `Authorization: Bearer <t>` where `t` equals `session.get()` at response time, the client SHALL call `session.set(undefined)` and then `onUnauthorized` once. A 401 to a request without a token, or with a token since replaced, and every other status SHALL leave the session alone and not call `onUnauthorized`.

#### Scenario: 401 to the current token clears it and reports the loss
- **WHEN** the session holds `tok` and the server answers the request 401 `unauthorized`
- **THEN** `session.get()` is `undefined` and `onUnauthorized` was called once

#### Scenario: 401 to a signed-out request keeps a session set meanwhile
- **WHEN** the session holds no token, the request goes out, the session is set to `fresh` before the answer, and the answer is 401
- **THEN** the request had no `Authorization` header, `session.get()` is `fresh` and `onUnauthorized` was not called

#### Scenario: 401 to a replaced token keeps the new session
- **WHEN** the session holds `old`, the request goes out, the session is set to `new` before the answer, and the answer is 401
- **THEN** `session.get()` is `new` and `onUnauthorized` was not called

#### Scenario: Other failures keep the session
- **WHEN** the session holds `tok` and the server answers 403 `forbidden`
- **THEN** `session.get()` is `tok` and `onUnauthorized` was not called

### Requirement: Failures without the error envelope become internal
A not-ok response whose JSON body lacks a string `error.code` and a string `error.message` SHALL be replaced by one with the same status, only `Content-Type: application/json`, and body `{ "error": { "code": "internal", "message": <failureMessage> } }`; `failureMessage` defaults to `The server did not answer as expected.`. Ok responses and enveloped failures SHALL pass unchanged.

#### Scenario: Plain-text 502 becomes internal
- **WHEN** a client without `failureMessage` gets a 502 with body `Bad Gateway` as `text/plain`
- **THEN** the call resolves with `response.status` 502 and `error` equal to `{ error: { code: 'internal', message: 'The server did not answer as expected.' } }`

#### Scenario: Empty failure uses the client's message
- **WHEN** a client with `failureMessage` `Could not reach ShopperStop. Try again.` gets a 503 with an empty body
- **THEN** `error.error` is `{ code: 'internal', message: 'Could not reach ShopperStop. Try again.' }` and the status is 503

#### Scenario: Enveloped failure passes unchanged
- **WHEN** the server answers 409 `{ "error": { "code": "conflict", "message": "Out of stock.", "field": "quantity" } }`
- **THEN** `error` deep-equals that body and the status is 409

#### Scenario: Bare 401 ends the session and becomes internal
- **WHEN** the session holds `tok` and the server answers 401 with no body
- **THEN** `session.get()` is `undefined`, `onUnauthorized` was called once, and `error.error.code` is `internal` with status 401

### Requirement: Relative and stamped times
`@shopperstop/ui/app` SHALL export `since(at, now)`: `just now` under one minute (or in the future), `<m> min ago` under an hour, else `<h> h <m> min ago`, in whole minutes; `when(at)`: `Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' })` of `at`; and `useSince(at)`: the text of `since(at, Date.now())`, checked every 5 seconds.

#### Scenario: Relative times in whole minutes
- **WHEN** `since` runs with `at` = `2026-10-13T09:00:00Z` and `now` 59 s, 12 min 30 s and 75 min later, and 2 min earlier
- **THEN** it returns `just now`, `12 min ago`, `1 h 15 min ago` and `just now`

#### Scenario: Stamp in the stores' time zone
- **WHEN** `when('2026-10-13T09:20:00Z')` runs
- **THEN** it returns `13 Oct 2026, 2:50 pm`

#### Scenario: useSince keeps its text current
- **WHEN** a component renders `useSince(at)` with the clock at `at`, and the fake clock then advances 60 s with its timers
- **THEN** the component shows `just now` and then `1 min ago`

### Requirement: App entry
`packages/ui/package.json` SHALL export `./app` as `{ types: "./dist/app/index.d.ts", default: "./dist/app/index.js" }` and list `openapi-fetch` `0.17.0` under `peerDependencies` and `devDependencies`; every other entry SHALL be unchanged. The entry SHALL export `createTokenStore`, `createApiClient`, `since`, `useSince` and `when`, and import no CSS.

#### Scenario: Package exports the app entry
- **WHEN** `packages/ui/package.json` is read
- **THEN** `exports["./app"]` is `{ types: './dist/app/index.d.ts', default: './dist/app/index.js' }`, `peerDependencies["openapi-fetch"]` and `devDependencies["openapi-fetch"]` are `0.17.0`, and `exports["."]`, `["./format"]` and `["./tokens"]` are as before

#### Scenario: Entry exports the shared helpers
- **WHEN** `src/app/index.ts` is imported and its source read
- **THEN** `createTokenStore`, `createApiClient`, `since`, `useSince` and `when` are functions, and no line imports a `.css` file
