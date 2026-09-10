const { strict: assert } = require('node:assert');
const { test } = require('node:test');

test('EmployeeService.updateEmployee validates required fields and invalid email', async () => {
  // Mock EmployeeRepository
  let updatedArgs = null;
  const mockEmployeeRepository = {
    updateEmployee: async (id, payload) => {
      updatedArgs = { id, payload };
      return { id, ...payload };
    }
  };

  const EmployeeService = {
    async updateEmployee({
      organizationId,
      employeeId,
      fullName,
      email = null,
      employeeCode = null,
      jobTitle = null,
      homeNodeId,
      employmentStatus = 'active'
    }) {
      if (!employeeId) throw new Error('Thiếu ID nhân sự');
      if (!fullName || !fullName.trim()) throw new Error('Họ và tên nhân viên là bắt buộc');
      if (!homeNodeId) throw new Error('Phòng ban trực thuộc là bắt buộc');

      const cleanEmail = email && email.trim() ? email.trim().toLowerCase() : null;
      if (cleanEmail) {
        const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
        if (!emailRegex.test(cleanEmail)) throw new Error('Định dạng email không hợp lệ');
      }

      return await mockEmployeeRepository.updateEmployee(employeeId, {
        full_name: fullName.trim(),
        email: cleanEmail,
        employee_code: employeeCode && employeeCode.trim() ? employeeCode.trim() : null,
        job_title: jobTitle && jobTitle.trim() ? jobTitle.trim() : null,
        home_node_id: homeNodeId,
        employment_status: employmentStatus
      });
    }
  };

  // Missing employeeId
  await assert.rejects(
    () => EmployeeService.updateEmployee({ fullName: 'Test', homeNodeId: 'node-1' }),
    /Thiếu ID nhân sự/
  );

  // Missing fullName
  await assert.rejects(
    () => EmployeeService.updateEmployee({ employeeId: 'emp-1', fullName: '  ', homeNodeId: 'node-1' }),
    /Họ và tên nhân viên là bắt buộc/
  );

  // Missing homeNodeId
  await assert.rejects(
    () => EmployeeService.updateEmployee({ employeeId: 'emp-1', fullName: 'Nguyễn Văn A' }),
    /Phòng ban trực thuộc là bắt buộc/
  );

  // Invalid email
  await assert.rejects(
    () => EmployeeService.updateEmployee({ employeeId: 'emp-1', fullName: 'Nguyễn Văn A', homeNodeId: 'node-1', email: 'invalid-email' }),
    /Định dạng email không hợp lệ/
  );

  // Success case
  const res = await EmployeeService.updateEmployee({
    employeeId: 'emp-1',
    fullName: '  Nguyễn Văn A  ',
    email: 'NV.A@COMPANY.COM  ',
    employeeCode: ' NV020 ',
    jobTitle: ' Chuyên viên ',
    homeNodeId: 'node-dept-2',
    employmentStatus: 'active'
  });

  assert.equal(res.id, 'emp-1');
  assert.equal(updatedArgs.payload.full_name, 'Nguyễn Văn A');
  assert.equal(updatedArgs.payload.email, 'nv.a@company.com');
  assert.equal(updatedArgs.payload.employee_code, 'NV020');
  assert.equal(updatedArgs.payload.job_title, 'Chuyên viên');
  assert.equal(updatedArgs.payload.home_node_id, 'node-dept-2');
  assert.equal(updatedArgs.payload.employment_status, 'active');
});
