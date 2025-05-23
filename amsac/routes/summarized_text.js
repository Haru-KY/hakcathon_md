import express from 'express';
import { google } from 'googleapis';
import { Ollama } from 'ollama';
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import knex from '../db/db.js';  // knexを使う前提

const jsonSummaryTagPrompt = ChatPromptTemplate.fromTemplate(
  `以下のメール本文を読み、日本語で要約し、JSON形式で出力してください。
  要約する文がhtml形式の場合、<br>もしくは</br>はすべてなくすようにお願いします。
  出力は必ず1つのJSONコードブロックのみで、他の説明は不要です。

  次のタグのリストの中からメール本文の内容に合致しているタグを、カンマ区切りで正確に抽出してください。関係ない場合は出力しないでください。\n\nタグ一覧: {tags}\n\nメール本文:\n{emailBody}
  次のメール本文の内容に返信が必要かどうかを「はい」または「いいえ」で判別してください。\n\n{emailBody}\n\n返信必要:
  もし、返信が必要であると判断した場合、その重要度を1（低）～3（高）で答えてください。\n重要度が判断できない場合は「0」としてください。\n\n{emailBody}\n\n重要度:

  タグ一覧: {tags}

  出力形式（例）:
  {{ 
    "summary": "これは会議に関するメールです。",
    "tags": ["会議", "予定"]
  }}

  メール本文:
  {emailBody}`
);


const router = express.Router();
const ollama = new Ollama();

const oauth2Client = new google.auth.OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  process.env.REDIRECT_URI
);

