const express = require('express');
const { query } = require('../config/database');
const { authenticateToken } = require('../middleware/auth.middleware');
const router = express.Router();

router.get('/', authenticateToken, async (req, res) => {
  try {
    const { leadId } = req.query;
    let queryText = `
      SELECT m.* FROM messages m
      JOIN leads l ON m.lead_id = l.id
      WHERE l.business_id = $1
    `;
    const params = [req.user.business_id];
    
    if (leadId) {
      queryText += ' AND m.lead_id = $2';
      params.push(leadId);
    }
    
    queryText += ' ORDER BY m.timestamp DESC';
    const result = await query(queryText, params);
    res.json({ messages: result.rows });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

module.exports = router;
