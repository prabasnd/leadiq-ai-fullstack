const express = require('express');
const { query } = require('../config/database');
const { authenticateToken, authorize } = require('../middleware/auth.middleware');
const router = express.Router();

router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM routing_rules WHERE business_id = $1',
      [req.user.business_id]
    );
    res.json({ rules: result.rows });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch routing rules' });
  }
});

router.put('/:category', authenticateToken, authorize('business_admin'), async (req, res) => {
  try {
    const { method, notify, settings } = req.body;
    await query(
      `UPDATE routing_rules SET method = $1, notify = $2, settings = $3
       WHERE business_id = $4 AND category = $5`,
      [method, notify, settings ? JSON.stringify(settings) : null, req.user.business_id, req.params.category]
    );
    res.json({ message: 'Routing rule updated successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update routing rule' });
  }
});

module.exports = router;
