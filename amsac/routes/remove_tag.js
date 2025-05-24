import express from 'express';
const router = express.Router();
import knex from '../db/db.js';

router.get('/remove-tag', async (req, res) => {
    try {
        const userId = req.session.userid;

        if (!userId) {
            return res.redirect('/login');
        }

        const { email_id, tag_id } = req.query;

        // 必要なパラメータが揃っているか確認
        if (!email_id || !tag_id) {
            return res.status(400).send("パラメータが不足しています");
        }

        // 自分のメールに対するタグだけ削除できるように制限
        await knex('email_tags')
            .where({
                email_id: email_id,
                tag_id: tag_id,
                user_id: userId
            })
            .del();

        res.redirect('/add');  // 元のページに戻る（リロード）

    } catch (error) {
        console.error('タグ削除エラー:', error);
        res.status(500).send("サーバーエラー");
    }
});

export default router;
