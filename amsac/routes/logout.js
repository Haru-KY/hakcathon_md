import express from 'express';
const router = express.Router();

import { requireLogin } from '../utils/authUtils.js';
router.use(requireLogin);

router.get('/', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).send('ログアウトに失敗しました');
    }
    res.redirect('/login');
  });
});

export default router;
