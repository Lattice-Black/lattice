/**
 * Alerts Routes - API endpoints for alert rule management and notifications
 */

import { Router } from 'express';
import {
  createAlertRule,
  listAlertRules,
  getAlertRule,
  updateAlertRule,
  deleteAlertRule,
  listAlertNotifications,
  acknowledgeAlert,
} from '../services/alert-service';

const router = Router();

// Alert Rules
router.post('/rules', async (req, res) => {
  try {
    const rule = await createAlertRule(req.body);
    return res.status(201).json(rule);
  } catch (error) {
    console.error('Failed to create alert rule:', error);
    return res.status(500).json({ error: 'internal_error', message: 'Failed to create alert rule' });
  }
});

router.get('/rules', async (req, res) => {
  try {
    const { service_id, environment } = req.query;
    const rules = await listAlertRules(
      service_id as string | undefined,
      environment as string | undefined
    );
    return res.json({ rules, count: rules.length });
  } catch (error) {
    console.error('Failed to list alert rules:', error);
    return res.status(500).json({ error: 'internal_error', message: 'Failed to list alert rules' });
  }
});

router.get('/rules/:id', async (req, res) => {
  try {
    const rule = await getAlertRule(req.params.id);
    if (!rule) {
      return res.status(404).json({ error: 'not_found', message: 'Alert rule not found' });
    }
    return res.json(rule);
  } catch (error) {
    console.error('Failed to get alert rule:', error);
    return res.status(500).json({ error: 'internal_error', message: 'Failed to get alert rule' });
  }
});

router.patch('/rules/:id', async (req, res) => {
  try {
    const rule = await updateAlertRule(req.params.id, req.body);
    if (!rule) {
      return res.status(404).json({ error: 'not_found', message: 'Alert rule not found' });
    }
    return res.json(rule);
  } catch (error) {
    console.error('Failed to update alert rule:', error);
    return res.status(500).json({ error: 'internal_error', message: 'Failed to update alert rule' });
  }
});

router.delete('/rules/:id', async (req, res) => {
  try {
    const deleted = await deleteAlertRule(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'not_found', message: 'Alert rule not found' });
    }
    return res.status(204).send();
  } catch (error) {
    console.error('Failed to delete alert rule:', error);
    return res.status(500).json({ error: 'internal_error', message: 'Failed to delete alert rule' });
  }
});

// Alert Notifications
router.get('/notifications', async (req, res) => {
  try {
    const { alert_rule_id, acknowledged, limit } = req.query;
    const notifications = await listAlertNotifications(
      alert_rule_id as string | undefined,
      acknowledged === 'true' ? true : acknowledged === 'false' ? false : undefined,
      limit ? parseInt(limit as string, 10) : 50
    );
    return res.json({ notifications, count: notifications.length });
  } catch (error) {
    console.error('Failed to list notifications:', error);
    return res.status(500).json({ error: 'internal_error', message: 'Failed to list notifications' });
  }
});

router.post('/notifications/:id/acknowledge', async (req, res) => {
  try {
    const { acknowledged_by } = req.body;
    if (!acknowledged_by) {
      return res.status(400).json({ error: 'validation_error', message: 'acknowledged_by is required' });
    }

    const notification = await acknowledgeAlert(req.params.id, acknowledged_by);
    if (!notification) {
      return res.status(404).json({ error: 'not_found', message: 'Notification not found' });
    }
    return res.json(notification);
  } catch (error) {
    console.error('Failed to acknowledge notification:', error);
    return res.status(500).json({ error: 'internal_error', message: 'Failed to acknowledge notification' });
  }
});

export default router;
