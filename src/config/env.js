'use strict';

const { z } = require('zod');

/**
 * Zod-validated environment schema.
 * The app will crash on startup if any required variable is missing or malformed.
 * This prevents silent misconfiguration bugs in production.
 */
const envSchema = z.object({
  // Application
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(5000),
  API_VERSION: z.string().default('v1'),
  APP_NAME: z.string().default('InboxIQ'),

  // MongoDB
  MONGO_URI: z.string().url(),
  MONGO_TEST_URI: z.string().url().optional(),

  // Redis
  REDIS_URL: z.string().url(),

  // JWT
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  // Cloudinary
  CLOUDINARY_CLOUD_NAME: z.string(),
  CLOUDINARY_API_KEY: z.string(),
  CLOUDINARY_API_SECRET: z.string(),

  // Security
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12), // min(4) allows fast hashing in tests
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000),
  RATE_LIMIT_MAX: z.coerce.number().default(100),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),

  // Client
  CLIENT_URL: z.string().url().default('http://localhost:3000'),

  // SMTP (optional in v1)
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().email().optional(),

  // AI (optional in v1)
  OPENAI_API_KEY: z.string().optional(),
});

let env;

try {
  env = envSchema.parse(process.env);
} catch (error) {
  // eslint-disable-next-line no-console
  console.error('❌ Invalid environment configuration:');
  if (error instanceof z.ZodError) {
    error.errors.forEach((err) => {
      // eslint-disable-next-line no-console
      console.error(`  • ${err.path.join('.')}: ${err.message}`);
    });
  }
  process.exit(1);
}

module.exports = env;
