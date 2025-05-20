import express from 'express';
import session from 'express-session';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import { google } from 'googleapis';
import { Ollama } from 'ollama';
import { PromptTemplate } from '@langchain/core/prompts';
import mysql from 'mysql2/promise';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const ollama = new Ollama();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// セッション設定（ユーザーのログイン状態などを管理）
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret',
  resave: false,
  saveUninitialized: true,
}));

// Google OAuth2クライアントの設定
const oauth2Client = new google.auth.OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  process.env.REDIRECT_URI
);

// Ollamaのプロンプトテンプレート：メール本文を簡潔に要約
const summaryPrompt = PromptTemplate.fromTemplate(
  "次のメール本文を日本語で簡潔に要約してください：\n\n{emailBody}"
);

// Ollamaのプロンプトテンプレート：タグ一覧からメール本文に該当するタグを列挙
const tagPromptTemplate = PromptTemplate.fromTemplate(
  "以下のタグの中から、このメール本文に該当するものをすべてカンマ区切りで列挙してください。\n\nタグ一覧: {tags}\n\nメール本文:\n{emailBody}"
);

// Google OAuth認証のURLを生成し、リダイレクトするルート
app.get('/auth/google', (req, res) => {
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',  // リフレッシュトークンを取得
    scope: ['https://www.googleapis.com/auth/gmail.readonly'], // Gmail読み取り権限
  });
  res.redirect(url);
});

// OAuth2のコールバック処理：認証コードからアクセストークンを取得しセッションに保存
app.get('/oauth2callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.redirect('/');
  try {
    const { tokens } = await oauth2Client.getToken(code);
    req.session.tokens = tokens;  // トークンをセッションに保存
    res.redirect('/');
  } catch {
    res.redirect('/');
  }
});

// DBからタグ一覧を取得する関数
async function fetchTagsFromDB() {
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.query('SELECT id, name FROM tags');
    return rows;
  } finally {
    conn.release();
  }
}

// メール情報をDBのemailsテーブルに保存（更新または挿入）
async function saveEmailToDB(email) {
  const conn = await pool.getConnection();
  try {
    // 既に同じmessage_idのメールがあるか確認
    const [exists] = await conn.query('SELECT id FROM emails WHERE message_id = ?', [email.message_id]);
    if (exists.length > 0) {
      // 既存メールを更新
      await conn.query(
        `UPDATE emails SET subject=?, body=?, summary=?, time=? WHERE message_id=?`,
        [email.subject, email.body, email.summary, email.time, email.message_id]
      );
      return exists[0].id;
    } else {
      // 新規メールを挿入
      const [result] = await conn.query(
        `INSERT INTO emails (message_id, subject, body, summary, time) VALUES (?, ?, ?, ?, ?)`,
        [email.message_id, email.subject, email.body, email.summary, email.time]
      );
      return result.insertId;
    }
  } finally {
    conn.release();
  }
}

// emailsテーブルとtagsテーブルの関連付けを管理するemail_tagsテーブルにタグ情報を保存
async function saveEmailTags(emailId, tagIds) {
  if (tagIds.length === 0) return;
  const conn = await pool.getConnection();
  try {
    // 既存のタグ関連を削除
    await conn.query('DELETE FROM email_tags WHERE email_id = ?', [emailId]);
    // 新たに関連付けを挿入
    const values = tagIds.map(tagId => [emailId, tagId]);
    await conn.query('INSERT INTO email_tags (email_id, tag_id) VALUES ?', [values]);
  } finally {
    conn.release();
  }
}

// Gmailのメール本文ペイロードからテキスト本文を抽出する関数
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

