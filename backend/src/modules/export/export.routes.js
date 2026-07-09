'use strict';

const express = require('express');
const exportController = require('./export.controller');
const authenticate = require('../../shared/middlewares/authenticate');

const router = express.Router();

// All export routes require authentication
router.use(authenticate);

router.get('/audit', exportController.exportAudit);
router.get('/security', exportController.exportSecurity);

module.exports = router;
