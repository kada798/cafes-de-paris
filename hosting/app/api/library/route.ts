import { env } from 'cloudflare:workers';
import { engagementEndpoint } from '../../../../server/services/engagement.mjs';
import reading from '../../../../content/reading-sources.json';
export const dynamic = 'force-dynamic';
const allowedOrigins = ['https://kada798.github.io'];
function cors(request: Request, response: Response) {
  const origin=request.headers.get('origin');
  if(origin && allowedOrigins.includes(origin)) {
    response.headers.set('Access-Control-Allow-Origin',origin);
    response.headers.set('Access-Control-Allow-Methods','GET, POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers','Content-Type');
    response.headers.set('Vary','Origin');
  }
  return response;
}
export async function OPTIONS(request: Request) { return cors(request,new Response(null,{status:allowedOrigins.includes(request.headers.get('origin')||'')?204:403})); }
export async function GET(request: Request) { return cors(request,await engagementEndpoint(request, env.DB, reading.sources.map(s=>s.id), { trustedIdentity:true,allowedOrigins })); }
export async function POST(request: Request) { return cors(request,await engagementEndpoint(request, env.DB, reading.sources.map(s=>s.id), { trustedIdentity:true,allowedOrigins })); }
