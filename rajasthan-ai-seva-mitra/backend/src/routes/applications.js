const express = require('express');
const appRouter = express.Router();
const analyticsRouter = express.Router();
const applicationController = require('../controllers/applicationController');
const analyticsController = require('../controllers/analyticsController');
const { protect, restrictTo } = require('../middleware/auth');

appRouter.post('/', protect, applicationController.createApplication);
appRouter.get('/my', protect, applicationController.getMyApplications);
appRouter.get('/:id', protect, applicationController.getApplication);
appRouter.put('/:id', protect, applicationController.updateApplication);
appRouter.post('/:id/submit', protect, applicationController.submitApplication);
appRouter.get('/', protect, restrictTo('admin'), applicationController.getAllApplications);

analyticsRouter.get('/dashboard', protect, restrictTo('admin'), analyticsController.getDashboardStats);

module.exports = { appRouter, analyticsRouter };
