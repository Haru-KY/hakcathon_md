import express from 'express';
import { google } from 'googleapis';
import { Ollama } from 'ollama';
import dotenv from 'dotenv';

dotenv.config(); // ← 環境変数読み込み

const router = express.Router();
const ollama = new Ollama();

const oauth2Client = new google.auth.OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  process.env.REDIRECT_URI
);

// メール本文の抽出（text/plain > text/html > multipart）
function extractBody(payload) {
  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return Buffer.from(payload.body.data, 'base64').toString('utf-8');
  }
  if (payload.mimeType === 'text/html' && payload.body?.data) {
    const html = Buffer.from(payload.body.data, 'base64').toString('utf-8');
    return stripHtmlTags(html);
  }
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        return Buffer.from(part.body.data, 'base64').toString('utf-8');
      }
      if (part.mimeType === 'text/html' && part.body?.data) {
        const html = Buffer.from(part.body.data, 'base64').toString('utf-8');
        return stripHtmlTags(html);
      }
    }
  }
  return '(本文なし)';
}

// HTMLタグ除去
function stripHtmlTags(html) {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

// メール要約表示
router.get('/summary', async (req, res) => {
  if (!req.session.tokens) return res.redirect('/');

  try {
    oauth2Client.setCredentials(req.session.tokens);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    const threadList = await gmail.users.threads.list({
      userId: 'me',
      maxResults: 5,
    });

    const threads = threadList.data.threads || [];

    const summaries = await Promise.all(threads.map(async (thread) => {
      try {
        const detail = await gmail.users.threads.get({ userId: 'me', id: thread.id });
        const msg = detail.data.messages[0];
        const subject = msg.payload.headers.find(h => h.name === 'Subject')?.value || '(件名なし)';
        const body = extractBody(msg.payload);

        const response = await ollama.chat({
          model: 'gemma:2b',
          messages: [{ role: 'user', content: `次のメール本文を日本語で簡潔に要約してください：\n\n${body}` }]
        });

        const summaryText = response.message?.content || '(要約取得失敗)';

        return {
          subject,
          summary: summaryText,
          original: body,
        };
      } catch (err) {
        console.error(`スレッド ${thread.id} の処理中にエラー:`, err);
        return {
          subject: '(エラー発生)',
          summary: '(要約取得失敗)',
          original: '',
        };
      }
    }));

    res.render('summarized_text', { summaries });

  } catch (err) {
    console.error(err);
    res.status(500).send('メール取得・要約処理でエラーが発生しました。');
  }
});

export default router;
