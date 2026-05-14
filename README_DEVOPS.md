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

### For 5 Concurrent Headless Chromium Instances

Each headless Chromium browser requires significant resources. **Minimum recommended:**

| Resource      | Requirement | Reasoning |
|:---|:---|:---|
| **vCPU**      | **1.0 vCPU** (1024 CPU units) | 5 Chromium processes × ~200 CPU units each under load |
| **RAM**       | **2 GB** | 5 × 350–400 MB per browser + overhead |
| **Ephemeral Storage** | **21 GB** | Default Fargate allocation (sufficient for Playwright artifacts) |

### Scaling to 2,000 Bots

```
Total Bots Needed: 2,000
Bots per Container: 5
Containers Required: 2,000 ÷ 5 = 400 tasks
Compute per Task: 1 vCPU, 2 GB RAM
Total Infrastructure: 400 vCPU, 800 GB RAM
```

### AWS Fargate Pricing Estimate (us-east-1, 45 min × 400 tasks)

```
vCPU Cost:    400 vCPU × $0.04048/vCPU-hour × 0.75 hours = $12.14
Memory Cost:  800 GB × $0.004445/GB-hour × 0.75 hours = $2.67
Total ~$15 for complete load test (rough estimate, verify current pricing)
```

---

## Environment Variables

| Variable | Default | Purpose |
|:---|:---|:---|
| `CONTAINER_ID` | (required) | Unique identifier for bot naming (e.g., `12`) |
| `BOT_COUNT` | `40` | Number of attendee bot profiles to execute in the chaos suite |
| `PLAYWRIGHT_WORKERS` | `40` | Number of parallel workers (Chromium instances) |

### Overriding BOT_COUNT and PLAYWRIGHT_WORKERS

Use environment variables to tune concurrency without changing code.

Docker run example:

```bash
docker run --rm \
  -e CONTAINER_ID=101 \
  -e BOT_COUNT=25 \
  -e PLAYWRIGHT_WORKERS=20 \
  automation:latest
```

Docker Compose example:

```bash
BOT_COUNT=30 PLAYWRIGHT_WORKERS=24 CONTAINER_ID=102 docker compose up --build playwright-bots
```

Recommended guidance:
- Keep `PLAYWRIGHT_WORKERS` less than or equal to `BOT_COUNT`.
- Start with `BOT_COUNT=40` and `PLAYWRIGHT_WORKERS=40` for Fargate performance validation.
- Reduce workers first if you observe OOM or CPU throttling.

---

## Troubleshooting

| Issue | Solution |
|:---|:---|
| "Email already registered" errors | Verify each task has a unique `CONTAINER_ID` |
| Out of memory (OOM) | Reduce `PLAYWRIGHT_WORKERS` or increase RAM allocation |
| Tests timeout | Increase `timeout` in `playwright.config.js` (currently 45 min) |
| Reports not generated | Check CloudWatch logs for Playwright errors |

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

**Last Updated:** 2026-05-13  
**Image Version:** `mcr.microsoft.com/playwright:v1.43.0-jammy`  
**Test Timeout:** 45 minutes
