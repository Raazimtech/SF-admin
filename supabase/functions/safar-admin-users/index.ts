import { createClient } from '@supabase/supabase-js';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...cors, 'Content-Type': 'application/json' },
});

const url = Deno.env.get('SUPABASE_URL')!;
const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const admin = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } });

async function isAdmin(req: Request) {
  const h = req.headers.get('Authorization') || '';
  if (!h.startsWith('Bearer ')) return null;
  const token = h.slice(7).trim();
  if (!token) return null;
  const { data: { user } } = await admin.auth.getUser(token);
  if (!user) return null;
  const { data: a } = await admin.from('safar_admins').select('id').eq('id', user.id).maybeSingle();
  if (!a) return null;
  const { data: p } = await admin.from('profiles').select('role,active').eq('id', user.id).maybeSingle();
  return p?.role === 'admin' && p.active === true ? user : null;
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  try {
    const b = await req.json();

    if (b.action === 'status') {
      const { count, error } = await admin.from('safar_admins').select('id', { count: 'exact', head: true });
      if (error) throw error;
      return json({ hasAdmin: (count || 0) > 0 });
    }

    if (b.action === 'bootstrap') {
      const { count, error } = await admin.from('safar_admins').select('id', { count: 'exact', head: true });
      if (error) throw error;
      if ((count || 0) > 0) return json({ error: 'Primary admin already exists. Please sign in.' }, 409);

      const email = String(b.email || '').trim().toLowerCase();
      const fullName = String(b.full_name || '').trim();
      const password = String(b.password || '');
      if (!email || !password || !fullName) return json({ error: 'Name, email and password are required.' }, 400);
      if (password.length < 8) return json({ error: 'Password must be at least 8 characters.' }, 400);

      const { data, error: a } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      if (a) throw a;
      const { error: p } = await admin.from('profiles').upsert({
        id: data.user.id,
        full_name: fullName,
        role: 'admin',
        active: true,
        branch_id: null,
      }, { onConflict: 'id' });
      if (p) {
        await admin.auth.admin.deleteUser(data.user.id);
        throw p;
      }
      const { error: x } = await admin.from('safar_admins').insert({ id: data.user.id, full_name: fullName });
      if (x) {
        await admin.from('profiles').delete().eq('id', data.user.id);
        await admin.auth.admin.deleteUser(data.user.id);
        return json({ error: 'Primary admin already exists. Please sign in.' }, 409);
      }
      return json({ ok: true });
    }

    const user = await isAdmin(req);
    if (!user) return json({ error: 'Administrator authentication required.' }, 401);

    if (b.action === 'create_user') {
      const email = String(b.email || '').trim().toLowerCase();
      const fullName = String(b.full_name || '').trim();
      const password = String(b.password || '');
      const branchId = String(b.branch_id || '').trim();
      if (!email || !password || !fullName || !branchId) return json({ error: 'Name, email, password and terminal are required.' }, 400);
      if (password.length < 8) return json({ error: 'Password must be at least 8 characters.' }, 400);
      const { data: branch, error: be } = await admin.from('branches').select('id').eq('id', branchId).maybeSingle();
      if (be) throw be;
      if (!branch) return json({ error: 'Selected terminal does not exist.' }, 400);
      const { data, error: a } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      if (a) throw a;
      const { error: p } = await admin.from('profiles').upsert({
        id: data.user.id,
        full_name: fullName,
        phone: b.phone ? String(b.phone).trim() : null,
        role: 'staff',
        branch_id: branchId,
        active: true,
      }, { onConflict: 'id' });
      if (p) {
        await admin.auth.admin.deleteUser(data.user.id);
        throw p;
      }
      return json({ ok: true });
    }

    if (b.action === 'disable_user') {
      const userId = String(b.user_id || '').trim();
      if (!userId) return json({ error: 'User id required.' }, 400);
      if (userId === user.id) return json({ error: 'You cannot disable the primary administrator.' }, 400);
      const { data: target, error: te } = await admin.from('profiles').select('id,role').eq('id', userId).maybeSingle();
      if (te) throw te;
      if (!target || target.role !== 'staff') return json({ error: 'Only staff accounts can be disabled here.' }, 400);
      const { error: p } = await admin.from('profiles').update({ active: false }).eq('id', userId).eq('role', 'staff');
      if (p) throw p;
      const { error: a } = await admin.auth.admin.updateUserById(userId, { ban_duration: '876000h' });
      if (a) throw a;
      return json({ ok: true });
    }

    return json({ error: 'Unknown action.' }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : 'Server error.' }, 500);
  }
});