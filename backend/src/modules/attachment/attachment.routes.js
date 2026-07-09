'use strict';

const express = require('express');
const router = express.Router();
const multer = require('multer');
const { Readable } = require('stream');
const { cloudinary } = require('../../config/cloudinary');
const authenticate = require('../../shared/middlewares/authenticate');
const asyncHandler = require('../../shared/utils/asyncHandler');
const ApiResponse = require('../../shared/utils/apiResponse');
const ApiError = require('../../shared/utils/apiError');
const Attachment = require('./attachment.model');
const { uploadLimiter } = require('../../shared/middlewares/rateLimiter');

// Use memory storage — upload to Cloudinary via stream
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
  fileFilter: (_req, file, cb) => {
    const blockedTypes = [
      'application/x-executable',
      'application/x-msdownload',
    ];

    if (blockedTypes.includes(file.mimetype)) {
      return cb(new Error('File type not allowed'));
    }

    return cb(null, true);
  },
});

/**
 * Upload buffer to Cloudinary
 */
const uploadToCloudinary = (buffer, userId, filename) =>
  new Promise((resolve, reject) => {
    //console.log("Uploading to Cloudinary...");
    //console.log("Buffer size:", buffer.length);

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `inboxiq/attachments/${userId}`,
        resource_type: 'auto',
        public_id: `${Date.now()}-${filename.replace(/\s/g, '_')}`,
      },
      (error, result) => {
        //console.log("Cloudinary callback reached");

        if (error) {
          console.error("Cloudinary error:", error);
          return reject(error);
        }

        //console.log("Upload successful");
        return resolve(result);
      },
    );

    Readable.from(buffer)
      .on('error', reject)
      .pipe(uploadStream);
  });
router.use(authenticate);

/**
 * @swagger
 * /attachments/upload:
 *   post:
 *     tags: [Attachments]
 *     summary: Upload attachment
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: File uploaded successfully
 */
router.post(
  '/upload',
  uploadLimiter,
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw ApiError.badRequest('No file uploaded');
    //console.log(req.file);

    const result = await uploadToCloudinary(
      req.file.buffer,
      req.user.id,
      req.file.originalname,
    );

    const attachment = await Attachment.create({
      uploadedBy: req.user.id,
      filename: req.file.originalname,
      mimeType: req.file.mimetype,
      sizeBytes: req.file.size,
      cloudinaryPublicId: result.public_id,
      cloudinaryUrl: result.secure_url,
    });

    return ApiResponse.created(
      res,
      'File uploaded successfully',
      attachment,
    );
  }),
);

/**
 * @swagger
 * /attachments/{id}:
 *   get:
 *     tags: [Attachments]
 *     summary: Get attachment by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Attachment ID
 *         schema:
 *           type: string
 *         example: 686019e7b6d91c9f47f12211
 *     responses:
 *       200:
 *         description: Attachment retrieved
 */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const attachment = await Attachment.findById(req.params.id).lean();

    if (!attachment) {
      throw ApiError.notFound('Attachment not found');
    }

    return ApiResponse.ok(res, 'Attachment retrieved', attachment);
  }),
);

/**
 * @swagger
 * /attachments/{id}:
 *   delete:
 *     tags: [Attachments]
 *     summary: Delete attachment
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Attachment ID
 *         schema:
 *           type: string
 *         example: 686019e7b6d91c9f47f12211
 *     responses:
 *       200:
 *         description: Attachment deleted
 */
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const attachment = await Attachment.findOne({
      _id: req.params.id,
      uploadedBy: req.user.id,
    });

    if (!attachment) {
      throw ApiError.notFound('Attachment not found');
    }

    const resourceType = attachment.mimeType.startsWith('image/')
      ? 'image'
      : attachment.mimeType.startsWith('video/')
        ? 'video'
        : 'raw';

    await cloudinary.uploader.destroy(
      attachment.cloudinaryPublicId,
      {
        resource_type: resourceType,
        type: 'upload',
      },
    );

    await attachment.deleteOne();

    return ApiResponse.ok(res, 'Attachment deleted');
  }),
);

module.exports = router;