const express = require('express');
const { processIncomingMessage } = require('../services/messageProcessor');

const router = express.Router();

router.post('/', async (req, res) => {
  const appMode = String(process.env.APP_MODE || 'demo').toLowerCase();
  if (appMode !== 'demo') {
    return res.status(403).json({ error: 'Demo endpoint is disabled when APP_MODE is not demo' });
  }

  try {
    const result = await processIncomingMessage(req.body || {});
    return res.json(result);
  } catch (err) {
    if (err.message === 'Missing text field') {
      return res.status(400).json({ error: err.message });
    }

    console.error('Error processing demo message:', err);
    return res.status(500).json({
      reply: 'عذراً، حدث خطأ في النظام. سيتواصل معك أحد فريقنا قريباً.',
      error: err.message,
      needs_human: true
    });
  }
});

module.exports = router;
