# DevOps Handoff: Playwright Load Test for AWS ECS Fargate

## Overview

This package contains a Playwright-based QA automation suite designed to simulate high-concurrency webinar attendees joining a live webinar platform. The container defaults to 40 Playwright workers and 40 attendee bots, and can be overridden per environment.

---

## Critical: CONTAINER_ID Environment Variable

**Every ECS task MUST be injected with a unique `CONTAINER_ID` environment variable.**

### Why This Matters

The automation script uses `CONTAINER_ID` to generate mathematically unique bot identities:

```
Bot Name:  Bot {CONTAINER_ID}-{PROFILE_ID}
Bot Email: bot{CONTAINER_ID}_{PROFILE_ID}@test.com
```

**Without unique `CONTAINER_ID` values across tasks, you will experience user collision errors.** The webinar platform will reject duplicate email addresses, and bots will fail to join.

### How to Inject CONTAINER_ID

In your AWS ECS task definition, add the environment variable:

```json
{
  "name": "CONTAINER_ID",
  "value": "12"
}
```

**Recommended approach:** Use AWS CloudFormation or Terraform to auto-generate sequential container IDs:
- Task 1: `CONTAINER_ID=1`
- Task 2: `CONTAINER_ID=2`
- Task 3: `CONTAINER_ID=3`
- ... up to Task 400 (for 2,000 total bots: 400 tasks × 5 bots per task)

### Example ECS Task Definition Snippet

```json
{
  "containerDefinitions": [
    {
      "name": "playwright-bot",
      "image": "YOUR_ECR_REPO/automation:latest",
      "environment": [
        {
          "name": "CONTAINER_ID",
          "value": "12"
        },
        {
          "name": "PLAYWRIGHT_WORKERS",
          "value": "5"
        }
      ]
    }
  ]
}
```

---

## Execution Flow

1. **Build & Push Docker Image**
   ```bash
   docker build -t automation:latest .
   aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin YOUR_ECR_REPO
   docker tag automation:latest YOUR_ECR_REPO/automation:latest
   docker push YOUR_ECR_REPO/automation:latest
   ```

2. **Launch ECS Tasks**
   - Create ECS cluster (if not already present)
   - Register task definition with unique `CONTAINER_ID` per task
   - Use `RunTask` API to scale up (AWS recommends max 10 tasks per API call, then retry)

3. **Monitor Execution**
   - CloudWatch Logs: `/ecs/playwright-bot` (configure in task definition)
   - Test reports: Stored in `test-results/` directory
   - Duration: ~45 minutes per task (per timeout in config)

---

## Compute Resource Recommendations

### For 40 Concurrent Headless Chromium Instances (default)

Each headless Chromium instance uses ~250–350 MB RAM under load. **Minimum recommended for 40 bots:**

| Resource      | Requirement | Reasoning |
|:---|:---|:---|
| **vCPU**      | **4 vCPU** (4096 CPU units) | 40 Chromium processes × ~100 CPU units each |
| **RAM**       | **16 GB** | 40 × ~300 MB per browser + 4 GB OS/Node overhead |
| **Ephemeral Storage** | **21 GB** | Default Fargate allocation (sufficient) |

> ⚠️ **Under-provisioning RAM is the #1 cause of low join rates.** If containers are given less than 16 GB for 40 bots, they will be OOM-killed by the kernel after only a few bots spawn. You will see far fewer bots join than expected.

### Scaling to 400 Bots (10 containers × 40 bots)

```
Total Bots Needed: 400
Bots per Container: 40
Containers Required: 10 tasks
Compute per Task: 4 vCPU, 16 GB RAM
Total Infrastructure: 40 vCPU, 160 GB RAM
```

### AWS Fargate Pricing Estimate (us-east-1, 45 min × 10 tasks)

```
vCPU Cost:    40 vCPU × $0.04048/vCPU-hour × 0.75 hours = $1.21
Memory Cost:  160 GB × $0.004445/GB-hour × 0.75 hours = $0.53
Total ~$2 for complete load test (rough estimate, verify current pricing)
```

---

## Environment Variables

| Variable | Default | Purpose |
|:---|:---|:---|
| `CONTAINER_ID` | (required) | Unique identifier for bot naming (e.g., `12`). Must be unique per ECS task. |
| `BASE_URL` | (required) | Full URL of the live webinar registration page (e.g., `https://yoursite.easywebinar.live/live-event-123`). Without this, bots fall back to a hardcoded dev URL. |
| `BOT_COUNT` | `40` | Number of attendee bots per container |
| `PLAYWRIGHT_WORKERS` | `40` | Number of parallel Chromium workers (should equal `BOT_COUNT`) |

