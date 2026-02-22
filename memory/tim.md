# About Tim

## Identity
- Tim Bohnett
- WhatsApp: +16026169133
- GitHub: timbohnett-farther

## Repos
- timbohnett-farther/OpenClaw-Ledger — personal OpenClaw project tracker

## Preferences
- Wants proactive updates — don't wait to be asked, report what you're doing
- Prefers concise messages on WhatsApp (no walls of text)
- Timezone: America/New_York (Arizona, no DST)
- Likes when cron summaries include action items, not just status dumps

## VPS
- Hostinger KVM 4 at 31.97.214.241
- VPS ID: 1410865
- Ubuntu 24.04, Docker 29.2.1
- OpenClaw runs in Docker containers
- Firewall ID: 214227
- Ports: 22 (SSH), 18789 (OpenClaw gateway), 18790 (bridge), 18791 (GitHub webhook proxy)

## Setup History
- Installed 2026-02-21
- 75 skills loaded (20 custom/ClawHub + 55 bundled)
- Custom hostinger-manager skill for VPS/DNS/domain management
- GitHub webhook on OpenClaw-Ledger → push/PR/issue events
- Cron: morning briefing (7am ET), health check (every 6h), GitHub activity (9am/2pm ET weekdays)
- All cron jobs deliver summaries via WhatsApp

## Email
- OpenClaw's email: Ledger@The-AI-Team.io
- Hosted on Hostinger (SMTP: smtp.hostinger.com:465, IMAP: imap.hostinger.com:993)
- Credentials in env vars: EMAIL_ADDRESS, EMAIL_PASSWORD, SMTP_HOST, SMTP_PORT, IMAP_HOST, IMAP_PORT
- Domain: The-AI-Team.io (Hostinger)
