import express from 'express';
import { google } from 'googleapis';

const router = express.Router();

const oauth2Client = new google.auth.OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  process.env.REDIRECT_URI
);

// 1. Googleの認証画面にユーザを飛ばすためのURLを生成してリダイレクト
router.get('/login', function (req, res) {
  const scopes = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/userinfo.profile'
  ];
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',  // リフレッシュトークンも取得する
    scope: scopes,
    prompt: 'consent'        // 毎回同意画面を出す
  });
  res.redirect(authUrl);
});

// 2. Google認証後にコールバックされるURLで認証コードを受け取り、トークンを取得する
router.get('/callback', async function (req, res) {
  const code = req.query.code;
  const userId = req.session.userid;

  if (!userId) return res.redirect('/login');

  if (!code) {
    return res.status(400).send('認証コードがありません');
  }

  try {
    const { tokens } = await oauth2Client.getToken(code); // トークン取得
    oauth2Client.setCredentials(tokens);

    // 3. セッションなどにトークンを保存（ここではセッションに保存例）
    req.session.tokens = tokens;

    // 4. 認証完了後に次の処理へリダイレクト（例：メール処理ページ）
    res.redirect('/summary');

  } catch (error) {
    console.error('トークン取得エラー:', error);
    res.status(500).send('認証に失敗しました');
  }
});

export default router;
