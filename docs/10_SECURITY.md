# Security

No secrets are committed. `.env` and SQLite runtime files are ignored by Git; `.env.example` contains placeholders only.

Before any external deployment: add authenticated sessions, role checks, CSRF strategy for browser writes, secure cookies, HTTPS, rate limits, webhook signature verification, request body limits, structured security logs, encrypted backups, restore verification, least-privilege service account, and secret rotation procedure.

Do not expose the SQLite file, server debug output, Google service credentials, LINE channel secret, or OpenAI key through a browser route. Receipt images and customer contact data require a retention policy before production use.
