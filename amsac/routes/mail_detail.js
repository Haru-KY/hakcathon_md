// routes/body.js
import express from 'express';
const router = express.Router();
import knex from '../db/db.js';

router.get('/', async function (req, res) {
    const userId = req.session.userid;
    if (!userId) return res.redirect('/login');

    const messageId = req.query.message_id;
    const page = req.query.page || 1; // ここでpageを取得

    try {
        const email = await knex("email")
            .where({ message_id: messageId, user_id: userId })
            .first();

        if (!email) {
            return res.status(404).send("メールが見つかりませんでした。");
        }

        const tags = await knex("tags").where({ user_id: userId }).select("id", "name");
        const ai_tags = await knex("ai_tags").where({ user_id: userId }).select("id", "name");

        res.render("mail_detail", { email, tags, ai_tags, page }); // ここでpageを渡す
    } catch (err) {
        console.error(err);
        res.status(500).send("サーバーエラー");
    }
});

export default router;