// HTMLタグ除去ユーティリティ
function stripHtmlTags(html) {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

function cleanJsonString(str) {
  const match = str.match(/```json\s*([\s\S]*?)```/);
  if (match && match[1]) {
    return match[1].trim();
  }
  return str.trim();
}

// メール本文抽出関数
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

// DBからタグ一覧を取得
async function fetchTags() {
  const rows = await knex('tags').select('id', 'name');
  return rows;
}

// メールをDBに保存（新規 or 更新）
async function saveEmail(email, userId) {
  const exists = await knex('email').where('message_id', email.message_id).first();
  if (exists) {
    await knex('email')
      .where('id', exists.id)
      .update({
        user_id: userId,
        subject: email.subject,
        author: email.from,
        body: email.body,
        summary: email.summary,
        created_at: email.time,
      });
    return exists.id;
  } else {
    const [id] = await knex('email').insert(email);
    return id;
  }
}

// メールタグ関連をDBに保存
async function saveEmailTags(emailId, tagIds) {
  if (!tagIds.length) return;
  await knex('email_tags').where('email_id', emailId).del();
  const insertRows = tagIds.map(tagId => ({
    email_id: emailId,
    tag_id: tagId,
  }));
  await knex('email_tags').insert(insertRows);
}

// // Ollamaプロンプトテンプレート
// const summaryPrompt = new PromptTemplate({
//   template: '次のメール本文を日本語で簡潔に要約してください：\n\n{emailBody}',
//   inputVariables: ['emailBody'],
// });
// const tagPromptTemplate = new PromptTemplate({
//   template: '以下のタグの中から、このメール本文に該当するものをすべてカンマ区切りで列挙してください。\n\nタグ一覧: {tags}\n\nメール本文:\n{emailBody}',
//   inputVariables: ['tags', 'emailBody'],
// });

// LangChainのRunnableSequence作成（OllamaをLLMとして使う想定）
const createOllamaChain = () => {
  return RunnableSequence.from([
    async (input) => {
      return await jsonSummaryTagPrompt.format(input); // ← 明示的に文字列化
    },
    async (formattedPrompt) => {
      const response = await ollama.chat({
        model: 'gemma3:4b',
        messages: [{ role: 'user', content: formattedPrompt }],
      });
      return { text: response.message?.content || '' };
    }
  ]);
};

// 認証済みかどうかをチェックするミドルウェア
function checkAuth(req, res, next) {
  if (!req.session.tokens) {
    return res.status(401).send('未認証です');
  }
  next();
}

// メール要約・タグ付けAPI
router.get('/', checkAuth, async (req, res) => {
  try {
    const userId = req.session.user_id;
    oauth2Client.setCredentials(req.session.tokens);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // タグ取得
    const dbTags = await fetchTags();
    const tagNameToId = {};
    const tagNames = dbTags.map(t => {
      tagNameToId[t.name] = t.id;
      return t.name;
    });

    // スレッドIDをセッションに保持（初回またはリセット時）
    if (!req.session.threadIds || req.query.page === '1') {
      let allThreads = [];
      let nextPageToken = null;
      do {
        const resThreads = await gmail.users.threads.list({
          userId: 'me',
          maxResults: 100,
          pageToken: nextPageToken,
        });
        if (resThreads.data.threads) allThreads = allThreads.concat(resThreads.data.threads);
        nextPageToken = resThreads.data.nextPageToken;
      } while (nextPageToken && allThreads.length < 100);
      req.session.threadIds = allThreads.map(t => t.id);
    }

    const page = parseInt(req.query.page) || 1;
    const pageSize = 5;
    const totalPages = Math.ceil(req.session.threadIds.length / pageSize);
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const threadPage = req.session.threadIds.slice(start, end);

    const results = [];

    const chain = createOllamaChain();

    for (const threadId of threadPage) {
      const detail = await gmail.users.threads.get({ userId: 'me', id: threadId });
      const message = detail.data.messages?.[0];
      if (!message) continue;

      const headers = message.payload.headers || [];
      const subject = headers.find(h => h.name === 'Subject')?.value || '(件名なし)';
      const from = headers.find(h => h.name === 'From')?.value || '(送信者不明)';
      const time = headers.find(h => h.name === 'Date')?.value || new Date().toISOString();
      const body = extractBody(message.payload);

      const output = await chain.invoke({ tags: tagNames.join(', '), emailBody: body });

      let parsed;
      try {

        const cleaned = cleanJsonString(output.text);
        parsed = JSON.parse(cleaned);

      }catch(err)
      {
        console.error("JSON parse error:", err.message);
        console.error("Invalid data was:", output.text.slice(0, 300)); // 内容の先頭だけログに出す
        parsed = { summary: "要約取得失敗", tags: [] }; // 代替処理
      }

      // // Ollama要約
      // const summaryResponse = await ollama.chat({
      //   model: 'gemma3:4b',
      //   messages: [{ role: 'user', content: await summaryPrompt.format({ emailBody: body }) }],
      // });
      // const summary = summaryResponse.message?.content || '(要約取得失敗)';

      // // Ollamaタグ判定
      // const tagResponse = await ollama.chat({
      //   model: 'gemma3:4b',
      //   messages: [{ role: 'user', content: await tagPromptTemplate.format({ tags: tagNames.join(', '), emailBody: body }) }],
      // });
      // const tagContent = tagResponse.message?.content || '';
      // const matchedTags = tagContent.split(',').map(t => t.trim()).filter(t => tagNameToId[t]);

      // DB保存
      const emailRecord = {
        user_id: userId,
        message_id: message.id,
        subject,
        body,
        author: from,
        summary: parsed.summary || '要約なし',
        created_at: new Date(time),
      };
      const emailId = await saveEmail(emailRecord, userId);
      const matchedTags = parsed.tags.filter(t => tagNameToId[t]); // 有効なタグのみ抽出
      await saveEmailTags(emailId, matchedTags.map(t => tagNameToId[t]));

      results.push({
        ...emailRecord,
        // tags: matchedTags,
        tags: parsed.tags,
      });
    }

    const user = await knex('users').where('id', req.session.user_id).first();
    if (!user) {
      return res.status(401).send('ユーザーが存在しません');
    }

    res.redirect('/add');

  } catch (err) {
    console.error(err);
    res.status(500).send('処理中にエラーが発生しました');
  }
});

export default router;
