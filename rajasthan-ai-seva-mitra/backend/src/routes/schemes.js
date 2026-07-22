const express = require('express');
const router = express.Router();
const schemeController = require('../controllers/schemeController');
const { protect, restrictTo, optionalAuth } = require('../middleware/auth');

router.get('/', optionalAuth, schemeController.getSchemes);
router.get('/categories', schemeController.getCategories);
router.get('/recommended', protect, schemeController.getRecommendedSchemes);
router.get('/:id', optionalAuth, schemeController.getScheme);
router.get('/:id/eligibility', protect, schemeController.checkEligibility);
router.post('/', protect, restrictTo('admin'), schemeController.createScheme);
router.put('/:id', protect, restrictTo('admin'), schemeController.updateScheme);
router.delete('/:id', protect, restrictTo('admin'), schemeController.deleteScheme);

module.exports = router;
