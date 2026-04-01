import crypto from 'crypto';

const SECRET = process.env.SUPABASE_SERVICE_ROLE_KEY || 'fallback-secret-change-me';

export function generateWidgetToken(workspaceId: string): string {
  const payload = JSON.stringify({
    wid: workspaceId,
    iat: Date.now(),
  });
  const encoded = Buffer.from(payload).toString('base64url');
  const signature = crypto
    .createHmac('sha256', SECRET)
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${signature}`;
}

export function verifyWidgetToken(token: string): string | null {
  try {
    const [encoded, signature] = token.split('.');
    if (!encoded || !signature) return null;

    const expectedSig = crypto
      .createHmac('sha256', SECRET)
      .update(encoded)
      .digest('base64url');

    if (signature !== expectedSig) return null;

    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString());
    return payload.wid || null;
  } catch {
    return null;
  }
}
