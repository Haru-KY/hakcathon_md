import express from 'express';
import { google } from 'googleapis';
import knex from '../db/db.js';  // knexを使う前提

const router = express.Router();

const oauth2Client = new google.auth.OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  process.env.REDIRECT_URI
);

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
    // トークン取得
    const client = new google.auth.OAuth2(
      process.env.CLIENT_ID,
      process.env.CLIENT_SECRET,
      process.env.REDIRECT_URI
    );
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);
    req.session.tokens = tokens;

    // メールアドレス取得
    const oauth2 = google.oauth2({ auth: client, version: 'v2' });
    const userInfoResponse = await oauth2.userinfo.get();
    const email = userInfoResponse.data.email;

    // DBにすでに同じemailがあるか確認
    const existingUser = await knex('users').where({ email }).first();

    // セッションのユーザーIDと一致しない＝他ユーザーが既にこのメールを使用
    if (existingUser && existingUser.id !== req.session.userid) {
      console.warn('メールアドレスが既存ユーザーと競合しています');
      return res.redirect('/login?error=メールアドレスが他のアカウントに使用されています');
    }

    // 新規 or 一致 → 更新または作成
    let user;
    if (!existingUser) {
      await knex('users').where({ id: req.session.userid }).update({ email }); // セッション中のユーザーにemailを登録
      user = await knex('users').where({ id: req.session.userid }).first();
    } else {
      user = existingUser;
    }

    req.session.user_id = user.id;
    res.redirect('/summary');

  } catch (error) {
    console.error('トークン取得エラー:', error);
    res.status(500).send('認証に失敗しました');
  }
});

export default router;
