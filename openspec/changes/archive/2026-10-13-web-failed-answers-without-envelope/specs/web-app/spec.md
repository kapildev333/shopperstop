## ADDED Requirements

### Requirement: Customer failed answers without the error envelope
The customer site's client SHALL treat every answer from core with a status outside 200 to 299 as a failure. When the body of such an answer is not core's error envelope (`error.code` and `error.message`, both strings), the response middleware SHALL hand it on with the same status and the body `{"error":{"code":"internal","message":"Could not reach ShopperStop. Try again."}}`. A failed answer with the envelope, and every answer with a status in 200 to 299, SHALL be handed on unchanged.

#### Scenario: Empty failed answer becomes internal
- **WHEN** the client's response middleware sees a 502 response with an empty body
- **THEN** it hands on a response with status 502 whose JSON body is `{"error":{"code":"internal","message":"Could not reach ShopperStop. Try again."}}`

#### Scenario: HTML failed answer becomes internal
- **WHEN** the response middleware sees a 502 response with the body `<html><body>Bad Gateway</body></html>`
- **THEN** it hands on a response with status 502 whose JSON body is the `internal` envelope

#### Scenario: Other JSON failed answer becomes internal
- **WHEN** the response middleware sees a 500 response with the body `{"message":"x"}`
- **THEN** it hands on a response with status 500 whose JSON body is the `internal` envelope

#### Scenario: Enveloped failure passes through
- **WHEN** the response middleware sees a 409 response with the body `{"error":{"code":"conflict","message":"Email already registered","field":"email"}}`
- **THEN** it hands on that same response, and its body can still be read and equals what core sent

#### Scenario: Bare 401 drops the session and becomes internal
- **WHEN** the store holds a token and the response middleware sees a 401 response with no body
- **THEN** the store holds no token, and the response handed on has status 401 and the `internal` envelope

#### Scenario: No content answer untouched
- **WHEN** the response middleware sees a 204 response
- **THEN** it hands on that same response, with status 204 and an empty body

#### Scenario: Ok JSON answer untouched
- **WHEN** the response middleware sees a 200 response with the body `{"items":[]}`
- **THEN** it hands on that same response, and its body can still be read and equals `{"items":[]}`

#### Scenario: Failed write reports an error
- **WHEN** an `openapi-fetch` client that uses the site's middleware sends `PATCH /me`, the network answers 502 with an empty body, and the request runs through `call()`
- **THEN** `call()` resolves to `{ code: 'internal', message: 'Could not reach ShopperStop. Try again.' }`, not to `undefined`
