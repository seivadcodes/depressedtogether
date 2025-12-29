import { NextApiRequest, NextApiResponse } from 'next';
import { AccessToken } from 'livekit-server-sdk';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { room, identity } = req.body;
  
  const at = new AccessToken(
    process.env.LIVEKIT_API_KEY!,
    process.env.LIVEKIT_API_SECRET!,
    { identity }
  );
  
  at.addGrant({ room, canPublish: true, canSubscribe: true });
  
  res.status(200).json({ token: at.toJwt() });
}