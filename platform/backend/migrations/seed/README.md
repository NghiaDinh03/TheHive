# Seed Data

Realistic SOC investigation data for UI/UX testing and development.

## What's Included

| Entity | Count | Description |
|---|---|---|
| Organisations | 3 | CERT-Internal, MSSP-Partner, Finance-SOC |
| Profiles | 3 | superadmin, analyst, read-only |
| Users | 5 | admin, alice, bob, carol, dave |
| Cases | 9 | Ransomware, BEC, phishing, insider threat, DDoS, Log4Shell, PowerShell, brute force, duplicate |
| Case Shares | 8 | Multi-org sharing with owner/action-required flags |
| Tasks | 14 | Various statuses (Waiting/InProgress/Completed), grouped by investigation phase |
| Alerts | 10 | Various types (ransomware, phishing, DLP, exploitation, brute force, DGA, WAF, malware) |
| Observables | 15 | IPs, domains, hashes, URLs, emails, user-agents |
| Case Logs | 9 | Markdown investigation notes with technical details |
| Custom Fields | 7 | Business impact, affected systems, CVE references |
| Tags | 20 | Common SOC investigation tags |
| Audit Logs | 13 | Activity trail for all major operations |

## How to Load

### Option 1: Direct SQL execution

```bash
# After running migrations
psql -h localhost -U thehive -d thehive -f platform/backend/migrations/seed/001_realistic_soc_data.sql
```

### Option 2: Via Docker Compose

```bash
# Copy seed file into running postgres container and execute
docker cp platform/backend/migrations/seed/001_realistic_soc_data.sql thehive-postgres:/tmp/seed.sql
docker exec -it thehive-postgres psql -U thehive -d thehive -f /tmp/seed.sql
```

### Option 3: Via backend fixture migration

The seed data is compatible with the existing fixture migration system. The UUIDs are fixed for reproducibility.

## Data Design Principles

1. **Realistic scenarios**: Each case represents a real-world SOC investigation type (ransomware, BEC, phishing, insider threat, etc.)
2. **Cross-references**: Cases share observables (e.g., same C2 IP appears in ransomware and Log4Shell cases), enabling the "related cases" feature
3. **Multi-org sharing**: Cases are shared between CERT-Internal, MSSP-Partner, and Finance-SOC with different permission levels
4. **Task lifecycle**: Tasks span all statuses (Waiting, InProgress, Completed) with realistic investigation workflows
5. **Markdown content**: Case logs use markdown formatting for rich investigation notes
6. **TLP/PAP markings**: Observables and cases have appropriate TLP/PAP levels (AMBER for sensitive, RED for critical)
7. **Idempotent**: Uses `ON CONFLICT DO NOTHING` so the seed can be run multiple times safely

## UI Testing Scenarios

With this seed data, you can test:

- **Case list**: 9 cases with various statuses, severities, TLP/PAP levels, assignees
- **Case detail**: Full tabs — tasks, observables, alerts, logs, custom fields, shares, audit
- **Alert queue**: 10 alerts with read/unread, imported/new status, various sources
- **Task management**: Bulk operations, status transitions, assignment
- **Observable detail**: IOC flags, sighted flags, tags, data types
- **Multi-org**: Different user perspectives (admin, analyst, MSSP partner, read-only)
- **Search**: Rich content across cases, alerts, observables, tasks
- **Timeline**: Audit trail showing investigation progression
