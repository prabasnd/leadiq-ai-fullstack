const express = require('express');
const { query } = require('../config/database');
const { authenticateToken } = require('../middleware/auth.middleware');
const router = express.Router();

router.get('/dashboard', authenticateToken, async (req, res) => {
  try {
    const [leadsCount, hotLeads, warmLeads, coldLeads, convertedLeads] = await Promise.all([
      query('SELECT COUNT(*) FROM leads WHERE business_id = $1', [req.user.business_id]),
      query("SELECT COUNT(*) FROM leads WHERE business_id = $1 AND category = 'hot'", [req.user.business_id]),
      query("SELECT COUNT(*) FROM leads WHERE business_id = $1 AND category = 'warm'", [req.user.business_id]),
      query("SELECT COUNT(*) FROM leads WHERE business_id = $1 AND category = 'cold'", [req.user.business_id]),
      query("SELECT COUNT(*) FROM leads WHERE business_id = $1 AND status = 'converted'", [req.user.business_id])
    ]);

    const total = parseInt(leadsCount.rows[0].count);
    const stats = {
      total,
      hot: parseInt(hotLeads.rows[0].count),
      warm: parseInt(warmLeads.rows[0].count),
      cold: parseInt(coldLeads.rows[0].count),
      converted: parseInt(convertedLeads.rows[0].count),
      conversionRate: total > 0 ? Math.round((parseInt(convertedLeads.rows[0].count) / total) * 100) : 0,
      avgResponseTime: '2.3 min'
    };

    res.json({ stats });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

module.exports = router;
