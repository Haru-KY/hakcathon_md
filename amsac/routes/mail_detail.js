// routes/body.js
import express from 'express';
const router = express.Router();
import knex from '../db/db.js';

router.get('/', async function (req, res) {
    const userId = req.session.userid;
    if (!userId) return res.redirect('/login');

    const messageId = req.query.message_id;

    try {
        const email = await knex("email")
            .where({ message_id: messageId, user_id: userId })
            .first();

        if (!email) {
            return res.status(404).send("メールが見つかりませんでした。");
        }

        res.render("mail_detail", { email });
    } catch (err) {
        console.error(err);
        res.status(500).send("サーバーエラー");
    }
});

export default router;
