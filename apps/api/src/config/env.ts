import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: Number(process.env.PORT || 8000),
  nodeEnv: process.env.NODE_ENV || 'development',
  authCookieName: process.env.AUTH_COOKIE_NAME || 'opspilot_auth',
  authSecret: process.env.AUTH_SECRET || '',
  webOrigin: process.env.WEB_ORIGIN || 'http://localhost:3000',
};
