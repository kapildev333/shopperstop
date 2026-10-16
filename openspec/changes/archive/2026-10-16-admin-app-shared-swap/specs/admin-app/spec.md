## MODIFIED Requirements

### Requirement: Failure answers without core's error body
The app's client SHALL give every caller an error for any answer with a failure status, also when the body is empty or is not core's error envelope (`error.code` and `error.message`, both strings): the caller SHALL then get code `internal` with the answer's status. A failure carrying core's envelope and every success, with or without a body, SHALL reach the caller unchanged. A 401 to the current token SHALL end the session whatever its body.

#### Scenario: Failure without core's error body
- **WHEN** a request is answered 502 with no body, with an empty body and `Content-Length: 0`, with the plain text "Bad Gateway", or with JSON that is not core's envelope
- **THEN** the caller gets no data, an error with code `internal`, and the status 502, and the session is kept

#### Scenario: Envelope without a message
- **WHEN** a request is answered 502 with `{"error":{"code":"bad_gateway"}}`
- **THEN** the caller gets no data, an error with code `internal` and message "The server did not answer as expected.", and the status 502

#### Scenario: Core's error passes through
- **WHEN** a request is answered 400 with core's envelope `validation` naming `lowStock`
- **THEN** the caller gets exactly that error, code, message and field, with status 400

#### Scenario: Success without a body
- **WHEN** a request is answered 204
- **THEN** the caller gets no error and the status 204

#### Scenario: 401 without core's error body
- **WHEN** a request carrying the current token is answered 401 with no body
- **THEN** the session is cleared, its loss is reported once, and the caller gets an error with code `internal` and status 401
