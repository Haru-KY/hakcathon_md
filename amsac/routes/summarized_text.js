import express from 'express';
import { google } from 'googleapis';
import { Ollama } from 'ollama';
import { PromptTemplate } from '@langchain/core/prompts';
import mysql from 'mysql2/promise';

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

// 要約プロンプト
const summaryPrompt = new PromptTemplate({
  template: '次のメール本文を日本語で簡潔に要約してください：\n\n{email}',
  inputVariables: ['email'],
});

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

// データベースから人工タグ名だけ取得（tag.name）
// tag.id はこの時点では使っていないが、後でDB挿入時に使える
async function getTagsFromDB() {
  const connection = await mysql.createConnection({
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
  });

  const [rows] = await connection.execute('SELECT name FROM tags');
  await connection.end();
  return rows.map(row => row.name); // → tag.name として使う
}

// メール要約・タグ分類ルート
router.get('/summary', async (req, res) => {
  if (!req.session.tokens) return res.redirect('/');

  try {
    oauth2Client.setCredentials(req.session.tokens);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    const tagNames = await getTagsFromDB();
    const threadList = await gmail.users.threads.list({ userId: 'me', maxResults: 5 });
    const threads = threadList.data.threads || [];

    const summaries = await Promise.all(threads.map(async (thread) => {
      try {
        const detail = await gmail.users.threads.get({ userId: 'me', id: thread.id });
        const msg = detail.data.messages[0];

        const subject = msg.payload.headers.find(h => h.name === 'Subject')?.value || '(件名なし)'; // → タイトル（subject）
        const from = msg.payload.headers.find(h => h.name === 'From')?.value || '(差出人不明)';
        const date = msg.payload.headers.find(h => h.name === 'Date')?.value || '(日付不明)';
        const body = extractBody(msg.payload); // → 原文（body）
        const messageId = msg.id; // → Gmail ID（messageId）

        // 要約生成
        const prompt = await summaryPrompt.format({ email: body });
        const response = await ollama.chat({
          model: 'gemma3:1b',
          messages: [{ role: 'user', content: prompt }]
        });
        const summary = response.message?.content || '(要約取得失敗)'; // → 要約文（summary）

        // cosine類似度でタグ分類（tag.nameとの比較）
        const threshold = 0.3;
        const matchedTags = tagNames.filter(tag =>
          cosineSimilarity(body, tag) >= threshold
        );

        // ↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓
        // ここで得られた情報をDBに保存すればよい
        // 保存すべき情報の対応関係：
        // - Gmail message ID → messageId
        // - タイトル → subject
        // - 原文 → body
        // - 要約文 → summary
        // - 一致したタグ名リスト → matchedTags（ここからtag.idを検索して使用する）
        // ↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑

        return {
          messageId, // Gmail ID
          subject,   // タイトル
          from,
          date,
          original: body, // 原文
          summary,        // 要約文
          tags: matchedTags // タグ名（tag.name）リスト
        };

      } catch (err) {
        console.error(`スレッド ${thread.id} の処理中にエラー:`, err);
        return {
          subject: '(エラー発生)',
          from: '',
          date: '',
          summary: '(要約取得失敗)',
          original: '',
          tags: []
        };
      }
    }));

    res.json(summaries); // ← ★ 今はJSONで返しているが、ここでDB保存してもよい

  } catch (err) {
    console.error(err);
    res.status(500).send('メール取得・要約・分類処理でエラーが発生しました。');
  }
});

export default router;
