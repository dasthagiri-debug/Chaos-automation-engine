const { defineConfig, devices } = require('@playwright/test');

const launchArgs = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-gpu',
  '--no-zygote'
];

module.exports = defineConfig({
  testDir: './tests',
  
  // High-density optimization
  fullyParallel: true,
  
  // Defaults to 40 for high-density bot simulations. Override via env as needed.
  workers: parseInt(process.env.PLAYWRIGHT_WORKERS || '40', 10),
  
  // Global timeout: 45 minutes for extended load testing sessions
  timeout: 45 * 60 * 1000,
  
  // Expectation timeout for individual actions (e.g., waiting for a button)
  expect: {
    timeout: 10000,
  },
  
  // ========== REPORTING ==========
  reporter: [
    // Never auto-open in headless/containerized runs.
    ['html', { open: 'never' }],
    ['list'], // Provides real-time progress in the terminal/logs
    ['json', { outputFile: 'test-results/results.json' }],
  ],
  
  // ========== CLOUD-OPTIMIZED SETTINGS ==========
  use: {
    // MUST stay true to fit 40 bots in a single container and save RAM/CPU
    headless: true, 
    
    // Captures evidence ONLY when a bot fails to join for better debugging
    screenshot: 'only-on-failure', 
    
    video: 'off',
    
    // Records a trace only if the first join attempt fails to save disk space
    trace: 'on-first-retry', 
    
    // Ignore HTTPS errors common in staging/test environments.
    ignoreHTTPSErrors: true,

    // Essential for running headless Chromium inside Docker/AWS Fargate.
    launchOptions: {
      args: launchArgs,
    },
  },

  projects: [
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
      },
    },
  ],
});