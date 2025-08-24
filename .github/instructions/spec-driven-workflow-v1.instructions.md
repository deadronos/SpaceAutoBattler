---
description: 'Specification-Driven Workflow v1 provides a structured approach to software development, ensuring that requirements are clearly defined, designs are meticulously planned, and implementations are thoroughly documented and validated.'
applyTo: '**'
---

# Spec-Driven Workflow — Quick Loop

Receipt: "Follow a 6-phase spec-driven loop: Analyze → Design → Implement → Validate → Reflect → Handoff."

6-phase micro-plan (one sentence each):
- Analyze: gather facts, write 2–5 EARS-style requirements.  
- Design: write a short design (diagram + interfaces) and tasks list.  
- Implement: small commits, tests, and update tasks.md as you go.  
- Validate: run automated tests, manual checks, and performance verifications.  
- Reflect: refactor, update docs, and record technical debt.  
- Handoff: prepare PR with executive summary, changelog, tests, and artifacts.

Quick templates
- Requirement (EARS): WHEN <event>, THE SYSTEM SHALL <behavior> [Acceptance: how to test].
- PR summary (3 lines): 1) Goal: <one-line> 2) Key changes: <files/functions> 3) Validation: <tests/metrics>. Attach decision records if any.

Minimal acceptance checklist before merge:
- [ ] 2–5 testable requirements written.  
- [ ] Design doc linked in PR.  
- [ ] Tests for each requirement (unit/integration).  
- [ ] Performance baseline if applicable.  
- [ ] Decision records for non-trivial trade-offs.  
- [ ] Exec summary and streamlined action log included.

If blocked: re-run Analyze → adjust Confidence Score → pick PoC if medium/low confidence.

End.

- Create a comprehensive technical design and a detailed implementation plan.

**Checklist:**

- [ ] **Define adaptive execution strategy based on Confidence Score:**
  - **High Confidence (>85%)**
    - Draft a comprehensive, step-by-step implementation plan.
    - Skip proof-of-concept steps.
    - Proceed with full, automated implementation.
    - Maintain standard comprehensive documentation.
  - **Medium Confidence (66–85%)**
    - Prioritize a **Proof-of-Concept (PoC)** or **Minimum Viable Product (MVP)**.
    - Define clear success criteria for PoC/MVP.
    - Build and validate PoC/MVP first, then expand plan incrementally.
    - Document PoC/MVP goals, execution, and validation results.
  - **Low Confidence (<66%)**
    - Dedicate first phase to research and knowledge-building.
    - Use semantic search and analyze similar implementations.
    - Synthesize findings into a research document.
    - Re-run ANALYZE phase after research.
    - Escalate only if confidence remains low.

- [ ] **Document technical design in `design.md`:**
  - **Architecture:** High-level overview of components and interactions.
  - **Data Flow:** Diagrams and descriptions.
  - **Interfaces:** API contracts, schemas, public-facing function signatures.
  - **Data Models:** Data structures and database schemas.

- [ ] **Document error handling:**
  - Create an error matrix with procedures and expected responses.

- [ ] **Define unit testing strategy.**

- [ ] **Create implementation plan in `tasks.md`:**
  - For each task, include description, expected outcome, and dependencies.

**Critical Constraint:**

- **Do not proceed to implementation until design and plan are complete and validated.**

### **Phase 3: IMPLEMENT**

**Objective:**

- Write production-quality code according to the design and plan.

**Checklist:**

- [ ] Code in small, testable increments.
      - Document each increment with code changes, results, and test links.
- [ ] Implement from dependencies upward.
      - Document resolution order, justification, and verification.
- [ ] Follow conventions.
      - Document adherence and any deviations with a Decision Record.
- [ ] Add meaningful comments.
      - Focus on intent ("why"), not mechanics ("what").
- [ ] Create files as planned.
      - Document file creation log.
- [ ] Update task status in real time.

**Critical Constraint:**

- **Do not merge or deploy code until all implementation steps are documented and tested.**

### **Phase 4: VALIDATE**

**Objective:**

- Verify that implementation meets all requirements and quality standards.

**Checklist:**

- [ ] Execute automated tests.
      - Document outputs, logs, and coverage reports.
      - For failures, document root cause analysis and remediation.
- [ ] Perform manual verification if necessary.
      - Document procedures, checklists, and results.
- [ ] Test edge cases and errors.
      - Document results and evidence of correct error handling.
- [ ] Verify performance.
      - Document metrics and profile critical sections.
