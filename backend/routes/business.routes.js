const express = require('express');
const { query } = require('../config/database');
const { authenticateToken, authorize } = require('../middleware/auth.middleware');
const router = express.Router();

router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await query(
      'SELECT b.*, p.name as plan_name FROM businesses b JOIN plans p ON b.plan_id = p.id WHERE b.id = $1',
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Business not found' });
    res.json({ business: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch business' });
  }
});

router.put('/:id', authenticateToken, authorize('business_admin'), async (req, res) => {
  try {
    const { name } = req.body;
    await query('UPDATE businesses SET name = $1, updated_at = NOW() WHERE id = $2', [name, req.params.id]);
    res.json({ message: 'Business updated successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update business' });
  }
});

module.exports = router;
