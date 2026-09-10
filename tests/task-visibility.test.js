const { strict: assert } = require('node:assert');
const { test } = require('node:test');

test('Task visibility and scope evaluation for member role in cloud workspace', () => {
  // Setup node tree:
  // root (company)
  //   -> dept-sales (department)
  //        -> proj-growth (project)
  //             -> team-ads (team)
  //   -> dept-tech (department)

  const nodes = [
    { id: 'node-root', parent: null, name: 'Công ty', type: 'company' },
    { id: 'dept-sales', parent: 'node-root', name: 'Phòng Kinh Doanh', type: 'department' },
    { id: 'proj-growth', parent: 'dept-sales', name: 'Chiến Dịch Tăng Trưởng', type: 'project' },
    { id: 'team-ads', parent: 'proj-growth', name: 'Nhóm Ads', type: 'team' },
    { id: 'dept-tech', parent: 'node-root', name: 'Phòng Kỹ Thuật', type: 'department' }
  ];

  const byNode = new Map(nodes.map(n => [n.id, n]));
  const byParent = new Map();
  const subtreeCache = new Map();
  nodes.forEach(n => {
    if (!byParent.has(n.parent)) byParent.set(n.parent, []);
    byParent.get(n.parent).push(n);
  });

  function childrenOf(id) { return byParent.get(id) || []; }
  function subtree(id) {
    if (subtreeCache.has(id)) return subtreeCache.get(id);
    const ids = new Set([id]), stack = [id];
    while (stack.length) {
      for (const n of childrenOf(stack.pop())) {
        if (!ids.has(n.id)) { ids.add(n.id); stack.push(n.id); }
      }
    }
    subtreeCache.set(id, ids);
    return ids;
  }

  // Cloud workspace environment flag
  const isCloudWorkspace = true;

  function inScope(nodeId, a) {
    if (!a) return false;
    if (a.role === 'admin' || a.role === 'owner') return byNode.has(nodeId);
    if (isCloudWorkspace && (!Array.isArray(a.scopes) || a.scopes.length === 0)) return byNode.has(nodeId);
    return (a.scopes || []).some(root => byNode.has(root) && subtree(root).has(nodeId));
  }

  function canReadTask(t, a) {
    if (!a || !t) return false;
    if (isCloudWorkspace && a.personId && (t.owner === a.personId || String(t.owner) === String(a.personId))) return true;
    return !!(inScope(t.node, a) && (a.role !== 'member' || (a.personId && t.owner === a.personId)));
  }

  // Member account in Sales department
  const memberAccount = {
    id: 'user-unicon',
    role: 'member',
    personId: 'emp-unicon',
    scopes: ['dept-sales']
  };

  const task1 = {
    id: 'task-1',
    node: 'team-ads',
    title: 'Chạy chiến dịch Ads',
    owner: 'emp-unicon'
  };

  const taskOther = {
    id: 'task-2',
    node: 'team-ads',
    title: 'Viết bài',
    owner: 'emp-other'
  };

  const taskTech = {
    id: 'task-3',
    node: 'dept-tech',
    title: 'Bảo trì server',
    owner: 'emp-other'
  };

  // 1. In-scope checks
  assert.equal(inScope('team-ads', memberAccount), true, 'team-ads should be inScope for Sales scope');
  assert.equal(inScope('proj-growth', memberAccount), true, 'proj-growth should be inScope for Sales scope');
  assert.equal(inScope('dept-tech', memberAccount), false, 'dept-tech should NOT be inScope for Sales scope');

  // 2. canReadTask checks
  assert.equal(canReadTask(task1, memberAccount), true, 'Member should see task assigned to them');
  assert.equal(canReadTask(taskOther, memberAccount), false, 'Member should NOT see tasks assigned to other employees');
  assert.equal(canReadTask(taskTech, memberAccount), false, 'Member should NOT see tasks outside scope');

  // 3. Cloud direct assignment fallback check
  const memberWithEmptyScopes = {
    id: 'user-unicon',
    role: 'member',
    personId: 'emp-unicon',
    scopes: []
  };
  assert.equal(canReadTask(task1, memberWithEmptyScopes), true, 'Member should see their assigned task even if scopes array is empty');
  assert.equal(canReadTask(taskOther, memberWithEmptyScopes), false, 'Member should still not see others tasks with empty scopes');
});
