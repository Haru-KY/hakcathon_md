import express from 'express';
import knex from '../db/db.js';

const router = express.Router();

import { requireLogin } from '../utils/authUtils.js';
router.use(requireLogin);

router.post('/', async (req, res) => {
  const userId = req.session.user_id;
  if (!userId) return res.redirect('/login');

  try {
    // 関連データを削除（必要なテーブルを適宜追加）
    await knex('email_tags').where('user_id', userId).del();
    await knex('email_ai_tags').where('user_id', userId).del();
    await knex('ai_tags').where('user_id', userId).del();
    await knex('tags').where('user_id', userId).del();
    await knex('email').where('user_id', userId).del();

    // 最後にユーザー自身を削除
    await knex('users').where('id', userId).del();

    // セッション終了
    req.session.destroy(() => {
      res.redirect('/'); // または /login にリダイレクト
    });

  } catch (err) {
    console.error('アカウント削除中のエラー:', err);
    res.status(500).send('サーバーエラー: アカウント削除に失敗しました');
  }
});

export default router;