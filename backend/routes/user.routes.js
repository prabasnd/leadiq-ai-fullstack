const express = require('express');
const bcrypt = require('bcryptjs');
const { query } = require('../config/database');
const { authenticateToken, authorize } = require('../middleware/auth.middleware');
const router = express.Router();

router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await query(
      'SELECT id, name, email, role, is_active, created_at FROM users WHERE business_id = $1',
      [req.user.business_id]
    );
    res.json({ users: result.rows });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

router.post('/', authenticateToken, authorize('business_admin'), async (req, res) => {
  try {
    const { name, email, role } = req.body;
    const userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    const tempPassword = Math.random().toString(36).substr(2, 10);
    const passwordHash = await bcrypt.hash(tempPassword, 10);
    
    await query(
      'INSERT INTO users (id, business_id, name, email, password_hash, role) VALUES ($1, $2, $3, $4, $5, $6)',
      [userId, req.user.business_id, name, email, passwordHash, role]
    );
    
    res.status(201).json({ message: 'User created', tempPassword });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create user' });
  }
});

router.delete('/:id', authenticateToken, authorize('business_admin'), async (req, res) => {
  try {
    await query('DELETE FROM users WHERE id = $1 AND business_id = $2', [req.params.id, req.user.business_id]);
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

module.exports = router;
