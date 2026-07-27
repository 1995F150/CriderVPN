const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const userDb = require('../database/userDb');
const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'crider-secret-key-change-me';

router.post('/setup', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Missing fields' });
  userDb.get('SELECT COUNT(*) as count FROM users', async (err, row) => {
    if (err) return res.status(500).json({ error: 'DB Error' });
    if (row.count > 0) return res.status(400).json({ error: 'System already initialized' });
    const hash = await bcrypt.hash(password, 10);
    userDb.run('INSERT INTO users (username, password) VALUES (?, ?)', [username, hash], (err) => {
      if (err) return res.status(500).json({ error: 'Failed to create user' });
      res.json({ message: 'System initialized' });
    });
  });
});

router.post('/auth/login', (req, res) => {
  const { username, password } = req.body;
  userDb.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
    if (err || !user) return res.status(401).json({ error: 'Invalid credentials' });
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });
    res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/' });
    res.json({ success: true });
  });
});
module.exports = router;