// HTMLタグを除去してテキストだけを抽出するユーティリティ関数
function stripHtmlTags(html) {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

// メール要約・タグ分類APIエンドポイント
app.get('/api/summary', async function (req, res)  {
  // 認証されていなければ401を返す
  if (!req.session.tokens) return res.status(401).json({ error: 'Unauthorized' });

  let page = parseInt(req.query.page) || 1;
  const pageSize = 5;

  try {
    // Gmail APIクライアントに認証情報セット
    oauth2Client.setCredentials(req.session.tokens);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // DBからタグ一覧取得
    const dbTags = await fetchTagsFromDB();
    const tagNameToId = {};
    dbTags.forEach(t => { tagNameToId[t.name] = t.id; });
    const tagNames = dbTags.map(t => t.name);

    // 初回またはページ1の時にスレッドIDをまとめて取得してセッションに保持
    if (!req.session.threadIds || req.query.page === '1') {
      const allThreads = [];
      let nextPageToken = null;
      do {
        const response = await gmail.users.threads.list({
          userId: 'me',
          maxResults: 100,
          pageToken: nextPageToken,
        });
        if (response.data.threads) allThreads.push(...response.data.threads);
        nextPageToken = response.data.nextPageToken;
      } while (nextPageToken && allThreads.length < 100);
      req.session.threadIds = allThreads.map(t => t.id);
    }

    // DBに保存済みのメール総数を取得し、ページングの総ページ数計算
    const conn = await pool.getConnection();
    const [[{ total }]] = await conn.query('SELECT COUNT(*) as total FROM emails');
    conn.release();

    const totalPages = Math.ceil(total / pageSize);
    if (page < 1) page = 1;
    if (page > totalPages) page = totalPages;

    // ページが前ページより小さい（戻る操作）場合はDBから取得して返す（DB参照）
    if (page < (req.session.lastPage || 1)) {
      const conn = await pool.getConnection();
      try {
        const offset = (page - 1) * pageSize;
        // DBからメールデータ取得
        const [emails] = await conn.query(
          `SELECT e.id, e.message_id, e.subject, e.body, e.summary, e.time
           FROM emails e
           ORDER BY e.time DESC
           LIMIT ? OFFSET ?`,
          [pageSize, offset]
        );
        const emailIds = emails.map(e => e.id);

        // 取得したメールIDに対応するタグも取得
        let emailTagsMap = {};
        if (emailIds.length > 0) {
          const [emailTags] = await conn.query(
            `SELECT et.email_id, t.name FROM email_tags et
             JOIN tags t ON et.tag_id = t.id
             WHERE et.email_id IN (?)`,
            [emailIds]
          );
          emailTagsMap = emailTags.reduce((acc, cur) => {
            if (!acc[cur.email_id]) acc[cur.email_id] = [];
            acc[cur.email_id].push(cur.name);
            return acc;
          }, {});
        }

        const results = emails.map(email => ({
          message_id: email.message_id,
          subject: email.subject,
          body: email.body,
          summary: email.summary,
          time: email.time,
          tags: emailTagsMap[email.id] || [],
        }));

        req.session.lastPage = page;

        return res.json({
          results,
          page,
          hasNext: page < totalPages,
          hasPrev: page > 1,
          source: 'db',
        });
      } finally {
        conn.release();
      }
    }

    // 新しいページならGmail APIから取得して要約・タグ付けし、DBに保存（Gmail参照）
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const threadPage = req.session.threadIds.slice(start, end);

    if (threadPage.length === 0) {
      return res.json({ results: [], message: 'メールはこれ以上ありません' });
    }

    const results = [];

    // Gmailスレッドごとに処理
    for (const threadId of threadPage) {
      const detail = await gmail.users.threads.get({ userId: 'me', id: threadId });
      const messages = detail.data.messages || [];
      if (messages.length === 0) continue;

      const message = messages[0];
      const messageId = message.id;
      const payload = message.payload || {};
      const headers = payload.headers || [];

      const subjectHeader = headers.find(h => h.name.toLowerCase() === 'subject');
      const dateHeader = headers.find(h => h.name.toLowerCase() === 'date');

      const subject = subjectHeader ? subjectHeader.value : '(件名なし)';
      const time = dateHeader ? new Date(dateHeader.value).toISOString() : new Date().toISOString();

      // 本文抽出
      const body = extractBody(payload);

      // Ollamaでメール本文を要約
      const summary = await ollama.chat({
        model: 'gemma3:1b',
        messages: [{ role: 'user', content: summaryPrompt.format({ emailBody: body }) }],
      }).then(r => r.choices[0].message.content).catch(() => '(要約失敗)');

      // Ollamaでタグを判定
      const tagContent = await ollama.chat({
        model: 'gemma3:4b',
        messages: [{ role: 'user', content: tagPromptTemplate.format({ tags: tagNames.join(', '), emailBody: body }) }],
      }).then(r => r.choices[0].message.content).catch(() => '');
      const matchedTags = tagContent.split(',').map(t => t.trim()).filter(t => tagNameToId[t]);

      // DB保存
      const emailRecord = {
        message_id: messageId,
        subject,
        body,
        summary,
        time,
      };
      const emailId = await saveEmailToDB(emailRecord);
      await saveEmailTags(emailId, matchedTags.map(t => tagNameToId[t]));

      results.push({
        ...emailRecord,
        tags: matchedTags,
      });
    }

    req.session.lastPage = page;

    // 要約結果をJSONファイルに保存
    await fs.writeFile('emails_summary.json', JSON.stringify(results, null, 2), 'utf-8');

    res.json({
      results,
      page,
      hasNext: page < totalPages,
      hasPrev: page > 1,
      source: 'gmail',
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '内部サーバーエラー' });
  }
});


