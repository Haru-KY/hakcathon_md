import express from 'express';
import knex from '../db/db.js';
import ollama from 'ollama';
import { PromptTemplate } from '@langchain/core/prompts';

const router = express.Router();

// プロンプト定義
const tagPromptTemplate = PromptTemplate.fromTemplate(
  `以下のメール本文を読み取り、その内容を反映した分類用タグを最大3つ、日本語で、カンマ区切りで出力してください。出力は必ず以下の形式で、タグ名のみとし、説明や文章は一切不要です。

出力形式の例：
就活, 企業, オファー

【メール本文】
{emailBody}

既存のタグ一覧：
{tags}

出力タグ（上記一覧から該当するものを選んでください。新しいタグを作らないでください）：
`
);

export const processReplyInfoForUser = async (userId) => {
  const emails = await knex('email').where({ user_id: userId });

  // DBからタグリストを取得
  const dbTags = await knex('ai_tags').where({ user_id: userId });
  const tagNameToId = {};
  dbTags.forEach(t => {
    tagNameToId[t.name] = t.id;
  });

  console.log('tagNameToId:', tagNameToId); // タグ名とIDのマップを確認

  for (const email of emails) {
    const emailBody = email.body || '';
    if (!emailBody.trim()) continue;

    // プロンプトのフォーマット
    const formattedTags = await tagPromptTemplate.format({
      tags: dbTags.map(t => t.name).join(', '),
      emailBody
    });

    // Ollamaに問い合わせてタグ抽出
    const tagRes = await ollama.chat({
      model: 'gemma3:4b',
      messages: [{ role: 'user', content: formattedTags }]
    });

    const tagText = tagRes.message?.content.trim() || '';
    const extractedTags = tagText
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);

    console.log(`メールID ${email.id} 抽出タグ:`, extractedTags);  // AIが抽出したタグを表示

    // email_ai_tagsに対応情報を挿入（既存分は削除）
    await knex('email_ai_tags').where({ email_id: email.id }).del();

    // 有効なタグだけを残す（DBに存在するタグのみ）
    const validTags = extractedTags.filter(t => tagNameToId[t] !== undefined);
    console.log(`メールID ${email.id} 有効タグ:`, validTags); // 有効タグだけ表示

    for (const tagName of validTags) {
      const tagId = tagNameToId[tagName];
      try {
        await knex('email_ai_tags')
          .insert({ email_id: email.id, tag_id: tagId, user_id: userId })
          .onConflict(['email_id', 'tag_id', 'user_id'])
          .ignore();
      } catch (err) {
        console.error(`email_ai_tags挿入エラー:`, err);
      }
    }

  };
}
router.post("/", async function (req, res) {
  try {
    const userId = req.session.userid;
    if (!userId) return res.redirect("/login");

    console.log("req.body:", req.body); // デバッグ用

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

      // 既存のタグ処理（メールにAIタグを紐づける）
      await processReplyInfoForUser(userId);
    }

    res.redirect("/add");
  } catch (err) {
    console.error("サーバーエラー:", err);
    res.status(500).send("サーバーエラー");
  }
});

export default router;
