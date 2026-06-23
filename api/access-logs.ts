import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

const filePath = path.join(process.cwd(), 'access-logs.json');

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, JSON.stringify({ logs: [] }, null, 2));
        return res.status(200).json({ ok: true, logs: [] });
      }
      const fileData = fs.readFileSync(filePath, 'utf8');
      const data = JSON.parse(fileData);
      return res.status(200).json({ ok: true, logs: data.logs || [] });
    } catch (error: any) {
      return res.status(500).json({ ok: false, error: error.message });
    }
  }
  return res.status(405).json({ ok: false, error: 'Metodo non consentito' });
}
