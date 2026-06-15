FROM mcr.microsoft.com/playwright:v1.58.2-jammy

WORKDIR /app

ENV CI=true

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

COPY Pages ./Pages
COPY tests ./tests
COPY playwright.config.js ./playwright.config.js

RUN mkdir -p /app/test-results /app/playwright-report \
 && chown -R pwuser:pwuser /app

USER pwuser

CMD ["npx", "playwright", "test", "tests/chaos_bot_pom.spec.js"]
