# Model Effort Workflow

Use this workflow to recommend the lowest adequate Codex effort setting for a
task and to reassess when the work changes shape.

## Capability Boundary

The agent may assess and recommend effort, but must not claim it changed the
active setting unless the current environment exposes an explicit control and
the change succeeds.

If the active setting is not visible, say it is unknown rather than guessing.
Available effort levels may vary by model and Codex surface.

## Top-Line Recommendation

For substantial new tasks, begin the first user-facing response with one concise
line:

> Effort recommendation: Medium - this is a scoped implementation task with
> contained verification.

Recommend the lowest adequate level for the current task. Reassess instead of
carrying a previous task's recommendation forward automatically. If the known
active setting is materially mismatched, pause at a safe boundary and ask the
user to change or explicitly retain it before substantive work continues.

Do not inflate mechanical work merely to force an effort change, and do not
delay low-risk work when the current known setting is adequate.

## Effort Guide

### Low

Use for precise, reversible, mechanical work such as:

- small copy or formatting edits;
- narrow documentation changes;
- known-value configuration updates;
- established verification commands;
- simple file moves or renames.

### Medium

Use for normal scoped implementation with agreed requirements and direction:

- a well-defined component, API route, utility, or config change;
- routine dependency, lint, or build setup updates;
- tests or verification for understood behavior;
- contained refactoring within established project patterns;
- debugging with a small reproducible search space.

Medium is the default for ordinary implementation after scope is understood.

### High

Use when work requires substantial judgment, synthesis, or investigation:

- architecture or data-flow design;
- wallet authentication, authorization, or membership-gating changes;
- secrets, storage, uploads, signed URLs, or external API trust boundaries;
- migrations or difficult-to-reverse dependency changes;
- unfamiliar integrations;
- complex debugging across wallet, API, storage, and build systems;
- final review of consequential work.

### XHigh

Reserve for unusually ambiguous or consequential work with high rework cost:

- several interacting foundational uncertainties;
- intermittent failures that remain after normal investigation;
- security-critical design across multiple trust boundaries;
- a foundational decision that constrains many later changes.

Do not recommend XHigh merely because a task is large. Break large but
straightforward work into smaller tasks first. XHigh may not be available for
every model.

## When To Reassess

Reassess when:

- the goal or scope changes materially;
- mechanical work exposes an architectural decision;
- debugging crosses systems or repeated attempts fail;
- sensitive data, destructive operations, authentication, or security enters
  scope;
- work moves from planning to implementation;
- work moves from implementation to final review.

A task-type change does not automatically require a setting change. Recommend a
switch only when the current effort is materially mismatched.

## Switching Protocol

When a switch matters:

1. Pause at a safe boundary.
2. State the current setting if known.
3. Name the recommended setting.
4. Give one reason tied to risk or complexity.
5. Wait for the user to change or explicitly retain the setting.
6. Rebuild context if the switch requires a new session.

Never use higher effort as a substitute for clarifying the goal, reducing scope,
or creating a testable plan.