### Overriding BOT_COUNT and PLAYWRIGHT_WORKERS

Use environment variables to tune concurrency without changing code.

Docker run example for local validation:

```bash
docker run --rm \
  -e CONTAINER_ID=101 \
  -e BASE_URL=https://yoursite.easywebinar.live/live-event-123 \
  -e BOT_COUNT=40 \
  -e PLAYWRIGHT_WORKERS=40 \
  automation:latest
```

ECS task definition example:

```json
{
  "containerDefinitions": [{
    "name": "playwright-bot",
    "image": "YOUR_ECR_REPO/automation:latest",
    "environment": [
      { "name": "CONTAINER_ID",         "value": "1" },
      { "name": "BASE_URL",             "value": "https://yoursite.easywebinar.live/live-event-123" },
      { "name": "BOT_COUNT",            "value": "40" },
      { "name": "PLAYWRIGHT_WORKERS",   "value": "40" }
    ]
  }]
}
```

Recommended guidance:
- Keep `PLAYWRIGHT_WORKERS` equal to `BOT_COUNT`.
- Always set `BASE_URL` — bots will warn and use a hardcoded fallback URL if missing.
- Always set a unique `CONTAINER_ID` per ECS task to prevent email collisions.
- Reduce `BOT_COUNT` and `PLAYWRIGHT_WORKERS` first if you observe OOM or CPU throttling.

---

## CloudWatch Log Patterns

Each bot emits structured log lines that are easy to filter in CloudWatch Logs Insights:

| Log Pattern | Meaning |
|:---|:---|
| `[BOT-X] ▶ STARTING` | Bot X has started and is waiting for its stagger delay |
| `[BOT-X] ✅ JOINED` | Bot X successfully entered the live room |
| `[BOT-X] ❌ FAILED TO JOIN` | Bot X exhausted all 3 retry attempts — check the reason after the pipe |
| `⚠️ Attempt N/3 failed:` | Individual retry failure — still has more attempts remaining |

**Quick join success rate check (CloudWatch Logs Insights):**
```
fields @message
| filter @message like /JOINED|FAILED TO JOIN/
| stats count(*) by @message
```

---

## Troubleshooting

| Issue | Solution |
|:---|:---|
| Far fewer bots joining than expected (e.g. 42/400) | **OOM** — increase ECS task RAM to 16 GB for 40 bots. Check CloudWatch for exit code 137 or "OutOfMemory" stop reason. |
| `❌ FAILED TO JOIN` with `waitForURL: Timeout` | Room URL never loaded — bot waited 120s. Check if the webinar is live and `BASE_URL` is correct. |
| `❌ FAILED TO JOIN` with `ERR_TOO_MANY_REDIRECTS` | Server redirect loop on registration — bot handles this via email suffix (`_r2`, `_r3`) on retries. If persisting, check EasyWebinar attendee limits. |
| `❌ FAILED TO JOIN` with `Room UI not ready` | Bot reached the room URL but chat tab never appeared — EasyWebinar "configuring" overlay didn't clear. May indicate server overload. |
| `[BOT-X] BASE_URL not set` | `BASE_URL` env var missing. Set it in ECS task definition. |
| "Email already registered" errors | Verify each ECS task has a unique `CONTAINER_ID` |
| Tests timeout after 45 min | Increase `timeout` in `playwright.config.js` if longer sessions needed |

---

## Directory Structure

```
/app
├── Pages/                    # Page Object Model classes
├── tests/
│   ├── auth.setup.js         # Authentication setup (runs once)
│   ├── chaos_bot_pom.spec.js # Main load test (runs with workers)
│   └── [other test files]
├── playwright.config.js      # Optimized for cloud execution
├── package.json              # Dependencies and scripts
└── test-results/             # Generated reports (HTML, JSON, JUnit)
```

---

## Next Steps

1. **Prepare AWS Infrastructure**
   - Create ECS cluster and task definition
   - Configure CloudWatch logs
   - Set up ECR repository

2. **Deploy Container**
   - Build and push Docker image to ECR
   - Launch test tasks with sequential `CONTAINER_ID` values

3. **Scale & Monitor**
   - Use AWS CloudFormation/Terraform for infrastructure-as-code
   - Monitor CloudWatch metrics and logs
   - Aggregate test reports post-execution

---

## Support

For Playwright documentation: https://playwright.dev/docs/intro
For AWS ECS Fargate: https://docs.aws.amazon.com/ecs/latest/developerguide/launch_types.html

---

**Last Updated:** 2026-06-15  
**Image Version:** `mcr.microsoft.com/playwright:v1.58.2-jammy`  
**Test Timeout:** 45 minutes
