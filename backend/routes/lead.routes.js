const express = require('express');
const { query } = require('../config/database');
const { authenticateToken, checkSubscription } = require('../middleware/auth.middleware');
const { body, validationResult } = require('express-validator');

const router = express.Router();

// AI Qualification Engine
class AIQualificationEngine {
  static async qualifyLead(leadId, businessId) {
    try {
      // Get scoring rules
      const rulesResult = await query(
        'SELECT * FROM scoring_rules WHERE business_id = $1 AND is_active = true ORDER BY id',
        [businessId]
      );

      const rules = rulesResult.rows;
      if (rules.length === 0) {
        return { score: 0, category: 'unqualified' };
      }

      let totalScore = 0;

      // Simulate AI conversation for each question
      for (const rule of rules) {
        const answers = rule.answers;
        const answerKeys = Object.keys(answers);
        
        // Simulate random answer (in production, this would be real AI conversation)
        const randomAnswer = answerKeys[Math.floor(Math.random() * answerKeys.length)];
        const answerScore = answers[randomAnswer];

        // Store message
        await query(
          `INSERT INTO messages (id, lead_id, channel, message, direction, timestamp)
           VALUES ($1, $2, 'whatsapp', $3, 'ai', NOW())`,
          [`msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, leadId, rule.question]
        );

        await query(
          `INSERT INTO messages (id, lead_id, channel, message, direction, timestamp)
           VALUES ($1, $2, 'whatsapp', $3, 'lead', NOW())`,
          [`msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, leadId, randomAnswer]
        );

        // Calculate weighted score
        totalScore += (answerScore * rule.weight) / 100;
      }

      // Determine category
      let category = 'cold';
      if (totalScore >= 80) category = 'hot';
      else if (totalScore >= 40) category = 'warm';

      return { score: Math.round(totalScore), category };

    } catch (error) {
      console.error('AI qualification error:', error);
      throw error;
    }
  }

  static async routeLead(leadId, category, businessId) {
    try {
      // Get routing rules
      const routingResult = await query(
        'SELECT * FROM routing_rules WHERE business_id = $1 AND category = $2',
        [businessId, category]
      );

      if (routingResult.rows.length === 0) {
        return null;
      }

      const routingRule = routingResult.rows[0];

      // Get sales agents
      const agentsResult = await query(
        "SELECT id FROM users WHERE business_id = $1 AND role = 'sales_agent' AND is_active = true",
        [businessId]
      );

      const agents = agentsResult.rows;

      if (agents.length === 0) {
        return null;
      }

      let assignedUserId = null;

      if (category === 'hot' || routingRule.method === 'skill_based') {
        // Assign to first/senior agent
        assignedUserId = agents[0].id;
      } else if (routingRule.method === 'round_robin') {
        // Round robin assignment
        assignedUserId = agents[Math.floor(Math.random() * agents.length)].id;
      }
      // 'automation' method doesn't assign to anyone

      return assignedUserId;

    } catch (error) {
      console.error('Lead routing error:', error);
      throw error;
    }
  }
}

// Get all leads for business
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { category, status, assigned, search } = req.query;
    
    let queryText = `
      SELECT l.*, u.name as assigned_user_name
      FROM leads l
      LEFT JOIN users u ON l.assigned_user_id = u.id
      WHERE l.business_id = $1
    `;
    const params = [req.user.business_id];
    let paramCount = 1;

    if (category && category !== 'all') {
      paramCount++;
      queryText += ` AND l.category = $${paramCount}`;
      params.push(category);
    }

    if (status) {
      paramCount++;
      queryText += ` AND l.status = $${paramCount}`;
      params.push(status);
    }

    if (assigned === 'true') {
      queryText += ` AND l.assigned_user_id IS NOT NULL`;
    } else if (assigned === 'false') {
      queryText += ` AND l.assigned_user_id IS NULL`;
    }

    if (search) {
      paramCount++;
      queryText += ` AND (l.name ILIKE $${paramCount} OR l.email ILIKE $${paramCount} OR l.phone ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }

    queryText += ' ORDER BY l.created_at DESC';

    const result = await query(queryText, params);
    res.json({ leads: result.rows });

  } catch (error) {
    console.error('Get leads error:', error);
    res.status(500).json({ error: 'Failed to fetch leads' });
  }
});

// Get single lead
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await query(
      `SELECT l.*, u.name as assigned_user_name
       FROM leads l
       LEFT JOIN users u ON l.assigned_user_id = u.id
       WHERE l.id = $1 AND l.business_id = $2`,
      [req.params.id, req.user.business_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    res.json({ lead: result.rows[0] });

  } catch (error) {
    console.error('Get lead error:', error);
    res.status(500).json({ error: 'Failed to fetch lead' });
  }
});

// Create new lead
router.post('/', [
  authenticateToken,
  checkSubscription,
  body('name').trim().isLength({ min: 2 }).withMessage('Name is required'),
  body('email').optional().isEmail().withMessage('Invalid email'),
  body('phone').optional().trim().notEmpty().withMessage('Phone cannot be empty'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, phone, source, metadata } = req.body;

    // Check lead limit
    const planResult = await query(
      `SELECT p.lead_limit FROM businesses b
       JOIN plans p ON b.plan_id = p.id
       WHERE b.id = $1`,
      [req.user.business_id]
    );

    if (planResult.rows.length > 0) {
      const leadLimit = planResult.rows[0].lead_limit;
      const leadCountResult = await query(
        'SELECT COUNT(*) as count FROM leads WHERE business_id = $1',
        [req.user.business_id]
      );

      if (parseInt(leadCountResult.rows[0].count) >= leadLimit) {
        return res.status(403).json({ 
          error: 'Lead limit reached',
          message: 'Please upgrade your plan to add more leads'
        });
      }
    }

    const leadId = 'lead_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

    // Create lead
    await query(
      `INSERT INTO leads (id, business_id, name, email, phone, source, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [leadId, req.user.business_id, name, email, phone, source, metadata ? JSON.stringify(metadata) : null]
    );

    // Run AI qualification
    const qualification = await AIQualificationEngine.qualifyLead(leadId, req.user.business_id);
    
    // Route the lead
    const assignedUserId = await AIQualificationEngine.routeLead(leadId, qualification.category, req.user.business_id);

    // Update lead with qualification results
    await query(
      `UPDATE leads 
       SET score = $1, category = $2, assigned_user_id = $3, status = 'qualified', updated_at = NOW()
       WHERE id = $4`,
      [qualification.score, qualification.category, assignedUserId, leadId]
    );

    // Log activity
    await query(
      `INSERT INTO activity_log (business_id, user_id, entity_type, entity_id, action, details)
       VALUES ($1, $2, 'lead', $3, 'created', $4)`,
      [req.user.business_id, req.user.id, leadId, JSON.stringify({ name, score: qualification.score, category: qualification.category })]
    );

    // Fetch complete lead data
    const leadResult = await query(
      `SELECT l.*, u.name as assigned_user_name
       FROM leads l
       LEFT JOIN users u ON l.assigned_user_id = u.id
       WHERE l.id = $1`,
      [leadId]
    );

    res.status(201).json({ 
      message: 'Lead created and qualified successfully',
      lead: leadResult.rows[0]
    });

  } catch (error) {
    console.error('Create lead error:', error);
    res.status(500).json({ error: 'Failed to create lead' });
  }
});

