# Make.com Webhook URLs

Store Make.com webhook URLs here for easy reference and automation.

## Webhook Registry

| Name | URL | Purpose |
|------|-----|---------|
| Morning Briefing | `https://hook.make.com/REPLACE_ME` | Trigger morning workflow |
| Stock Alert | `https://hook.make.com/REPLACE_ME` | Send stock alerts |
| Task Created | `https://hook.make.com/REPLACE_ME` | Log new tasks |
| Health Alert | `https://hook.make.com/REPLACE_ME` | Server health notifications |

## How to Use

### Trigger a webhook:
```bash
curl -X POST "WEBHOOK_URL"   -H "Content-Type: application/json"   -d '{"event": "name", "data": {...}}'
```

### Example - Send stock alert to Make.com:
```bash
curl -X POST "https://hook.make.com/YOUR_STOCK_WEBHOOK"   -H "Content-Type: application/json"   -d '{"symbol": "NVDA", "alert": "breakout", "price": 875.50}'
```

## Adding New Webhooks

1. Create webhook in Make.com scenario
2. Copy the URL
3. Add to the table above
4. Reference in cron jobs or skills as needed

## Notes

- Webhooks are one-way (OpenClaw → Make.com)
- For Make.com → OpenClaw, use OpenClaw's built-in webhook receiver on port 18791
- Keep webhook URLs private - they are essentially API keys
