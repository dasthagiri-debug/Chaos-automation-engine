FROM mcr.microsoft.com/playwright:v1.43.0-jammy

WORKDIR /app

ENV CI=true
ENV PLAYWRIGHT_WORKERS=40
ENV BOT_COUNT=40

COPY package.json package-lock.json ./
RUN npm ci

COPY Pages ./Pages
COPY tests ./tests
COPY scripts ./scripts
COPY playwright.config.js ./playwright.config.js

RUN mkdir -p /app/test-results /app/playwright-report && chown -R pwuser:pwuser /app
USER pwuser

CMD ["npx", "playwright", "test", "tests/chaos_bot_pom.spec.js"]
