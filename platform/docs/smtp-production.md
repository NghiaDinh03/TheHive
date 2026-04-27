# SMTP production secret management

This repo ships Mailpit in Docker Compose for local/self-host development mail capture only.

## Local/self-host development

- SMTP endpoint inside Docker network: `mailpit:1025`
- Host SMTP endpoint: `localhost:1025`
- Mailpit Web UI: `http://localhost:8025`

Configured by `platform/deploy/.env.example`:

```env
MAIL_ENABLED=true
MAIL_HOST=mailpit
MAIL_PORT=1025
MAIL_USERNAME=
MAIL_PASSWORD=
MAIL_FROM=thehive@localhost
PUBLIC_BASE_URL=http://localhost:3000
```

## Production SMTP

Production must not commit SMTP credentials to git. Use one of these options:

- Docker Compose: load a non-committed `.env` file from the deployment host.
- Kubernetes: use `Secret` objects mounted as env vars.
- External secret manager: Vault, AWS Secrets Manager, Azure Key Vault, or SOPS-encrypted release manifests.

Required env vars:

```env
MAIL_ENABLED=true
MAIL_HOST=smtp.example.com
MAIL_PORT=587
MAIL_USERNAME=thehive-smtp-user
MAIL_PASSWORD=replace-with-secret-manager-value
MAIL_FROM=thehive@example.com
PUBLIC_BASE_URL=https://thehive.example.com
```

Operational rules:

- Rotate `MAIL_PASSWORD` on staff offboarding and suspected compromise.
- Keep SMTP account scoped to send only from the configured `MAIL_FROM` domain.
- Enforce TLS/STARTTLS on production SMTP.
- Monitor invite/reset mail bounce rates and delivery failures.
- Do not expose Mailpit in production.
