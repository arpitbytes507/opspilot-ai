import { createHash, randomBytes } from 'node:crypto';

export const generateApiKey = (): { secret: string; keyPrefix: string; keyHash: string } => {
  const secret = `opspk_${randomBytes(32).toString('base64url')}`;
  return {
    secret,
    keyPrefix: secret.slice(0, 14),
    keyHash: createHash('sha256').update(secret).digest('hex'),
  };
};