// Update lead
router.put('/:id', [
  authenticateToken,
  body('name').optional().trim().isLength({ min: 2 }),
  body('email').optional().isEmail(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, phone, status, assigned_user_id } = req.body;
    
    const updates = [];
    const params = [];
    let paramCount = 0;

    if (name) {
      paramCount++;
      updates.push(`name = $${paramCount}`);
      params.push(name);
    }
    if (email) {
      paramCount++;
      updates.push(`email = $${paramCount}`);
      params.push(email);
    }
    if (phone) {
      paramCount++;
      updates.push(`phone = $${paramCount}`);
      params.push(phone);
    }
    if (status) {
      paramCount++;
      updates.push(`status = $${paramCount}`);
      params.push(status);
    }
    if (assigned_user_id !== undefined) {
      paramCount++;
      updates.push(`assigned_user_id = $${paramCount}`);
      params.push(assigned_user_id);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }

    updates.push(`updated_at = NOW()`);
    paramCount++;
    params.push(req.params.id);
    paramCount++;
    params.push(req.user.business_id);

    await query(
      `UPDATE leads SET ${updates.join(', ')} WHERE id = $${paramCount - 1} AND business_id = $${paramCount}`,
      params
    );

    // Fetch updated lead
    const result = await query(
      `SELECT l.*, u.name as assigned_user_name
       FROM leads l
       LEFT JOIN users u ON l.assigned_user_id = u.id
       WHERE l.id = $1 AND l.business_id = $2`,
      [req.params.id, req.user.business_id]
    );

    res.json({ 
      message: 'Lead updated successfully',
      lead: result.rows[0]
    });

  } catch (error) {
    console.error('Update lead error:', error);
    res.status(500).json({ error: 'Failed to update lead' });
  }
});

// Delete lead
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await query(
      'DELETE FROM leads WHERE id = $1 AND business_id = $2 RETURNING id',
      [req.params.id, req.user.business_id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    res.json({ message: 'Lead deleted successfully' });

  } catch (error) {
    console.error('Delete lead error:', error);
    res.status(500).json({ error: 'Failed to delete lead' });
  }
});

// Add note to lead
router.post('/:id/notes', [
  authenticateToken,
  body('note').trim().notEmpty().withMessage('Note is required'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    await query(
      'INSERT INTO lead_notes (lead_id, user_id, note) VALUES ($1, $2, $3)',
      [req.params.id, req.user.id, req.body.note]
    );

    res.status(201).json({ message: 'Note added successfully' });

  } catch (error) {
    console.error('Add note error:', error);
    res.status(500).json({ error: 'Failed to add note' });
  }
});

// Get lead notes
router.get('/:id/notes', authenticateToken, async (req, res) => {
  try {
    const result = await query(
      `SELECT ln.*, u.name as user_name
       FROM lead_notes ln
       JOIN users u ON ln.user_id = u.id
       JOIN leads l ON ln.lead_id = l.id
       WHERE ln.lead_id = $1 AND l.business_id = $2
       ORDER BY ln.created_at DESC`,
      [req.params.id, req.user.business_id]
    );

    res.json({ notes: result.rows });

  } catch (error) {
    console.error('Get notes error:', error);
    res.status(500).json({ error: 'Failed to fetch notes' });
  }
});

module.exports = router;
