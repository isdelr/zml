#!/usr/bin/env node

const sections = [
  {
    title: "Daily Dev",
    commands: [
      ["npm run dev", "Start frontend + Convex watchers locally."],
      ["npm run dev:docker", "Start frontend + backend stack with Docker Compose."],
      ["npm run dev:docker:reset", "Stop Docker dev stack and remove volumes."],
      ["npm run dev:frontend", "Start Next.js dev server only."],
      ["npm run dev:backend", "Start Convex dev watcher only."],
    ],
  },
  {
    title: "Quality Checks",
    commands: [
      ["npm run lint", "Run ESLint locally."],
      ["npm run typecheck", "Run TypeScript checks locally."],
      ["npm run check", "Run lint + typecheck locally."],
      ["npm run test:unit", "Run Vitest unit tests locally."],
      ["npm run test:convex", "Run Convex integration tests locally."],
      ["npm run test:e2e", "Run Playwright e2e locally."],
      ["npm run test:e2e:smoke", "Run Chromium smoke e2e locally."],
    ],
  },
  {
    title: "Convex",
    commands: [
      ["npm run convex:sync", "Run one-time Convex sync locally."],
      ["npm run convex:codegen", "Regenerate Convex codegen locally."],
      ["npm run convex:inventory", "Run Convex contract inventory report."],
    ],
  },
  {
    title: "Build",
    commands: [
      ["npm run build", "Run production Turbopack build."],
      ["npm run build:webpack", "Run production webpack build."],
      ["npm run analyze:bundle", "Run webpack bundle analyzer build."],
    ],
  },
  {
    title: "Dev Seed Utilities",
    commands: [
      ["npm run dev:seed -- --namespace dev", "Seed rich local data (supports local songs/art)."],
      ["npm run dev:seed:users", "List users for include options."],
      ["npm run dev:seed:simulate", "Add extra simulated activity."],
      ["npm run dev:seed:reset", "Delete seeded namespace data."],
    ],
  },
];

console.log("ZML npm script guide");
console.log("====================");
console.log("Run this anytime with: npm run scripts:help");

for (const section of sections) {
  console.log(`\n${section.title}`);
  for (const [command, description] of section.commands) {
    console.log(`- ${command.padEnd(45)} ${description}`);
  }
}
