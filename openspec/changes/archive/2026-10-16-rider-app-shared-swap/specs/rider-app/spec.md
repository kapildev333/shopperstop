## ADDED Requirements

### Requirement: Rider failure answers without an error envelope
A not-ok answer to a rider service or core request whose JSON body lacks a string `error.code` and a string `error.message` (an empty or plain-text proxy 502, for example) SHALL reach the page as the error `{ code: "internal", message: "The server did not answer as expected." }` with the answer's status kept, and SHALL leave the token unchanged unless it is a 401 to the current token.

#### Scenario: A failure answer without an envelope reaches the caller as internal
- **WHEN** the rider service answers `GET /me` with 502 and no body, a plain-text body, or a JSON body `{"error":{"code":"bad_gateway"}}` while token `tok` is stored
- **THEN** the caller gets no data, the error `{ error: { code: "internal", message: "The server did not answer as expected." } }` and status 502, and the token is still `tok`

## MODIFIED Requirements

### Requirement: Rider lost session
When a rider service request that carried the current token is answered 401, the app SHALL remove the token from memory and storage and show `/sign-in?redirect=<current path>`; a 401 to a request without a token or with a token since replaced SHALL change nothing. When `GET /me` fails otherwise, the app SHALL keep the token and show the alert "Could not reach the server." with a "Try again" button.

#### Scenario: Expired session on load
- **WHEN** the app opens `/history` with a stored token and the service answers `GET /me` with 401
- **THEN** the sign-in page shows with `redirect` `/history` and the token is gone

#### Scenario: 401 mid-session returns to sign-in
- **WHEN** a signed-in rider opens `/history`, `GET /me` succeeds and the service answers the history read with 401
- **THEN** the sign-in page shows with `redirect` `/history` and the token is gone from memory and storage

#### Scenario: 401 to a replaced token keeps the new session
- **WHEN** a request sent with token `old` is answered 401 after token `new` was stored meanwhile
- **THEN** the token is still `new` in memory and storage

#### Scenario: Service unreachable on load
- **WHEN** the app opens `/` with a stored token and the service answers `GET /me` with 502
- **THEN** the alert "Could not reach the server." shows with a "Try again" button and the token is kept
