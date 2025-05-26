import { google } from 'googleapis';

export async function getAuthorizedClient(session) {
  if (!session.tokens) {
    throw new Error("ログインセッションが存在しません");
  }

  const client = new google.auth.OAuth2(
    process.env.CLIENT_ID,
    process.env.CLIENT_SECRET,
    process.env.REDIRECT_URI
  );

  client.setCredentials(session.tokens);

  const isExpired = session.tokens.expiry_date && session.tokens.expiry_date <= Date.now();

  if (isExpired && session.tokens.refresh_token) {
    try {
      const res = await client.refreshAccessToken();
      const newTokens = res.credentials;

      session.tokens = {
        ...session.tokens,
        access_token: newTokens.access_token,
        expiry_date: newTokens.expiry_date,
      };
      client.setCredentials(session.tokens);
      console.log("アクセストークンを自動リフレッシュしました");
    } catch (err) {
      console.error("トークンリフレッシュ失敗:", err);
      throw new Error("トークンの更新に失敗しました");
    }
  }

  return client;
}

export function requireLogin(req, res, next) {
  if (!req.session.user_id) {  // user_id に統一
    return res.redirect('/login');
  }
  next();
}