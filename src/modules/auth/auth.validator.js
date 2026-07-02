'use strict';

const { z } = require('zod');

// ── Reusable field schemas ─────────────────────────────────────────────────────
const emailField = z.string().email('Invalid email address').toLowerCase().trim();
const passwordField = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

// ── Auth Schemas ───────────────────────────────────────────────────────────────

const registerSchema = z.object({
  body: z.object({
    email: emailField,
    password: passwordField,
    displayName: z
      .string()
      .trim()
      .min(2, 'Display name must be at least 2 characters')
      .max(100, 'Display name cannot exceed 100 characters'),
  }),
});

const loginSchema = z.object({
  body: z.object({
    email: emailField,
    password: z.string().min(1, 'Password is required'),
    totpCode: z.string().length(6).optional(), // MFA token
  }),
});

const refreshTokenSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1, 'Refresh token is required'),
  }),
});

const forgotPasswordSchema = z.object({
  body: z.object({
    email: emailField,
  }),
});

const resetPasswordSchema = z.object({
  body: z.object({
    token: z.string().min(1, 'Reset token is required'),
    password: passwordField,
  }),
});

const verifyMfaSchema = z.object({
  body: z.object({
    totpCode: z
      .string()
      .length(6, 'TOTP code must be exactly 6 digits')
      .regex(/^\d+$/, 'TOTP code must be numeric'),
  }),
});

const revokeSessionSchema = z.object({
  params: z.object({
    sessionId: z.string().min(1, 'Session ID is required'),
  }),
});

// ── User Schemas ───────────────────────────────────────────────────────────────

const updateProfileSchema = z.object({
  body: z
    .object({
      displayName: z.string().trim().min(2).max(100).optional(),
      avatarUrl: z.string().url('Invalid avatar URL').optional(),
    })
    .strict(),
});

const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: passwordField,
  }),
});

const updateSignatureSchema = z.object({
  body: z.object({
    signature: z.string().max(10000).optional().default(''),
  }),
});

const updateVacationSchema = z.object({
  body: z.object({
    enabled: z.boolean(),
    subject: z.string().max(200).optional(),
    body: z.string().max(5000).optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
  }),
});

const updatePreferencesSchema = z.object({
  body: z
    .object({
      theme: z.enum(['light', 'dark']).optional(),
      undoSendSeconds: z.number().int().refine(
        (v) => [5, 10, 20, 30].includes(v),
        {
          message: 'undoSendSeconds must be one of 5, 10, 20, or 30',
        }
      ).optional(),
      notificationsEnabled: z.boolean().optional(),
    })
    .strict(),
});

module.exports = {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyMfaSchema,
  revokeSessionSchema,
  updateProfileSchema,
  changePasswordSchema,
  updateSignatureSchema,
  updateVacationSchema,
  updatePreferencesSchema,
};
