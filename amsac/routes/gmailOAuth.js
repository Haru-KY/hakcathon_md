import express from 'express';
import { google } from 'googleapis';
import knex from '../db/db.js';  // knexを使う前提

const router = express.Router();

const oauth2Client = new google.auth.OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  process.env.REDIRECT_URI
);

console.log('CLIENT_ID:', process.env.CLIENT_ID);

// 1. Googleの認証画面にユーザを飛ばすためのURLを生成してリダイレクト
router.get('/auth/google', function (req, res){
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/userinfo.email'
    ],
    client_id: process.env.CLIENT_ID,
    redirect_uri: process.env.REDIRECT_URI
  });
  res.redirect(url);
});

// 2. Google認証後にコールバックされるURLで認証コードを受け取り、トークンを取得する
router.get('/', async function (req, res) {
    console.log('callback session userid:', req.session.userid);
  const code = req.query.code;
  if (!code) {
    return res.status(400).send('認証コードがありません');
  }

  try {
    // OAuthクライアント作成
    const client = new google.auth.OAuth2(
      process.env.CLIENT_ID,
      process.env.CLIENT_SECRET,
      process.env.REDIRECT_URI
    );

    // トークン取得
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);

    // セッションにトークン保存
    req.session.tokens = tokens;

    // ユーザー情報をGoogle APIから取得
    const oauth2 = google.oauth2({
      auth: client,
      version: 'v2',
    });
    const userInfoResponse = await oauth2.userinfo.get();
    const email = userInfoResponse.data.email;

    // DBにユーザー確認・登録
    let user = await knex('users').where('email', email).first();
    if (!user) {
    const [insertId] = await knex('users').insert({ name: email });
    user = await knex('users').where('id', insertId).first();
    }
    req.session.user_id = user.id;

    // ユーザーIDをセッションにセット
    req.session.user_id = user.id;

    // 認証後のページへリダイレクト
    res.redirect('/summary');

  } catch (error) {
    console.error('トークン取得エラー:', error);
    res.status(500).send('認証に失敗しました');
  }
});

export default router;
