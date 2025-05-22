import express from 'express';
import knex from '../db/db.js';

const router = express.Router();

router.post("/", async function (req, res) {
  try {
    const userId = req.session.userid;
    if (!userId) return res.redirect("/login");

    console.log("req.body:", req.body); // ← デバッグ用

    if (req.body["utag"]) {
      const userTag = req.body["utag"];
      console.log("手動タグ:", userTag);

        const exists = await knex('tags')
        .where({ user_id: userId, name: userTag })
        .first();

        if (!exists) {
        await knex('tags').insert({
            user_id: userId,
            name: userTag
        });
        console.log("タグをDBに追加しました");
        } else {
        console.log("既に登録済みのタグです");
        }

      console.log("手動タグをDBに追加しました");

    } else if (req.body["aitag"]) {
        // AIタグの保存処理
        const aiTag = req.body["aitag"];
        console.log("AIタグ:", aiTag);

        // 既に同じAIタグが登録されているかチェック
        const exists = await knex('ai_tags')
        .where({ user_id: userId, name: aiTag })
        .first();

        if (!exists) {
        await knex('ai_tags').insert({
            user_id: userId,
            name: aiTag
        });
        console.log("AIタグをDBに追加しました");
        } else {
        console.log("既に登録済みのAIタグです");
        }


        console.log("AIタグをDBに追加しました");
    }

    res.redirect("/add");
  } catch (err) {
    console.error("サーバーエラー:", err);
    res.status(500).send("サーバーエラー");
  }
});

export default router;
