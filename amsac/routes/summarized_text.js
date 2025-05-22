import express from 'express';
import { google } from 'googleapis';
import { Ollama } from 'ollama';
import { PromptTemplate } from '@langchain/core/prompts';
import mysql from 'mysql2/promise';

import knex from "../db/db.js";

const router = express.Router();
const ollama = new Ollama();

const oauth2Client = new google.auth.OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  process.env.REDIRECT_URI
);

// HTMLタグ除去
function stripHtmlTags(html) {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

// メール本文抽出
function extractBody(payload) {
  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return Buffer.from(payload.body.data, 'base64').toString('utf-8');
  }
  if (payload.mimeType === 'text/html' && payload.body?.data) {
    return stripHtmlTags(Buffer.from(payload.body.data, 'base64').toString('utf-8'));
  }
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        return Buffer.from(part.body.data, 'base64').toString('utf-8');
      }
      if (part.mimeType === 'text/html' && part.body?.data) {
        return stripHtmlTags(Buffer.from(part.body.data, 'base64').toString('utf-8'));
      }
    }
  }
  return '(本文なし)';
}

// cosine類似度計算
function cosineSimilarity(a, b) {
  const wordFreq = (text) =>
    text.split(/\s+/).reduce((acc, word) => {
      acc[word] = (acc[word] || 0) + 1;
      return acc;
    }, {});
  const dot = (vecA, vecB) =>
    Object.keys(vecA).reduce((sum, key) => sum + (vecA[key] * (vecB[key] || 0)), 0);
  const magnitude = (vec) =>
    Math.sqrt(Object.values(vec).reduce((sum, val) => sum + val * val, 0));

  const vecA = wordFreq(a);
  const vecB = wordFreq(b);
  return dot(vecA, vecB) / (magnitude(vecA) * magnitude(vecB) || 1);
}

// 要約プロンプト
const summaryPrompt = new PromptTemplate({
  template: '次のメール本文を日本語で簡潔に要約してください：\n\n{email}',
  inputVariables: ['email'],
});

// データベースから人工タグ名だけ取得（tag.name）
// tag.id はこの時点では使っていないが、後でDB挿入時に使える
async function getAiTags(userId) {
    const rows = await knex("ai_tags").select("id", "name").where("user_id", userId);
    return rows.map(row => ({ id: row.id, name: row.name }));
  }

router.get('/summary', (req, res) => {
if (!req.session.tokens || !req.session.userid) {
  return res.redirect('/login');
}
res.render('loading'); // プログレス画面を表示
});

// メール要約・タグ分類ルート
router.get('/summary/process', async (req, res) => {
  if (!req.session.tokens || !req.session.userid) {
    return res.status(401).send('未認証です');
  }

  const userId = req.session.userid;

  try {
    oauth2Client.setCredentials(req.session.tokens);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    const aiTags = await getAiTags(userId);
    const threadList = await gmail.users.threads.list({ userId: 'me', maxResults: 5 });
    const threads = threadList.data.threads || [];

    for (const thread of threads) {
      try {
        const detail = await gmail.users.threads.get({ userId: 'me', id: thread.id });
        const msg = detail.data.messages[0];

        const subject = msg.payload.headers.find(h => h.name === 'Subject')?.value || '(件名なし)';
        const from = msg.payload.headers.find(h => h.name === 'From')?.value || '(差出人不明)';
        const date = msg.payload.headers.find(h => h.name === 'Date')?.value || null;
        const body = extractBody(msg.payload);
        const messageId = msg.id;

        const exists = await knex("email").where({ user_id: userId, message_id: messageId }).first();
        if (exists) continue;

        const prompt = await summaryPrompt.format({ email: body });
        const response = await ollama.chat({
          model: 'gemma3:1b',
          messages: [{ role: 'user', content: prompt }]
        });
        const summary = response.message?.content || '(要約取得失敗)';

        const threshold = 0.3;
        const matchedTags = aiTags.filter(tag => cosineSimilarity(body, tag.name) >= threshold);

        const [emailId] = await knex("email").insert({
          user_id: userId,
          message_id: messageId,
          subject,
          author: from,
          body,
          summary,
          created_at: date ? new Date(date) : new Date()
        });

        for (const tag of matchedTags) {
          await knex("email_ai_tags").insert({
            email_id: emailId,
            tag_id: tag.id,
            user_id: userId
          });
        }

      } catch (err) {
        console.error(`スレッド ${thread.id} の処理でエラー:`, err);
      }
    }

    res.status(200).send('完了');
  } catch (err) {
    console.error(err);
    res.status(500).send('処理中にエラーが発生しました');
  }
});

export default router;
