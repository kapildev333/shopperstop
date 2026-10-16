## MODIFIED Requirements

### Requirement: Customer session token
The customer site SHALL keep the session token returned by `POST /auth/sign-in` (or register) in memory and in `localStorage` under `shopperstop:customer-token`, SHALL read it from `localStorage` when the app loads, and SHALL attach it as `Authorization: Bearer <token>` to every core request while it is held. The token SHALL be removed from memory and `localStorage` on sign-out and when core answers with status 401 a request that carried the token held when the answer arrives; a 401 to a request sent with another token or none SHALL leave the held token in place. No cookie SHALL be set or read.

#### Scenario: Token persisted and cleared
- **WHEN** the session store is given the token `t-1` and later cleared
- **THEN** `localStorage` `shopperstop:customer-token` is `t-1` in between, and afterwards the key is absent and the store holds no token

#### Scenario: Token restored on load
- **WHEN** `localStorage` holds `shopperstop:customer-token` = `t-2` before the session store module loads
- **THEN** the store holds `t-2`

#### Scenario: Bearer attached
- **WHEN** the store holds `t-3` and the site's client sends `GET /me`
- **THEN** the request to `/api/core/v1/me` carries the header `Authorization: Bearer t-3`

#### Scenario: Expired session dropped
- **WHEN** the store holds a token and core answers 401 to a request the site's client sent with it
- **THEN** the store holds no token, `localStorage` has no `shopperstop:customer-token`, and the next request carries no `Authorization` header

#### Scenario: Stale 401 keeps the newer session
- **WHEN** the store holds `t-old`, the site's client sends `GET /me` with it, the store is given `t-new` before the answer arrives, and core answers 401
- **THEN** the store holds `t-new` and `localStorage` `shopperstop:customer-token` is `t-new`

### Requirement: Customer failed answers without the error envelope
The customer site's client SHALL treat every answer from core with a status outside 200 to 299 as a failure. When the body of such an answer is not core's error envelope (`error.code` and `error.message`, both strings), the client SHALL hand it on with the same status and the body `{"error":{"code":"internal","message":"Could not reach ShopperStop. Try again."}}`. A failed answer with the envelope, and every answer with a status in 200 to 299, SHALL be handed on unchanged.

#### Scenario: Empty failed answer becomes internal
- **WHEN** core answers the client's request 502 with an empty body
- **THEN** the client hands on status 502 and the error `{"error":{"code":"internal","message":"Could not reach ShopperStop. Try again."}}`

#### Scenario: HTML failed answer becomes internal
- **WHEN** core answers 502 with the body `<html><body>Bad Gateway</body></html>`
- **THEN** the client hands on status 502 and the `internal` envelope

#### Scenario: Other JSON failed answer becomes internal
- **WHEN** core answers 500 with the body `{"message":"x"}`
- **THEN** the client hands on status 500 and the `internal` envelope

#### Scenario: Enveloped failure passes through
- **WHEN** core answers 409 with the body `{"error":{"code":"conflict","message":"Email already registered","field":"email"}}`
- **THEN** the client hands on status 409 and an error equal to what core sent

#### Scenario: Bare 401 drops the session and becomes internal
- **WHEN** the store holds a token and core answers 401 with no body to a request the client sent with it
- **THEN** the store holds no token, and the client hands on status 401 and the `internal` envelope

#### Scenario: No content answer untouched
- **WHEN** core answers 204
- **THEN** the client hands on status 204, an empty body and no error

#### Scenario: Ok JSON answer untouched
- **WHEN** core answers 200 with the body `{"items":[]}`
- **THEN** the client hands on status 200 and the data `{"items":[]}`

#### Scenario: Failed write reports an error
- **WHEN** the site's client sends `PATCH /me`, the network answers 502 with an empty body, and the request runs through `call()`
- **THEN** `call()` resolves to `{ code: 'internal', message: 'Could not reach ShopperStop. Try again.' }`, not to `undefined`
