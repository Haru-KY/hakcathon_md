import express from 'express';
import knex from '../db/db.js';

const router = express.Router();

router.post("/", async function (req, res) {
  try {
    const userId = req.session.userid;
    if (!userId) return res.redirect("/login");

    const emailId = req.body.email_id;
    const tagId = req.body.tag_id;

    if (!emailId || !tagId) {
      return res.status(400).send("メールIDまたはタグIDがありません");
    }

    // すでに登録済みかチェック（重複防止）
    const exists = await knex('email_tags')
      .where({ email_id: emailId, tag_id: tagId, user_id: userId })
      .first();

    if (!exists) {
      await knex('email_tags').insert({
        email_id: emailId,
        tag_id: tagId,
        user_id: userId
      });
      console.log("メールにタグを追加しました");
    } else {
      console.log("既に登録済みのタグです");
    }

    res.redirect("/add");

  } catch (err) {
    console.error("サーバーエラー:", err);
    res.status(500).send("サーバーエラー");
  }
});

export default router;
