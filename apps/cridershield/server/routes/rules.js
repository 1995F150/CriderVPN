const express = require('express');
const router = express.Router();
const rulesDb = require('../database/rulesDb');

// GET all rules
router.get('/', (req, res) => {
  rulesDb.getAll((err, rules) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rules);
  });
});

// POST new rule
router.post('/', (req, res) => {
  rulesDb.create(req.body, (err, id) => {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ id, ...req.body });
  });
});

// PUT update rule
router.put('/:id', (req, res) => {
  rulesDb.update(req.params.id, req.body, (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// DELETE rule
router.delete('/:id', (req, res) => {
  rulesDb.delete(req.params.id, (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

module.exports = router;
