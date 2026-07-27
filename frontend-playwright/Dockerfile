FROM mcr.microsoft.com/playwright:v1.40.0-jammy

WORKDIR /app

# Copy package files
COPY package.json ./

# Install dependencies
RUN npm install

# Install Playwright browsers
RUN npx playwright install chromium firefox

# Copy test files
COPY playwright.config.ts ./
COPY tests ./tests

# Run tests
CMD ["npx", "playwright", "test"]
