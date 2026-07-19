# Leave-Match Modal Specification

## Purpose

Confirmation dialog that prevents accidental match abandonment. Requires explicit user confirmation before sending a `leave` WebSocket message to the server.

## Requirements

### Requirement: Modal Display

The system MUST render a confirmation modal when the user activates the leave-match action. The modal SHALL use the same visual pattern as `HandOverModal` (fixed overlay + backdrop blur + rounded card).

#### Scenario: Modal opens on leave button click

- GIVEN the user is in an active match
- WHEN the user clicks the "Leave Match" button
- THEN a confirmation modal appears with title "Leave Match?"
- AND the body reads "Are you sure you want to leave the match? This will end the game for all players."
- AND two buttons are visible: "Cancel" and "Leave Match"

#### Scenario: Leave Match button is visually destructive

- GIVEN the modal is open
- THEN the "Leave Match" button SHALL use a red/destructive color style
- AND the "Cancel" button SHALL use the default/neutral style

### Requirement: Modal Accessibility

The modal MUST be fully accessible per WAI-ARIA dialog patterns.

#### Scenario: Focus is trapped inside modal

- GIVEN the modal is open
- WHEN the user presses Tab
- THEN focus cycles through interactive elements within the modal only
- AND focus does not escape to elements behind the overlay

#### Scenario: Escape closes modal

- GIVEN the modal is open
- WHEN the user presses Escape
- THEN the modal closes
- AND no leave message is sent

#### Scenario: ARIA attributes are set

- GIVEN the modal is rendered
- THEN the overlay container SHALL have `role="dialog"` and `aria-modal="true"`
- AND the title element SHALL be referenced by `aria-labelledby`

### Requirement: Confirm Leave Flow

The system MUST send a `leave` WebSocket message only after explicit user confirmation.

#### Scenario: Confirm sends leave message

- GIVEN the modal is open
- WHEN the user clicks "Leave Match"
- THEN the modal closes
- AND `{ type: "leave" }` is sent via the WebSocket connection
- AND the client waits for a `match_abandoned` event from the server

#### Scenario: Cancel closes modal without action

- GIVEN the modal is open
- WHEN the user clicks "Cancel"
- THEN the modal closes
- AND no WebSocket message is sent

### Requirement: Duplicate Click Prevention

The system MUST prevent multiple concurrent leave requests.

#### Scenario: Second click on Leave Match is ignored

- GIVEN the user clicked "Leave Match" and the modal closed
- WHEN the user activates leave again before `match_abandoned` arrives
- THEN the modal opens again normally
- AND a second `leave` message is sent (idempotent on server)

### Requirement: Post-Confirmation Redirect

The system MUST redirect to the lobby after the server confirms abandonment.

#### Scenario: match_abandoned triggers redirect

- GIVEN the client sent `{ type: "leave" }`
- WHEN a `match_abandoned` event is received
- THEN the client navigates to the lobby

#### Scenario: Timeout fallback if event never arrives

- GIVEN the client sent `{ type: "leave" }`
- WHEN no `match_abandoned` event arrives within 5 seconds
- THEN the client navigates to the lobby anyway
