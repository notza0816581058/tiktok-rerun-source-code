import { currentIdentity } from '@/lib/auth';
import { handleDemoApi } from '@/lib/demo/api';

export const dynamic = 'force-dynamic';

async function handle(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const identity = await currentIdentity();
  if (!identity) return Response.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
  const { path } = await context.params;
  return handleDemoApi(request, path, identity.username);
}

export { handle as GET, handle as POST, handle as PUT, handle as PATCH, handle as DELETE };
