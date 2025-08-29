# Make evade conditional on recent damage (configurable window)

State now

- Evade behavior can trigger too broadly, not tightly coupled to actual incoming damage.
- Recent work added `killCreditWindowSeconds`; damage timing is now tracked per ship.

Expected outcome

- Evade decisions reference `ship.lastDamageTime` and only activate within `behaviorConfig.globalSettings.evadeRecentDamageWindowSeconds`.
- Default window chosen to preserve current tests; behavior is configurable.

Acceptance criteria

- Unit tests verify evasion triggers within the window and not outside it.
- No regressions in existing AI intent tests.
- Config is documented and changing it affects evasion frequency in tests.

Guidance for testing

- Add tests that apply damage to a ship, then step the sim and assert `intent === 'evade'` within the window and `!== 'evade'` after.
- Validate that unrelated ships without recent damage don’t enter evade.
