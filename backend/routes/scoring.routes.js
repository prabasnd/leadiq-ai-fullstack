const express = require('express');
const { query } = require('../config/database');
const { authenticateToken, authorize } = require('../middleware/auth.middleware');
const router = express.Router();

router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM scoring_rules WHERE business_id = $1 AND is_active = true ORDER BY id',
      [req.user.business_id]
    );
    res.json({ rules: result.rows });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch scoring rules' });
  }
});

router.put('/', authenticateToken, authorize('business_admin'), async (req, res) => {
  try {
    const { rules } = req.body;
    await query('DELETE FROM scoring_rules WHERE business_id = $1', [req.user.business_id]);
    
    for (const rule of rules) {
      await query(
        'INSERT INTO scoring_rules (business_id, question, weight, answers) VALUES ($1, $2, $3, $4)',
        [req.user.business_id, rule.question, rule.weight, JSON.stringify(rule.answers)]
      );
    }
    res.json({ message: 'Scoring rules updated successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update scoring rules' });
  }
});

module.exports = router;
