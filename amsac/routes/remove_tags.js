import express from 'express';
import knex from '../db/db.js';

const router = express.Router();

router.post("/", async function (req, res) {
  try {
    const userId = req.session.userid;
    if (!userId) return res.redirect("/login");

    const tagId = req.body.tag_id;
    const tagType = req.body.tag_type;

    if (!tagId || !tagType) {
      console.log("tag_idまたはtag_typeがありません");
      return res.redirect("/add");
    }

    if (tagType === "tag") {
      // 手動タグ削除
      await knex('email_tags').where({ tag_id: tagId, user_id: userId }).del();
      await knex('tags').where({ id: tagId, user_id: userId }).del();
      console.log("手動タグを削除しました");

    } else if (tagType === "ai_tag") {
      // AIタグ削除
      await knex('email_ai_tags').where({ tag_id: tagId, user_id: userId }).del();
      await knex('ai_tags').where({ id: tagId, user_id: userId }).del();
      console.log("AIタグを削除しました");

    } else {
      console.log("不明なtag_typeです");
    }

    return res.redirect("/add");

  } catch (err) {
    console.error("サーバーエラー:", err);
    res.status(500).send("サーバーエラー");
  }
});

export default router;
