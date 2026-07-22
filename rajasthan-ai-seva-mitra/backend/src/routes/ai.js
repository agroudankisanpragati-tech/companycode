const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const { protect, optionalAuth } = require('../middleware/auth');

router.post('/chat', optionalAuth, aiController.chat);
router.get('/suggestions', aiController.getSuggestions);
router.get('/history/:sessionId', aiController.getConversationHistory);

module.exports = router;