- [ ] Log execution traces.
      - Document path analysis and runtime behavior.

**Critical Constraint:**

- **Do not proceed until all validation steps are complete and all issues are resolved.**

### **Phase 5: REFLECT**

**Objective:**

- Improve codebase, update documentation, and analyze performance.

**Checklist:**

- [ ] Refactor for maintainability.
      - Document decisions, before/after comparisons, and impact.
- [ ] Update all project documentation.
      - Ensure all READMEs, diagrams, and comments are current.
- [ ] Identify potential improvements.
      - Document backlog with prioritization.
- [ ] Validate success criteria.
      - Document final verification matrix.
- [ ] Perform meta-analysis.
      - Reflect on efficiency, tool usage, and protocol adherence.
- [ ] Auto-create technical debt issues.
      - Document inventory and remediation plans.

**Critical Constraint:**

- **Do not close the phase until all documentation and improvement actions are logged.**

### **Phase 6: HANDOFF**

**Objective:**

- Package work for review and deployment, and transition to next task.

**Checklist:**

- [ ] Generate executive summary.
      - Use **Compressed Decision Record** format.
- [ ] Prepare pull request (if applicable):
    1. Executive summary.
    2. Changelog from **Streamlined Action Log**.
    3. Links to validation artifacts and Decision Records.
    4. Links to final `requirements.md`, `design.md`, and `tasks.md`.
- [ ] Finalize workspace.
      - Archive intermediate files, logs, and temporary artifacts to `.agent_work/`.
- [ ] Continue to next task.
      - Document transition or completion.

**Critical Constraint:**

- **Do not consider the task complete until all handoff steps are finished and documented.**

## Troubleshooting & Retry Protocol

**If you encounter errors, ambiguities, or blockers:**

**Checklist:**

1. **Re-analyze**:
   - Revisit the ANALYZE phase.
   - Confirm all requirements and constraints are clear and complete.
2. **Re-design**:
   - Revisit the DESIGN phase.
   - Update technical design, plans, or dependencies as needed.
3. **Re-plan**:
   - Adjust the implementation plan in `tasks.md` to address new findings.
4. **Retry execution**:
   - Re-execute failed steps with corrected parameters or logic.
5. **Escalate**:
   - If the issue persists after retries, follow the escalation protocol.

**Critical Constraint:**

- **Never proceed with unresolved errors or ambiguities. Always document troubleshooting steps and outcomes.**

## Technical Debt Management (Automated)

### Identification & Documentation

- **Code Quality**: Continuously assess code quality during implementation using static analysis.
- **Shortcuts**: Explicitly record all speed-over-quality decisions with their consequences in a Decision Record.
- **Workspace**: Monitor for organizational drift and naming inconsistencies.
- **Documentation**: Track incomplete, outdated, or missing documentation.

### Auto-Issue Creation Template

```text
**Title**: [Technical Debt] - [Brief Description]
---
description: 'Spec-driven workflow — condensed 6-phase checklist + PR/requirement templates (Cookbook style).'
applyTo: '**'
---

# Spec-Driven Workflow — Quick Loop

Receipt: "Follow a 6-phase spec-driven loop: Analyze → Design → Implement → Validate → Reflect → Handoff."

6-phase micro-plan (one sentence each):
- Analyze: gather facts, write 2–5 EARS-style requirements.  
- Design: write a short design (diagram + interfaces) and tasks list.  
- Implement: small commits, tests, and update tasks.md as you go.  
- Validate: run automated tests, manual checks, and performance verifications.  
- Reflect: refactor, update docs, and record technical debt.  
- Handoff: prepare PR with executive summary, changelog, tests, and artifacts.

Quick templates
- Requirement (EARS): WHEN <event>, THE SYSTEM SHALL <behavior> [Acceptance: how to test].
- PR summary (3 lines): 1) Goal: <one-line> 2) Key changes: <files/functions> 3) Validation: <tests/metrics>. Attach decision records if any.

Minimal acceptance checklist before merge:
- [ ] 2–5 testable requirements written.  
- [ ] Design doc linked in PR.  
- [ ] Tests for each requirement (unit/integration).  
- [ ] Performance baseline if applicable.  
- [ ] Decision records for non-trivial trade-offs.  
- [ ] Exec summary and streamlined action log included.

If blocked: re-run Analyze → adjust Confidence Score → pick PoC if medium/low confidence.

End.
**EARS (Easy Approach to Requirements Syntax)** - Standard format for requirements:
