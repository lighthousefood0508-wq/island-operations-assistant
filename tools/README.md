# Engineering Tools

This folder holds versioned engineering utilities that are not normal product runtime code.

Allowed:

- Read-only audit and diagnostic tools
- Environment, security, and maintenance checks
- Migration helpers that are explicitly approved
- Code-inspection and support utilities

Do not place:

- Product application code that belongs under `src/`
- One-off runtime state, logs, backups, or credentials
- A second implementation of an existing application service, API, or business rule

Tools must document their scope and must respect the repository's domain and approval rules.
