import express from 'express';
import { google } from 'googleapis';
import { Ollama } from 'ollama';
import { PromptTemplate } from '@langchain/core/prompts';
import { RunnableSequence } from "@langchain/core/runnables";
import knex from '../db/db.js';  // knexを使う前提

const summaryPrompt = PromptTemplate.fromTemplate(
  "次のメール本文を日本語で簡潔に要約してください：\n\n{emailBody}"
);

// タグ判定用プロンプト（変更済み）
const tagPromptTemplate = PromptTemplate.fromTemplate(
  "次のメール本文の内容に合致しているタグを、タグリストの中からカンマ区切りで正確に抽出してください。関係ない場合は出力しないでください。\n\nタグ一覧: {tags}\n\nメール本文:\n{emailBody}"
);
// 返信要否判定用プロンプト
const replyPrompt = PromptTemplate.fromTemplate(
  `次のメール本文の内容にに返信が必要かどうかを「はい」または「いいえ」で判別してください。\n\n{emailBody}\n\n返信必要:`
);

// 返信重要度判定用プロンプト
const priorityPrompt = PromptTemplate.fromTemplate(
  `次のメールに返信が必要な場合、その重要度を1（低）～3（高）で答えてください。\n重要度が判断できない場合は「0」としてください。\n\n{emailBody}\n\n重要度:`
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
        needs_reply: parsed.needs_reply === 'はい' ? 1 : 0,
        reply_importance: Number(parsed.reply_importance) || 0
      });
    return exists.id;
  } else {
    const [id] = await knex('email').insert(email);
    return id;
  }
}

// メールタグ関連をDBに保存
async function saveEmailTags(emailId, tagIds, userId) {
  if (!tagIds.length) return;

  // 実在する tag_id だけを取得
  const validTags = await knex('ai_tags')
    .whereIn('id', tagIds)
    .pluck('id');
  if (!validTags.length) return;

  await knex('email_ai_tags').where({ email_id: emailId }).del();

  // 古い関連タグを削除
  for (const tagId of validTags) {
    try {
      await knex('email_ai_tags')
        .insert({ email_id: emailId, tag_id: tagId, user_id: userId })
        .onConflict(['email_id', 'tag_id', 'user_id'])
        .ignore();
    } catch (err) {
      console.error(`email_ai_tags挿入エラー:`, err);
    }
  }
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
  return async ({ tags, emailBody }) => {
    const formattedSummary = await summaryPrompt.format({ emailBody });
    const summaryResponse = await ollama.chat({
      model: 'gemma3:4b',
      messages: [{ role: 'user', content: formattedSummary }],
    });

    const formattedTags = await tagPromptTemplate.format({ tags, emailBody });
    const tagResponse = await ollama.chat({
      model: 'gemma3:4b',
      messages: [{ role: 'user', content: formattedTags }],
    });

    const formattedReply = await replyPrompt.format({ emailBody });
    const replyResponse = await ollama.chat({
      model: 'gemma3:4b',
      messages: [{ role: 'user', content: formattedReply }],
    });

    const replyText = replyResponse.message?.content.trim().toLowerCase();
    let priority = "0";

    if (replyText === "はい") {
      const formattedPriority = await priorityPrompt.format({ emailBody });
      const priorityResponse = await ollama.chat({
        model: 'gemma3:4b',
        messages: [{ role: 'user', content: formattedPriority }],
      });
      priority = priorityResponse.message?.content.trim() || "0";
    }

    return {
      summary: summaryResponse.message?.content.trim() || "要約なし",
      tags: tagResponse.message?.content.split(',').map(t => t.trim()).filter(Boolean) || [],
      needs_reply: replyText === "はい" ? "はい" : "いいえ",
      reply_importance: priority,
    };
  };
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

    async function fetchAiTags() {
    const rows = await knex('ai_tags').select('id', 'name');
    return rows;
    }
    const dbTags = await fetchAiTags();
    const tagNameToId = {};
    const tagNames = dbTags.map(t => {
      tagNameToId[t.name] = t.id;
      return t.name;
    });

    // スレッドIDをセッションに保持（初回またはリセット時）
    if (!req.session.threadIds || req.session.threadIds.length === 0) {
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
    const totalThreads = req.session.threadIds.length;
    const totalPages = Math.ceil(totalThreads / pageSize);

    const maxCursor = Math.max(0, totalThreads - pageSize);
    let cursor = (page - 1) * pageSize;
    if (cursor > maxCursor) cursor = maxCursor;

    const threadPage = req.session.threadIds.slice(cursor, cursor + pageSize);
        const results = [];
        const chain = createOllamaChain();

    for (const threadId of threadPage) {
      const detail = await gmail.users.threads.get({ userId: 'me', id: threadId });
      const message = detail.data.messages?.[0];
      if (!message) continue;

      const messageId = message.id;

      const exists = await knex('email').where({ message_id: messageId }).first();
      if (exists) continue;

      const headers = message.payload.headers || [];
      const subject = headers.find(h => h.name === 'Subject')?.value || '(件名なし)';
      const from = headers.find(h => h.name === 'From')?.value || '(送信者不明)';
      const time = headers.find(h => h.name === 'Date')?.value || new Date().toISOString();
      const body = extractBody(message.payload);

      const output = await chain({ tags: tagNames.join(', '), emailBody: body });
      console.log("chain output:", output);


      let parsed;
      try {
        parsed = output;
      } catch (err) {
        console.error("JSON parse error:", err.message);
        console.error("Invalid data was:", output.text.slice(0, 300));
        parsed = { summary: "要約取得失敗", tags: [] };
      }

      const emailRecord = {
        user_id: userId,
        message_id: messageId,
        subject,
        body,
        author: from,
        summary: output.summary || '要約なし',
        created_at: new Date(time),
        needs_reply: output.needs_reply === 'はい' ? 1 : 0,
        reply_importance: Number(output.reply_importance) || 0,
      };
      const emailId = await saveEmail(emailRecord, userId);
      const matchedTags = Array.isArray(parsed.tags) ? parsed.tags.filter(t => tagNameToId[t]) : [];

      await saveEmailTags(emailId, matchedTags.map(t => tagNameToId[t]), userId);

      results.push({
        ...emailRecord,
        tags: parsed.tags,
      });
    }

    const user = await knex('users').where('id', req.session.user_id).first();
    if (!user) {
      return res.status(401).send('ユーザーが存在しません');
    }

    const currentPage = parseInt(req.query.page) || 1;
    const safePage = currentPage <= totalPages ? currentPage : totalPages;
    res.redirect(`/add?page=${safePage}`);


  } catch (err) {
    console.error(err);
    res.status(500).send('処理中にエラーが発生しました');
  }
});

export default router;
