'use strict';

const cloudinary = require('cloudinary').v2;
const env = require('./env');
const logger = require('../shared/utils/logger');

/**
 * Configures and exports the Cloudinary SDK instance.
 * Called once at application startup.
 */
cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
  secure: true, // Always use HTTPS URLs
});

// Ping Cloudinary on startup to validate credentials
const verifyCloudinaryConfig = async () => {
  try {
    await cloudinary.api.ping();
    logger.info('Cloudinary connection verified');
  } catch (error) {
    logger.error('Cloudinary configuration invalid:', { error: error.message });
    // Non-fatal in dev; fatal in production
    if (env.NODE_ENV === 'production') {
      process.exit(1);
    }
  }
};

module.exports = { cloudinary, verifyCloudinaryConfig };
