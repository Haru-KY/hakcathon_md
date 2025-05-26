import express from 'express';
import knex from '../db/db.js';

const router = express.Router();
import { requireLogin } from '../utils/authUtils.js';
router.use(requireLogin);

router.post('/', async (req, res) => {
  const { emailId } = req.body;
  const userId = req.session.user_id;

  console.log("Session info:", req.session);

  if (!userId) {
    return res.status(401).json({ success: false, message: '未ログイン' });
  }

  try {

    // 現在の is_favorite 状態を取得
    const email = await knex('email')
      .select('is_favorite')
      .where({ id: emailId, user_id: userId })
      .first();

    if (!email) {
      return res.status(404).json({ success: false, message: 'メールが見つかりません' });
    }

    const newStatus = !email.is_favorite;

    await knex('email')
      .where({ id: emailId, user_id: userId })
      .update({ is_favorite: newStatus });

    return res.json({ success: true, newStatus });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'サーバーエラー' });
  }
});

export default router;