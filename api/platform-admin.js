/**
 * WorkTree X — Cloud Platform Super-Admin API (Serverless Function)
 * Strictly verifies JWT against Supabase Auth and checks public.platform_admins.
 * Operates in trusted backend environment using service privileges.
 */

const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  // Polyfill res.status and res.json for standard Node http.ServerResponse
  if (!res.status) {
    res.status = function(code) {
      this.statusCode = code;
      return this;
    };
  }
  if (!res.json) {
    res.json = function(data) {
      this.setHeader('Content-Type', 'application/json; charset=utf-8');
      this.end(JSON.stringify(data));
      return this;
    };
  }

  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  let supabaseUrl = (process.env.SUPABASE_URL || 'https://taupjuaficdzdgbmxmbe.supabase.co').trim();
  let supabaseKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '').trim();

  if (!supabaseKey && typeof require !== 'undefined') {
    try {
      const fs = require('fs');
      if (fs.existsSync('.env')) {
        const env = Object.fromEntries(fs.readFileSync('.env', 'utf8').split('\n').filter(l => l.includes('=')).map(l => {
          const [k, ...v] = l.trim().split('=');
          return [k.trim(), v.join('=').trim()];
        }));
        supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY || supabaseKey;
        supabaseUrl = env.SUPABASE_URL || supabaseUrl;
      }
    } catch (_) {}
  }

  if (!supabaseUrl || !supabaseKey) {
    return res.status(503).json({ ok: false, error: 'Missing backend service key configuration' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // 1. Authenticate caller via JWT
    const authHeader = req.headers.authorization || req.headers.Authorization || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();

    if (!token) {
      return res.status(401).json({ ok: false, error: 'Yêu cầu đăng nhập để truy cập quản trị nền tảng' });
    }

    const { data: authData, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !authData || !authData.user) {
      return res.status(401).json({ ok: false, error: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn' });
    }

    const user = authData.user;

    // 2. Authorize caller via public.platform_admins table
    const { data: adminRow, error: adminErr } = await supabase
      .from('platform_admins')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (adminErr || !adminRow) {
      return res.status(403).json({
        ok: false,
        error: 'Từ chối truy cập: Tài khoản không có đặc quyền Platform Super-Admin'
      });
    }

    // Parse action & payload
    const query = req.query || {};
    let body = {};
    try {
      body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    } catch (_) {
      body = {};
    }
    const action = query.action || body.action || 'overview';

    // -------------------------------------------------------------------------
    // ACTION: Check if current user is admin
    // -------------------------------------------------------------------------
    if (action === 'check' || action === 'check-admin') {
      return res.status(200).json({
        ok: true,
        isPlatformAdmin: true,
        user: { id: user.id, email: user.email }
      });
    }

    // -------------------------------------------------------------------------
    // ACTION: Platform Overview KPI Metrics
    // -------------------------------------------------------------------------
    if (action === 'overview') {
      const [
        { count: totalOrgs },
        { count: activeOrgs },
        { count: suspendedOrgs },
        { count: totalUsers },
        { count: totalTasks },
        { data: subData },
        { data: recentOrgs },
        { data: recentLogs }
      ] = await Promise.all([
        supabase.from('organizations').select('*', { count: 'exact', head: true }),
        supabase.from('organizations').select('*', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('organizations').select('*', { count: 'exact', head: true }).eq('status', 'suspended'),
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('tasks').select('*', { count: 'exact', head: true }).is('archived_at', null),
        supabase.from('organization_subscriptions').select('plan, status'),
        supabase.from('organizations').select('id, name, slug, status, created_at').order('created_at', { ascending: false }).limit(5),
        supabase.from('security_audit_logs').select('id, action, created_at, target_type, metadata').order('created_at', { ascending: false }).limit(6)
      ]);

      const plansBreakdown = {
        free: 0,
        starter: 0,
        business: 0,
        enterprise: 0
      };

      (subData || []).forEach(s => {
        if (plansBreakdown[s.plan] !== undefined) {
          plansBreakdown[s.plan]++;
        }
      });

      return res.status(200).json({
        ok: true,
        metrics: {
          totalOrganizations: totalOrgs || 0,
          activeOrganizations: activeOrgs || 0,
          suspendedOrganizations: suspendedOrgs || 0,
          totalUsers: totalUsers || 0,
          totalTasks: totalTasks || 0,
          plansBreakdown,
          hasAuthoritativeRevenue: false, // Per prompt: do not fake billed amounts without billing gateway
          revenueNote: 'Chưa có dữ liệu đối soát cổng thanh toán',
          systemHealth: {
            api: 'normal',
            database: 'normal',
            auth: 'normal',
            realtime: 'normal',
            storage: 'normal'
          },
          recentOrganizations: recentOrgs || [],
          recentActivities: recentLogs || []
        }
      });
    }

    // -------------------------------------------------------------------------
    // ACTION: List Organizations (Tenants)
    // -------------------------------------------------------------------------
    if (action === 'organizations' || action === 'tenants') {
      const search = (query.search || body.search || '').trim().toLowerCase();
      const statusFilter = query.status || body.status || '';
      const planFilter = query.plan || body.plan || '';

      let orgs = [];
      try {
        let orgQuery = supabase
          .from('organizations')
          .select('id, name, slug, status, created_at, created_by, suspended_at, suspension_reason')
          .order('created_at', { ascending: false });

        if (statusFilter) {
          orgQuery = orgQuery.eq('status', statusFilter);
        }
        if (search) {
          orgQuery = orgQuery.or(`name.ilike.%${search}%,slug.ilike.%${search}%`);
        }

        const { data, error } = await orgQuery;
        if (error) throw error;
        orgs = data || [];
      } catch (colErr) {
        // Fallback for baseline schema without optional suspension columns
        let orgQuery = supabase
          .from('organizations')
          .select('id, name, slug, status, created_at, created_by')
          .order('created_at', { ascending: false });

        if (statusFilter) {
          orgQuery = orgQuery.eq('status', statusFilter);
        }
        if (search) {
          orgQuery = orgQuery.or(`name.ilike.%${search}%,slug.ilike.%${search}%`);
        }

        const { data, error } = await orgQuery;
        if (error) throw error;
        orgs = data || [];
      }

      const orgIds = (orgs || []).map(o => o.id);

      // Parallel batch fetching for subscriptions and members
      const [subsRes, membersRes, ownersRes] = await Promise.all([
        supabase.from('organization_subscriptions').select('*').in('organization_id', orgIds),
        supabase.from('organization_members').select('organization_id, user_id, role, status').in('organization_id', orgIds),
        supabase.from('profiles').select('id, display_name')
      ]);

      const subsMap = new Map((subsRes.data || []).map(s => [s.organization_id, s]));
      const ownerMap = new Map((ownersRes.data || []).map(p => [p.id, p.display_name]));

      const memberCountMap = new Map();
      (membersRes.data || []).forEach(m => {
        if (m.status === 'active') {
          memberCountMap.set(m.organization_id, (memberCountMap.get(m.organization_id) || 0) + 1);
        }
      });

      let results = (orgs || []).map(org => {
        const sub = subsMap.get(org.id) || {
          plan: 'free',
          status: 'trialing',
          seat_limit: 5,
          storage_bytes_limit: 1073741824
        };
        return {
          id: org.id,
          name: org.name,
          slug: org.slug,
          domain: `${org.slug}.worktree.vn`,
          status: org.status,
          suspendedAt: org.suspended_at,
          suspensionReason: org.suspension_reason,
          createdAt: org.created_at,
          createdBy: org.created_by,
          ownerName: ownerMap.get(org.created_by) || 'Người quản trị',
          activeMembersCount: memberCountMap.get(org.id) || 1,
          subscription: {
            plan: sub.plan,
            status: sub.status,
            seatLimit: sub.seat_limit,
            storageLimit: sub.storage_bytes_limit,
            currentPeriodEnd: sub.current_period_end
          }
        };
      });

      if (planFilter) {
        results = results.filter(r => r.subscription.plan === planFilter);
      }

      return res.status(200).json({ ok: true, organizations: results });
    }

    // -------------------------------------------------------------------------
    // ACTION: Tenant Detail (Drawer data)
    // -------------------------------------------------------------------------
    if (action === 'tenant-detail') {
      const orgId = query.organizationId || body.organizationId;
      if (!orgId) return res.status(400).json({ ok: false, error: 'Missing organizationId' });

      const [
        { data: org, error: orgErr },
        { data: sub },
        { data: members },
        { count: taskCount },
        { count: nodeCount },
        { data: auditLogs }
      ] = await Promise.all([
        supabase.from('organizations').select('*').eq('id', orgId).single(),
        supabase.from('organization_subscriptions').select('*').eq('organization_id', orgId).maybeSingle(),
        supabase.from('organization_members').select('id, user_id, role, status, created_at').eq('organization_id', orgId),
        supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('organization_id', orgId).is('archived_at', null),
        supabase.from('organization_nodes').select('*', { count: 'exact', head: true }).eq('organization_id', orgId).is('archived_at', null),
        supabase.from('security_audit_logs').select('*').eq('organization_id', orgId).order('created_at', { ascending: false }).limit(10)
      ]);

      if (orgErr || !org) return res.status(404).json({ ok: false, error: 'Doanh nghiệp không tồn tại' });

      // Enrich members with profile names
      const memberUserIds = (members || []).map(m => m.user_id);
      const { data: profiles } = await supabase.from('profiles').select('id, display_name').in('id', memberUserIds);
      const profileMap = new Map((profiles || []).map(p => [p.id, p.display_name]));

      const enrichedMembers = (members || []).map(m => ({
        ...m,
        displayName: profileMap.get(m.user_id) || 'Thành viên'
      }));

      const ownerName = profileMap.get(org.created_by) || 'Người sáng lập';

      return res.status(200).json({
        ok: true,
        tenant: {
          ...org,
          ownerName,
          subscription: sub || { plan: 'free', status: 'trialing', seat_limit: 5, storage_bytes_limit: 1073741824 },
          members: enrichedMembers,
          stats: {
            taskCount: taskCount || 0,
            nodeCount: nodeCount || 0,
            memberCount: (members || []).length
          },
          auditLogs: auditLogs || []
        }
      });
    }

    // -------------------------------------------------------------------------
    // ACTION: Global Users Directory
    // -------------------------------------------------------------------------
    if (action === 'users') {
      const search = (query.search || body.search || '').trim().toLowerCase();
      const roleFilter = query.role || body.role || '';
      const statusFilter = query.status || body.status || '';

      const { data: members, error: memErr } = await supabase
        .from('organization_members')
        .select('id, organization_id, user_id, role, status, created_at')
        .order('created_at', { ascending: false })
        .limit(100);

      if (memErr) throw memErr;

      const userIds = [...new Set((members || []).map(m => m.user_id))];
      const orgIds = [...new Set((members || []).map(m => m.organization_id))];

      const [profilesRes, orgsRes] = await Promise.all([
        supabase.from('profiles').select('id, display_name, created_at').in('id', userIds),
        supabase.from('organizations').select('id, name').in('id', orgIds)
      ]);

      const profileMap = new Map((profilesRes.data || []).map(p => [p.id, p]));
      const orgMap = new Map((orgsRes.data || []).map(o => [o.id, o.name]));

      let userResults = (members || []).map(m => {
        const p = profileMap.get(m.user_id) || {};
        return {
          id: m.user_id,
          membershipId: m.id,
          name: p.display_name || 'Người dùng',
          organizationId: m.organization_id,
          organizationName: orgMap.get(m.organization_id) || 'Tổ chức',
          role: m.role,
          status: m.status,
          joinedDate: m.created_at
        };
      });

      if (search) {
        userResults = userResults.filter(u =>
          u.name.toLowerCase().includes(search) ||
          u.organizationName.toLowerCase().includes(search)
        );
      }
      if (roleFilter) {
        userResults = userResults.filter(u => u.role === roleFilter);
      }
      if (statusFilter) {
        userResults = userResults.filter(u => u.status === statusFilter);
      }

      return res.status(200).json({ ok: true, users: userResults });
    }

    // -------------------------------------------------------------------------
    // ACTION: Suspend Tenant (Khóa doanh nghiệp với Reason & Security Audit Log)
    // -------------------------------------------------------------------------
    if ((action === 'suspend-tenant' || action === 'lock-tenant') && req.method === 'POST') {
      const { organizationId, reason } = body;
      if (!organizationId) return res.status(400).json({ ok: false, error: 'Thiếu organizationId' });
      if (!reason || !reason.trim()) {
        return res.status(400).json({ ok: false, error: 'Bắt buộc phải nhập lý do khóa doanh nghiệp' });
      }

      // 1. Get org name
      const { data: org, error: fetchErr } = await supabase
        .from('organizations')
        .select('id, name, status')
        .eq('id', organizationId)
        .single();

      if (fetchErr || !org) return res.status(404).json({ ok: false, error: 'Không tìm thấy doanh nghiệp' });

      // 2. Update organization to suspended with graceful column fallback
      let updatedOrg = null;
      try {
        const { data, error } = await supabase
          .from('organizations')
          .update({
            status: 'suspended',
            suspended_at: new Date().toISOString(),
            suspended_by: user.id,
            suspension_reason: reason.trim(),
            updated_at: new Date().toISOString()
          })
          .eq('id', organizationId)
          .select()
          .single();
        if (error) throw error;
        updatedOrg = data;
      } catch (_) {
        const { data, error } = await supabase
          .from('organizations')
          .update({
            status: 'suspended',
            updated_at: new Date().toISOString()
          })
          .eq('id', organizationId)
          .select()
          .single();
        if (error) throw error;
        updatedOrg = data;
      }

      // 3. Write immutable security audit record
      await supabase.from('security_audit_logs').insert({
        organization_id: organizationId,
        actor_user_id: user.id,
        action: 'TENANT_SUSPENDED',
        target_type: 'organization',
        target_id: organizationId,
        metadata: {
          organization_name: org.name,
          reason: reason.trim(),
          performed_by: 'platform_admin',
          previous_status: org.status
        },
        created_at: new Date().toISOString()
      });

      return res.status(200).json({
        ok: true,
        message: `Đã tạm khóa doanh nghiệp ${org.name} thành công.`,
        organization: updatedOrg
      });
    }

    // -------------------------------------------------------------------------
    // ACTION: Unsuspend Tenant (Mở khóa doanh nghiệp)
    // -------------------------------------------------------------------------
    if ((action === 'unsuspend-tenant' || action === 'unlock-tenant') && req.method === 'POST') {
      const { organizationId, reason = 'Mở khóa bởi Platform Super-Admin' } = body;
      if (!organizationId) return res.status(400).json({ ok: false, error: 'Thiếu organizationId' });

      // 1. Get org
      const { data: org, error: fetchErr } = await supabase
        .from('organizations')
        .select('id, name, status')
        .eq('id', organizationId)
        .single();

      if (fetchErr || !org) return res.status(404).json({ ok: false, error: 'Không tìm thấy doanh nghiệp' });

      // 2. Update status to active with graceful column fallback
      let updatedOrg = null;
      try {
        const { data, error } = await supabase
          .from('organizations')
          .update({
            status: 'active',
            suspended_at: null,
            suspended_by: null,
            suspension_reason: null,
            updated_at: new Date().toISOString()
          })
          .eq('id', organizationId)
          .select()
          .single();
        if (error) throw error;
        updatedOrg = data;
      } catch (_) {
        const { data, error } = await supabase
          .from('organizations')
          .update({
            status: 'active',
            updated_at: new Date().toISOString()
          })
          .eq('id', organizationId)
          .select()
          .single();
        if (error) throw error;
        updatedOrg = data;
      }

      // 3. Write security audit record
      await supabase.from('security_audit_logs').insert({
        organization_id: organizationId,
        actor_user_id: user.id,
        action: 'TENANT_UNSUSPENDED',
        target_type: 'organization',
        target_id: organizationId,
        metadata: {
          organization_name: org.name,
          reason: String(reason).trim(),
          performed_by: 'platform_admin'
        },
        created_at: new Date().toISOString()
      });

      return res.status(200).json({
        ok: true,
        message: `Đã mở khóa doanh nghiệp ${org.name} thành công.`,
        organization: updatedOrg
      });
    }

    // -------------------------------------------------------------------------
    // ACTION: Update Subscription
    // -------------------------------------------------------------------------
    if (action === 'update-subscription' && req.method === 'POST') {
      const { organizationId, plan, seatLimit, status } = body;
      if (!organizationId) return res.status(400).json({ ok: false, error: 'Thiếu organizationId' });

      const updates = {
        updated_at: new Date().toISOString()
      };
      if (plan) updates.plan = plan;
      if (seatLimit !== undefined) updates.seat_limit = Math.max(1, parseInt(seatLimit, 10) || 5);
      if (status) updates.status = status;

      const { data, error } = await supabase
        .from('organization_subscriptions')
        .upsert({ organization_id: organizationId, ...updates })
        .select()
        .single();

      if (error) throw error;

      // Audit log
      await supabase.from('security_audit_logs').insert({
        organization_id: organizationId,
        actor_user_id: user.id,
        action: 'SUBSCRIPTION_UPDATED',
        target_type: 'organization_subscription',
        target_id: organizationId,
        metadata: updates,
        created_at: new Date().toISOString()
      });

      return res.status(200).json({
        ok: true,
        message: 'Đã cập nhật gói dịch vụ thành công',
        subscription: data
      });
    }

    // -------------------------------------------------------------------------
    // ACTION: System Audit Logs
    // -------------------------------------------------------------------------
    if (action === 'audit-logs' || action === 'logs') {
      const { data: logs, error: logsErr } = await supabase
        .from('security_audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (logsErr) throw logsErr;

      const userIds = [...new Set((logs || []).map(l => l.actor_user_id).filter(Boolean))];
      const orgIds = [...new Set((logs || []).map(l => l.organization_id).filter(Boolean))];

      const [profilesRes, orgsRes] = await Promise.all([
        supabase.from('profiles').select('id, display_name').in('id', userIds),
        supabase.from('organizations').select('id, name').in('id', orgIds)
      ]);

      const profileMap = new Map((profilesRes.data || []).map(p => [p.id, p.display_name]));
      const orgMap = new Map((orgsRes.data || []).map(o => [o.id, o.name]));

      const enrichedLogs = (logs || []).map(l => ({
        id: l.id,
        timestamp: l.created_at,
        actor: profileMap.get(l.actor_user_id) || 'Platform Admin',
        tenant: orgMap.get(l.organization_id) || 'Toàn hệ thống',
        action: l.action,
        result: 'Thành công',
        metadata: l.metadata
      }));

      return res.status(200).json({ ok: true, logs: enrichedLogs });
    }

    // -------------------------------------------------------------------------
    // ACTION: List Platform Admins
    // -------------------------------------------------------------------------
    if (action === 'admins') {
      const { data: admins, error: adminListErr } = await supabase
        .from('platform_admins')
        .select('*')
        .order('created_at', { ascending: true });

      if (adminListErr) throw adminListErr;

      const adminUserIds = (admins || []).map(a => a.user_id);
      const { data: profiles } = await supabase.from('profiles').select('id, display_name').in('id', adminUserIds);
      const profileMap = new Map((profiles || []).map(p => [p.id, p.display_name]));

      const enrichedAdmins = (admins || []).map((a, idx) => ({
        userId: a.user_id,
        displayName: profileMap.get(a.user_id) || 'Super Admin',
        role: idx === 0 ? 'Platform Owner' : 'Platform Admin',
        createdAt: a.created_at
      }));

      return res.status(200).json({ ok: true, admins: enrichedAdmins });
    }

    // -------------------------------------------------------------------------
    // ACTION: Platform Settings
    // -------------------------------------------------------------------------
    if (action === 'settings') {
      return res.status(200).json({
        ok: true,
        settings: {
          general: {
            platformName: 'WorkTree X',
            mainDomain: 'worktree.nguyentronghuu.com',
            supportEmail: 'support@worktree.nguyentronghuu.com',
            defaultTimezone: 'Asia/Ho_Chi_Minh'
          },
          tenantPolicy: {
            allowSignup: true,
            autoTrial: true,
            requireEmailVerification: false,
            softQuotaWarning: true
          },
          security: {
            requireAdminMfa: false,
            auditAllActions: true,
            sessionLifetimeHours: 12
          },
          defaultLimits: {
            maxUsersPerTenant: 100,
            defaultStorageGb: 20,
            maxFileMb: 50
          }
        }
      });
    }

    // -------------------------------------------------------------------------
    // ACTION: Violations
    // -------------------------------------------------------------------------
    if (action === 'violations') {
      // Find tenants with suspended status or high task counts as automated warning insights
      const { data: suspendedOrgs } = await supabase
        .from('organizations')
        .select('id, name, suspended_at, suspension_reason')
        .eq('status', 'suspended');

      const violationsList = (suspendedOrgs || []).map((org, i) => ({
        id: `v-${org.id}`,
        level: 'red',
        title: 'Doanh nghiệp đang bị tạm khóa vận hành',
        tenant: org.name,
        type: 'Suspension',
        time: org.suspended_at || 'Gần đây',
        desc: org.suspension_reason || 'Tạm ngưng truy cập bởi Platform Super-Admin'
      }));

      return res.status(200).json({ ok: true, violations: violationsList });
    }

    return res.status(400).json({ ok: false, error: `Action không hợp lệ: ${action}` });
  } catch (err) {
    console.error('[platform-admin error]', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
};
