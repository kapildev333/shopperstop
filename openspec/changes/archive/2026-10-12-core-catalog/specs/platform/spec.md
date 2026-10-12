## ADDED Requirements

### Requirement: Files directory is configured
The core service SHALL read `SHOPPERSTOP_CORE_FILES_DIR`, the directory that holds uploaded and demo images, as required configuration and refuse to start without it, naming it with every other missing variable.

#### Scenario: Files directory unset
- **WHEN** the service starts with `SHOPPERSTOP_CORE_FILES_DIR` unset
- **THEN** it refuses to start with a message that names `SHOPPERSTOP_CORE_FILES_DIR`
