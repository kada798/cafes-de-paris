import { env } from 'cloudflare:workers';
import { engagementEndpoint } from '../../../../server/services/engagement.mjs';
import reading from '../../../../content/reading-sources.json';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) { return engagementEndpoint(request, env.DB, reading.sources.map(s=>s.id), { trustedIdentity:true }); }
export async function POST(request: Request) { return engagementEndpoint(request, env.DB, reading.sources.map(s=>s.id), { trustedIdentity:true }); }
