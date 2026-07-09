# profile-edit-page Specification

## Purpose

Editable profile form for logged-in users at `/profile/edit`. Pre-populated with placeholder user data. Client-side validation only — no backend mutations in this iteration.

## Requirements

### Requirement: Profile Edit Route

The system **MUST** render the edit profile form at `/profile/edit` using a `"use client"` component. The page **MUST** set `<title>Editar perfil — Dominó Occidental</title>`.

#### Scenario: Form renders pre-populated

- GIVEN the user navigates to `/profile/edit`
- WHEN the component loads
- THEN the form SHALL display with the user's username, country, and preferences pre-filled from `DEMO_PROFILE`

#### Scenario: No dynamic parameter

- GIVEN the route is `/profile/edit`
- THEN it SHALL NOT accept a `[username]` parameter
- AND it SHALL always edit the authenticated user

### Requirement: Header and Back Navigation

The page **MUST** display a header with "Editar perfil" title and a back arrow linking to `/profile/[username]`.

#### Scenario: Back link navigates to profile

- GIVEN the user is on `/profile/edit`
- WHEN they click the back arrow
- THEN they SHALL be navigated to `/profile/[username]`

### Requirement: Avatar Section

The system **MUST** show a current avatar preview (large circle with initials), a "Cambiar foto" button, and a hidden `<input type="file" accept="image/*">` that opens on button click. Upload **MUST NOT** be implemented — selection does nothing.

#### Scenario: Avatar renders with initials

- GIVEN the edit form loads
- WHEN the avatar section renders
- THEN a large circle with the user's initials SHALL display

#### Scenario: File dialog opens on click

- GIVEN the avatar section is displayed
- WHEN the user clicks "Cambiar foto"
- THEN the hidden file input dialog SHALL open
- AND no upload or preview SHALL occur

### Requirement: Username Field

The system **MUST** provide an editable username input pre-filled with the current value. The system **MUST** validate the field: 3–20 characters, alphanumeric only.

#### Scenario: Valid username saves

- GIVEN the username contains 3–20 alphanumeric characters
- WHEN the user clicks "Guardar cambios"
- THEN no validation error SHALL appear

#### Scenario: Invalid username blocked

- GIVEN the username is shorter than 3 characters, longer than 20, or contains special characters
- WHEN the user clicks "Guardar cambios"
- THEN an inline error SHALL display
- AND the form SHALL NOT show success

### Requirement: Country Select

The system **MUST** provide a `<select>` dropdown with ISO country codes (AR, BO, BR, CL, CO, CR, DO, EC, ES, MX, PA, PE, PY, UY, US, VE). Each option **MUST** display in `XX (CountryName)` format. The current country **MUST** be pre-selected.

#### Scenario: Country dropdown renders

- GIVEN the edit form loads
- WHEN the user views the "País" field
- THEN a select dropdown with all 16 countries SHALL render in "AR (Argentina)" format
- AND the user's current country SHALL be pre-selected

### Requirement: Display Preferences

The system **MUST** provide two toggle controls: "Mostrar ELO en el perfil" and "Recibir notificaciones de torneos". Both **MUST** default to ON.

#### Scenario: Toggles render with defaults

- GIVEN the edit form loads
- WHEN the preferences section renders
- THEN both toggles SHALL default to ON

### Requirement: Save and Cancel Actions

The system **MUST** provide a gradient "Guardar cambios" button and a "Cancelar" link. On save, an inline success message SHALL display. No data **MUST** be persisted to the backend.

#### Scenario: Save shows success feedback

- GIVEN all fields are valid
- WHEN the user clicks "Guardar cambios"
- THEN an inline green message SHALL display: "Cambios guardados correctamente"
- AND no API call or mutation SHALL occur

#### Scenario: Cancel navigates back

- GIVEN the user is on `/profile/edit`
- WHEN they click "Cancelar"
- THEN they SHALL be navigated to `/profile/[username]`

### Requirement: Design Consistency

The page **SHOULD** use design tokens matching existing pages: container `mx-auto max-w-2xl space-y-8 px-4 py-6`, cards `rounded-2xl border border-domino-700/50 bg-domino-900/60`, inputs `rounded-lg border border-domino-700 bg-domino-800/50`, CTA `rounded-xl bg-linear-to-r from-gold-500 to-gold-600`.
