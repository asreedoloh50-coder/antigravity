/**
 * Admin Module - Admin functionality
 */
const Admin = {
    // Dashboard
    async renderDashboard() {
        const app = document.getElementById('app');
        app.innerHTML = UI.pageWrapper(`
            <div class="page-enter">
                ${UI.header('แดชบอร์ดผู้ดูแลระบบ')}
                
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    ${UI.statsCard('ผู้ใช้ทั้งหมด', '0', 'users', 'bg-blue-100 text-blue-600', 'users-count')}
                    ${UI.statsCard('ครู', '0', 'teacher', 'bg-green-100 text-green-600', 'teachers-count')}
                    ${UI.statsCard('นักเรียน', '0', 'student', 'bg-yellow-100 text-yellow-600', 'students-count')}
                    ${UI.statsCard('ผู้ปกครอง', '0', 'parent', 'bg-purple-100 text-purple-600', 'parents-count')}
                </div>

                <div class="grid md:grid-cols-2 gap-6">
                    <div class="card p-6">
                        <h3 class="text-lg font-semibold mb-4">การดำเนินการด่วน</h3>
                        <div class="grid grid-cols-2 gap-3">
                            <a href="/admin/users" data-link class="btn btn-secondary">จัดการผู้ใช้</a>
                            <a href="/admin/logs" data-link class="btn btn-secondary">ดู Logs</a>
                            <button onclick="Admin.backupData()" class="btn btn-secondary">สำรองข้อมูล</button>
                            <button onclick="Admin.showRestoreModal()" class="btn btn-secondary">กู้คืนข้อมูล</button>
                            <button onclick="window.open(API.BASE_URL + '?action=testPopulate', '_blank')" class="btn btn-primary col-span-2 mt-2">🚀 เริ่มต้น/รีเซ็ต ข้อมูลใน Sheet</button>
                        </div>
                    </div>
                    
                    <div class="card p-6">
                        <h3 class="text-lg font-semibold mb-4">ข้อมูลระบบ</h3>
                        <div class="space-y-3">
                            <div class="flex justify-between">
                                <span class="text-gray-600">โหมด:</span>
                                <span class="font-medium">${Store.getMode() === 'demo' ? 'ทดลอง' : 'API จริง'}</span>
                            </div>
                            <div class="flex justify-between">
                                <span class="text-gray-600">เวอร์ชัน:</span>
                                <span class="font-medium">1.0.0</span>
                            </div>
                            <div class="flex justify-between">
                                <span class="text-gray-600">ปีการศึกษา:</span>
                                <span class="font-medium" id="academic-year">-</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="card p-6 mt-6">
                    <h3 class="text-lg font-semibold mb-4">กิจกรรมล่าสุด</h3>
                    <div id="recent-logs" class="space-y-2">${UI.skeleton(5)}</div>
                </div>
            </div>
        `);

        this.loadDashboardData();
    },

    async loadDashboardData() {
        // Fetch stats from backend (optimized)
        const statsRes = await API.request('adminGetDashboardStats', {});

        if (statsRes.success && statsRes.data) {
            const { stats, recentLogs } = statsRes.data;

            // Update Counts
            document.getElementById('users-count').textContent = stats.totalUsers || 0;
            document.getElementById('teachers-count').textContent = stats.teachers || 0;
            document.getElementById('students-count').textContent = stats.students || 0;
            document.getElementById('parents-count').textContent = stats.parents || 0;

            // Updated Logs
            const logsContainer = document.getElementById('recent-logs');
            if (!recentLogs || recentLogs.length === 0) {
                logsContainer.innerHTML = UI.emptyState('ยังไม่มีบันทึก', '');
            } else {
                logsContainer.innerHTML = recentLogs.map(log => `
                    <div class="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                        <div>
                            <p class="font-medium">${Utils.escapeHtml(log.action)}</p>
                            <p class="text-sm text-gray-500">${log.targetType}: ${log.targetId}</p>
                        </div>
                        <span class="text-sm text-gray-400">${Utils.formatRelativeTime(log.timestamp || log.createdAt)}</span>
                    </div>
                `).join('');
            }
        }

        // Academic year from config
        const data = Store.getDemoData();
        document.getElementById('academic-year').textContent = data.config?.academicYear || '-';
    },

    // Users management
    async renderUsers() {
        const app = document.getElementById('app');
        app.innerHTML = UI.pageWrapper(`
            <div class="page-enter">
                ${UI.header('จัดการผู้ใช้', `<button onclick="Admin.showCreateUserModal()" class="btn btn-primary btn-sm">+ เพิ่มผู้ใช้</button>`)}
                
                <div class="flex flex-wrap gap-4 mb-4">
                    <div class="flex-1 min-w-[200px]">
                        ${UI.searchBox('search-users', 'ค้นหาผู้ใช้...')}
                    </div>
                    <select id="role-filter" class="input-field w-auto">
                        <option value="">ทุกบทบาท</option>
                        <option value="teacher">ครู</option>
                        <option value="student">นักเรียน</option>
                        <option value="parent">ผู้ปกครอง</option>
                        <option value="admin">ผู้ดูแลระบบ</option>
                    </select>
                </div>

                <div class="card overflow-hidden">
                    <div class="table-responsive">
                        <table class="data-table" id="users-table">
                            <thead>
                                <tr>
                                    <th>ชื่อ</th>
                                    <th>อีเมล</th>
                                    <th>บทบาท</th>
                                    <th>สถานะ</th>
                                    <th>สร้างเมื่อ</th>
                                    <th>การดำเนินการ</th>
                                </tr>
                            </thead>
                            <tbody id="users-tbody">
                                <tr><td colspan="6">${UI.skeleton(1)}</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
                <div id="users-pagination" class="mt-4"></div>
            </div>
        `);

        this.loadUsers();

        document.getElementById('search-users').oninput = Utils.debounce((e) => {
            this.loadUsers(1, e.target.value);
        }, 300);

        document.getElementById('role-filter').onchange = (e) => {
            this.loadUsers(1, document.getElementById('search-users').value, e.target.value);
        };
    },

    async loadUsers(page = 1, query = '', roleFilter = '') {
        const res = await API.request('listUsers', { page, pageSize: 20, query, roleFilter });
        const tbody = document.getElementById('users-tbody');

        if (!res.success || !res.data?.data?.length) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-gray-500">ไม่พบผู้ใช้</td></tr>`;
            return;
        }

        tbody.innerHTML = res.data.data.map(user => `
            <tr>
                <td>
                    <div class="flex items-center space-x-2">
                        <div class="avatar avatar-sm">${Utils.getInitials(user.name)}</div>
                        <span>${Utils.escapeHtml(user.name)}</span>
                    </div>
                </td>
                <td>${Utils.escapeHtml(user.email)}</td>
                <td><span class="badge badge-submitted">${Utils.getRoleLabel(user.role)}</span></td>
                <td>
                    <span class="badge ${user.isActive ? 'badge-graded' : 'badge-not-submitted'}">
                        ${user.isActive ? 'ใช้งาน' : 'ระงับ'}
                    </span>
                </td>
                <td>${Utils.formatDate(user.createdAt)}</td>
                <td>
                    <div class="flex space-x-1">
                        <button onclick="Admin.editUser('${user.id}')" class="btn btn-sm btn-ghost">แก้ไข</button>
                        <button onclick="Admin.toggleUserStatus('${user.id}', ${!user.isActive})" class="btn btn-sm btn-ghost ${user.isActive ? 'text-red-600' : 'text-green-600'}">
                            ${user.isActive ? 'ระงับ' : 'เปิดใช้'}
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');

        document.getElementById('users-pagination').innerHTML = UI.pagination(res.data, (p) => {
            this.loadUsers(p, query, roleFilter);
        });
    },

    showCreateUserModal() {
        UI.showModal('เพิ่มผู้ใช้ใหม่', `
            <form id="create-user-form" class="space-y-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">บทบาท</label>
                    <select name="role" class="input-field" required>
                        <option value="teacher">ครู</option>
                        <option value="student">นักเรียน</option>
                        <option value="parent">ผู้ปกครอง</option>
                        <option value="admin">ผู้ดูแลระบบ</option>
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">ชื่อ-นามสกุล</label>
                    <input type="text" name="name" class="input-field" required>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">อีเมล</label>
                    <input type="email" name="email" class="input-field" required>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">รหัสผ่าน</label>
                    <input type="password" name="password" class="input-field" required>
                </div>
                <button type="submit" class="btn btn-primary w-full">สร้างผู้ใช้</button>
            </form>
        `);

        document.getElementById('create-user-form').onsubmit = async (e) => {
            e.preventDefault();
            const fd = new FormData(e.target);
            const res = await API.request('register', {
                role: fd.get('role'),
                name: fd.get('name'),
                email: fd.get('email'),
                password: fd.get('password')
            });

            if (res.success) {
                UI.hideModal();
                UI.showToast('สร้างผู้ใช้สำเร็จ', 'success');
                this.loadUsers();
            } else {
                UI.showToast(res.error, 'error');
            }
        };
    },

    async editUser(userId) {
        const usersRes = await API.request('listUsers', { pageSize: 1000 });
        const user = usersRes.data?.data?.find(u => u.id === userId);

        if (!user) {
            UI.showToast('ไม่พบผู้ใช้', 'error');
            return;
        }

        UI.showModal('แก้ไขผู้ใช้', `
            <form id="edit-user-form" class="space-y-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">ชื่อ</label>
                    <input type="text" name="name" class="input-field" value="${Utils.escapeHtml(user.name)}" required>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">บทบาท</label>
                    <select name="role" class="input-field">
                        <option value="teacher" ${user.role === 'teacher' ? 'selected' : ''}>ครู</option>
                        <option value="student" ${user.role === 'student' ? 'selected' : ''}>นักเรียน</option>
                        <option value="parent" ${user.role === 'parent' ? 'selected' : ''}>ผู้ปกครอง</option>
                        <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>ผู้ดูแลระบบ</option>
                    </select>
                </div>
                <button type="submit" class="btn btn-primary w-full">บันทึก</button>
            </form>
        `);

        document.getElementById('edit-user-form').onsubmit = async (e) => {
            e.preventDefault();
            const fd = new FormData(e.target);
            const res = await API.request('updateUser', {
                userId,
                name: fd.get('name'),
                role: fd.get('role')
            });

            if (res.success) {
                UI.hideModal();
                UI.showToast('บันทึกสำเร็จ', 'success');
                this.loadUsers();
            } else {
                UI.showToast(res.error, 'error');
            }
        };
    },

    async toggleUserStatus(userId, isActive) {
        const action = isActive ? 'เปิดใช้งาน' : 'ระงับ';
        if (!confirm(`ต้องการ${action}ผู้ใช้นี้หรือไม่?`)) return;

        const res = await API.request('updateUser', { userId, isActive });
        if (res.success) {
            UI.showToast(`${action}ผู้ใช้สำเร็จ`, 'success');
            this.loadUsers();
        } else {
            UI.showToast(res.error, 'error');
        }
    },

    // Audit logs
    async renderLogs() {
        const app = document.getElementById('app');
        app.innerHTML = UI.pageWrapper(`
            <div class="page-enter">
                ${UI.header('บันทึกระบบ')}
                
                <div class="mb-4">
                    ${UI.searchBox('search-logs', 'ค้นหา...')}
                </div>

                <div class="card overflow-hidden">
                    <div class="table-responsive">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>เวลา</th>
                                    <th>ผู้กระทำ</th>
                                    <th>การดำเนินการ</th>
                                    <th>ประเภท</th>
                                    <th>ID เป้าหมาย</th>
                                </tr>
                            </thead>
                            <tbody id="logs-tbody">
                                <tr><td colspan="5">${UI.skeleton(1)}</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
                <div id="logs-pagination" class="mt-4"></div>
            </div>
        `);

        this.loadLogs();
    },

    async loadLogs(page = 1) {
        const res = await API.request('getAuditLogs', { page, pageSize: 50 });
        const tbody = document.getElementById('logs-tbody');

        if (!res.success || !res.data?.data?.length) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center py-8 text-gray-500">ไม่มีบันทึก</td></tr>`;
            return;
        }

        tbody.innerHTML = res.data.data.map(log => `
            <tr>
                <td>${Utils.formatDateTime(log.timestamp || log.createdAt)}</td>
                <td>${Utils.escapeHtml(log.actorUserId || log.userId)}</td>
                <td><span class="badge badge-submitted">${Utils.escapeHtml(log.action)}</span></td>
                <td>${Utils.escapeHtml(log.targetType)}</td>
                <td class="font-mono text-sm">${Utils.escapeHtml(log.targetId)}</td>
            </tr>
        `).join('');

        document.getElementById('logs-pagination').innerHTML = UI.pagination(res.data, this.loadLogs.bind(this));
    },

    // Backup & Restore
    async backupData() {
        const res = await API.request('backupData');
        if (res.success) {
            const filename = `homework_backup_${new Date().toISOString().slice(0, 10)}.json`;
            Utils.downloadJSON(res.data, filename);
            UI.showToast('สำรองข้อมูลสำเร็จ', 'success');
        } else {
            UI.showToast(res.error, 'error');
        }
    },

    showRestoreModal() {
        UI.showModal('กู้คืนข้อมูล', `
            <div class="space-y-4">
                <div class="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                    <p class="text-yellow-700 font-medium">⚠️ คำเตือน</p>
                    <p class="text-sm text-yellow-600">การกู้คืนจะแทนที่ข้อมูลทั้งหมดในระบบ</p>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">เลือกไฟล์สำรอง</label>
                    <input type="file" id="restore-file" accept=".json" class="input-field">
                </div>
                <button onclick="Admin.restoreData()" class="btn btn-danger w-full">กู้คืนข้อมูล</button>
            </div>
        `);
    },

    async restoreData() {
        const fileInput = document.getElementById('restore-file');
        const file = fileInput.files[0];

        if (!file) {
            UI.showToast('กรุณาเลือกไฟล์', 'warning');
            return;
        }

        try {
            const text = await file.text();
            const data = JSON.parse(text);

            const res = await API.request('restoreData', { data });
            if (res.success) {
                UI.hideModal();
                UI.showToast('กู้คืนข้อมูลสำเร็จ', 'success');
                location.reload();
            } else {
                UI.showToast(res.error, 'error');
            }
        } catch (e) {
            UI.showToast('ไฟล์ไม่ถูกต้อง', 'error');
        }
    },

    // Settings
    renderSettings() {
        const app = document.getElementById('app');
        const user = Auth.getCurrentUser();
        const data = Store.getDemoData();

        app.innerHTML = UI.pageWrapper(`
            <div class="page-enter">
                ${UI.header('ตั้งค่าระบบ')}
                
                <div class="card p-6 mb-4">
                    <h3 class="font-semibold mb-4">ข้อมูลบัญชี</h3>
                    <div class="flex items-center space-x-4">
                        <div class="avatar avatar-lg">${Utils.getInitials(user?.name)}</div>
                        <div>
                            <p class="font-semibold text-lg">${Utils.escapeHtml(user?.name || '')}</p>
                            <p class="text-gray-500">${Utils.escapeHtml(user?.email || '')}</p>
                            <p class="text-sm text-red-600 mt-1">ผู้ดูแลระบบ</p>
                        </div>
                    </div>
                </div>

                <div class="card p-6 mb-4">
                    <h3 class="font-semibold mb-4">ตั้งค่าระบบ</h3>
                    <form id="system-settings-form" class="space-y-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">ชื่อโรงเรียน</label>
                            <input type="text" name="schoolName" class="input-field" value="${Utils.escapeHtml(data.config?.schoolName || '')}">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">ปีการศึกษา</label>
                            <input type="text" name="academicYear" class="input-field" value="${Utils.escapeHtml(data.config?.academicYear || '')}">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">ภาคเรียน</label>
                            <select name="currentTerm" class="input-field">
                                <option value="1" ${data.config?.currentTerm === '1' ? 'selected' : ''}>1</option>
                                <option value="2" ${data.config?.currentTerm === '2' ? 'selected' : ''}>2</option>
                            </select>
                        </div>
                        <button type="submit" class="btn btn-primary w-full">บันทึก</button>
                    </form>
                </div>

                <div class="card p-6 mb-4">
                    <h3 class="font-semibold mb-4">โหมดระบบ</h3>
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="font-medium">โหมดปัจจุบัน: ${Store.getMode() === 'demo' ? 'ทดลอง' : 'API จริง'}</p>
                            <p class="text-sm text-gray-500">โหมดทดลองใช้ localStorage</p>
                        </div>
                        <button onclick="Admin.toggleMode()" class="btn btn-secondary btn-sm">สลับโหมด</button>
                    </div>
                </div>

                <div class="card p-6 mb-4 border-red-200">
                    <h3 class="font-semibold mb-4 text-red-600">ล้างข้อมูล (Demo)</h3>
                    <p class="text-sm text-gray-600 mb-4">รีเซ็ตข้อมูลทั้งหมดกลับเป็นค่าเริ่มต้น</p>
                    <button onclick="Admin.resetData()" class="btn btn-danger">รีเซ็ตข้อมูล</button>
                </div>

                <button onclick="Auth.logout()" class="btn btn-danger w-full">ออกจากระบบ</button>
            </div>
        `);

        document.getElementById('system-settings-form').onsubmit = async (e) => {
            e.preventDefault();
            const fd = new FormData(e.target);
            const data = Store.getDemoData();
            data.config = {
                schoolName: fd.get('schoolName'),
                academicYear: fd.get('academicYear'),
                currentTerm: fd.get('currentTerm')
            };
            Store.saveDemoData(data);
            UI.showToast('บันทึกการตั้งค่าสำเร็จ', 'success');
        };
    },

    toggleMode() {
        const current = Store.getMode();
        Store.setMode(current === 'demo' ? 'api' : 'demo');
        UI.showToast(`เปลี่ยนเป็นโหมด ${Store.getMode() === 'demo' ? 'ทดลอง' : 'API'}`, 'success');
        this.renderSettings();
    },

    resetData() {
        if (!confirm('ต้องการรีเซ็ตข้อมูลทั้งหมดหรือไม่? การดำเนินการนี้ไม่สามารถยกเลิกได้')) return;
        Store.resetDemoData();
        UI.showToast('รีเซ็ตข้อมูลสำเร็จ', 'success');
        location.reload();
    },

    // ===== Class Management (จัดการห้องเรียน) =====
    async renderClassManagement() {
        const app = document.getElementById('app');
        app.innerHTML = UI.pageWrapper(`
            <div class="page-enter">
                ${UI.header('จัดการห้องเรียน', `<button onclick="Admin.showCreateClassModal()" class="btn btn-primary btn-sm">+ เพิ่มห้องเรียน</button>`)}
                
                <div class="mb-4">
                    ${UI.searchBox('search-classes', 'ค้นหาห้องเรียน...')}
                </div>

                <div class="card overflow-hidden">
                    <div class="table-responsive">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>ห้องเรียน</th>
                                    <th>รหัสเข้าห้อง (สำหรับนักเรียน)</th>
                                    <th>เทอม/ปีการศึกษา</th>
                                    <th>ครูประจำชั้น</th>
                                    <th>การดำเนินการ</th>
                                </tr>
                            </thead>
                            <tbody id="classes-tbody">
                                <tr><td colspan="5">${UI.skeleton(1)}</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `);

        this.loadClasses();
    },

    async loadClasses() {
        // ใช้ adminListClasses (ที่อัปเดตใหม่)
        const res = await API.request('adminListClasses');
        const tbody = document.getElementById('classes-tbody');

        if (!res.success || !res.data?.length) {
            tbody.innerHTML = UI.emptyState('ยังไม่มีห้องเรียน', 'เพิ่มห้องเรียนเพื่อเริ่มใช้งาน', 5);
            return;
        }

        tbody.innerHTML = res.data.map(c => `
            <tr>
                <td>
                    <div class="font-medium">${Utils.escapeHtml(c.name)}</div>
                    <div class="text-xs text-gray-500">ระดับ: ${Utils.escapeHtml(c.level || '-')} ห้อง: ${Utils.escapeHtml(c.room || '-')}</div>
                </td>
                <td>
                    <div class="flex items-center space-x-2">
                        <span class="font-mono text-lg font-bold text-blue-600 bg-blue-50 px-2 rounded">${Utils.escapeHtml(c.roomJoinCode || 'N/A')}</span>
                        <button onclick="Utils.copyToClipboard('${c.roomJoinCode}')" class="text-gray-400 hover:text-gray-600" title="คัดลอก">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
                        </button>
                    </div>
                </td>
                <td>${Utils.escapeHtml(c.termName || '-')}</td>
                <td>${Utils.escapeHtml(c.teacherName || '-')}</td>
                <td>
                    <div class="flex space-x-1">
                        <button onclick="Admin.showEditClassModal('${c.id}')" class="btn btn-sm btn-secondary">แก้ไข</button>
                        <button onclick="Admin.deleteClass('${c.id}')" class="btn btn-sm btn-ghost text-red-600">ลบ</button>
                    </div>
                </td>
            </tr>
        `).join('');
    },

    async showCreateClassModal() {
        const termsRes = await API.request('listTerms');
        const teachersRes = await API.request('listTeachers');
        const terms = termsRes.data || [];
        const teachers = teachersRes.data || [];

        const levels = [
            'ป.1', 'ป.2', 'ป.3', 'ป.4', 'ป.5', 'ป.6',
            'ม.1', 'ม.2', 'ม.3', 'ม.4', 'ม.5', 'ม.6'
        ];
        // ห้องทับ 1-4
        const rooms = ['1', '2', '3', '4'];

        UI.showModal('เพิ่มห้องเรียนใหม่', `
            <form id="create-class-form" class="space-y-4">
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">ระดับชั้น</label>
                        <select name="level" class="input-field" required>
                            <option value="">เลือก</option>
                            ${levels.map(l => `<option value="${l}">${l}</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">ห้องทับ (/)</label>
                        <select name="room" class="input-field" required>
                            <option value="">เลือก</option>
                            ${rooms.map(r => `<option value="${r}">${r}</option>`).join('')}
                        </select>
                    </div>
                </div>

                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">ปีการศึกษา / เทอม</label>
                    <select name="termId" class="input-field" required>
                        <option value="">เลือกเทอม</option>
                        ${terms.map(t => {
            const isCurrentYear = String(t.academicYear) === String(new Date().getFullYear() + 543);
            return `<option value="${t.id}" ${isCurrentYear ? 'selected' : ''}>เทอม ${t.term}/${t.academicYear}</option>`;
        }).join('')}
                    </select>
                </div>

                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">ครูประจำชั้น (Optional)</label>
                    <select name="homeroomTeacherId" class="input-field">
                        <option value="">- ไม่ระบุ -</option>
                        ${teachers.map(t => `<option value="${t.id}">${t.name}</option>`).join('')}
                    </select>
                </div>

                <div class="text-sm text-gray-500 bg-gray-50 p-3 rounded">
                    * รหัสเข้าห้องสำหรับนักเรียน (Room Code) จะถูกสร้างให้อัตโนมัติและไม่ซ้ำกัน
                </div>

                <button type="submit" class="btn btn-primary w-full">สร้างห้องเรียน</button>
            </form>
        `);

        document.getElementById('create-class-form').onsubmit = async (e) => {
            e.preventDefault();
            const fd = new FormData(e.target);
            const res = await API.request('adminCreateClass', {
                level: fd.get('level'),
                room: fd.get('room'),
                termId: fd.get('termId'),
                homeroomTeacherId: fd.get('homeroomTeacherId')
            });

            if (res.success) {
                UI.hideModal();
                UI.showToast('สร้างห้องเรียนสำเร็จ', 'success');
                this.loadClasses();
            } else {
                UI.showToast(res.error, 'error');
            }
        };
    },

    async deleteClass(classId) {
        if (!confirm('ยืนยันการลบห้องเรียนนี้? ข้อมูลนักเรียนและการเรียนการสอนในห้องนี้อาจได้รับผลกระทบ')) return;

        const res = await API.request('adminDeleteClass', { classId });
        if (res.success) {
            UI.showToast('ลบห้องเรียนสำเร็จ', 'success');
            this.loadClasses();
        } else {
            UI.showToast(res.error, 'error');
        }
    },

    async showEditClassModal(classId) {
        // Fetch data
        const [classesRes, termsRes, teachersRes] = await Promise.all([
            API.request('adminListClasses'),
            API.request('listTerms'),
            API.request('listTeachers')
        ]);

        const classData = classesRes.data?.find(c => c.id === classId);
        if (!classData) {
            UI.showToast('ไม่พบข้อมูลห้องเรียน', 'error');
            return;
        }

        const terms = termsRes.data || [];
        const teachers = teachersRes.data || [];

        const levels = [
            'ป.1', 'ป.2', 'ป.3', 'ป.4', 'ป.5', 'ป.6',
            'ม.1', 'ม.2', 'ม.3', 'ม.4', 'ม.5', 'ม.6'
        ];
        const rooms = [
            '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'
        ]; // Expanded to match student options just in case

        UI.showModal('แก้ไขห้องเรียน', `
            <form id="edit-class-form" class="space-y-4">
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">ระดับชั้น</label>
                        <select name="level" class="input-field" required>
                            <option value="">เลือก</option>
                            ${levels.map(l => `<option value="${l}" ${l === classData.level ? 'selected' : ''}>${l}</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">ห้องทับ (/)</label>
                        <select name="room" class="input-field" required>
                            <option value="">เลือก</option>
                            ${rooms.map(r => `<option value="${r}" ${String(r) === String(classData.room) ? 'selected' : ''}>${r}</option>`).join('')}
                        </select>
                    </div>
                </div>

                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">ปีการศึกษา / เทอม</label>
                    <select name="termId" class="input-field" required>
                        <option value="">เลือกเทอม</option>
                        ${terms.map(t => `<option value="${t.id}" ${t.id === classData.termId ? 'selected' : ''}>เทอม ${t.term}/${t.academicYear}</option>`).join('')}
                    </select>
                </div>

                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">ครูประจำชั้น</label>
                    <select name="homeroomTeacherId" class="input-field">
                        <option value="">- ไม่ระบุ -</option>
                        ${teachers.map(t => `<option value="${t.id}" ${t.id === classData.homeroomTeacherId ? 'selected' : ''}>${t.name}</option>`).join('')}
                    </select>
                </div>

                <div class="text-sm text-gray-500 bg-gray-50 p-3 rounded">
                    รหัสเข้าห้อง: <span class="font-mono font-bold">${classData.roomJoinCode || '-'}</span> (ไม่สามารถแก้ไขได้)
                </div>

                <button type="submit" class="btn btn-primary w-full">บันทึกการแก้ไข</button>
            </form>
        `);

        document.getElementById('edit-class-form').onsubmit = async (e) => {
            e.preventDefault();
            const fd = new FormData(e.target);
            const res = await API.request('adminUpdateClass', {
                classId,
                level: fd.get('level'),
                room: fd.get('room'),
                termId: fd.get('termId'),
                homeroomTeacherId: fd.get('homeroomTeacherId')
            });

            if (res.success) {
                UI.hideModal();
                UI.showToast('แก้ไขห้องเรียนสำเร็จ', 'success');
                this.loadClasses();
            } else {
                UI.showToast(res.error, 'error');
            }
        };
    },
    async renderSubjectCatalog() {
        const app = document.getElementById('app');
        app.innerHTML = UI.pageWrapper(`
            <div class="page-enter">
                ${UI.header('จัดการรายวิชา', `<button onclick="Admin.showCreateCatalogModal()" class="btn btn-primary btn-sm">+ เพิ่มรายวิชา</button>`)}
                
                <div class="flex flex-wrap gap-4 mb-4">
                    <div class="flex-1 min-w-[200px]">
                        ${UI.searchBox('search-catalog', 'ค้นหารหัสวิชา หรือชื่อวิชา...')}
                    </div>
                    <select id="level-filter" class="input-field w-auto">
                        <option value="">ทุกระดับชั้น</option>
                        <option value="ป.1">ป.1</option><option value="ป.2">ป.2</option><option value="ป.3">ป.3</option>
                        <option value="ป.4">ป.4</option><option value="ป.5">ป.5</option><option value="ป.6">ป.6</option>
                        <option value="ม.1">ม.1</option><option value="ม.2">ม.2</option><option value="ม.3">ม.3</option>
                        <option value="ม.4">ม.4</option><option value="ม.5">ม.5</option><option value="ม.6">ม.6</option>
                    </select>
                    <select id="category-filter" class="input-field w-auto">
                        <option value="">ทุกกลุ่มสาระ</option>
                        <option value="วิทย์-คณิต">วิทย์-คณิต</option>
                        <option value="ภาษา">ภาษา</option>
                        <option value="สังคม">สังคม</option>
                        <option value="สุขศึกษา-พละ">สุขศึกษา-พละ</option>
                        <option value="ศิลปะ">ศิลปะ</option>
                        <option value="การงาน">การงาน</option>
                    </select>
                </div>

                <div class="card overflow-hidden">
                    <div class="table-responsive">
                        <table class="data-table" id="catalog-table">
                            <thead>
                                <tr>
                                    <th>รหัสวิชา</th>
                                    <th>ชื่อวิชา</th>
                                    <th>ระดับชั้น</th>
                                    <th>กลุ่มสาระ</th>
                                    <th>การดำเนินการ</th>
                                </tr>
                            </thead>
                            <tbody id="catalog-tbody">
                                <tr><td colspan="5">${UI.skeleton(1)}</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
                <div id="catalog-pagination" class="mt-4"></div>
            </div>
        `);

        this.loadSubjectCatalog();

        document.getElementById('search-catalog').oninput = Utils.debounce((e) => {
            this.loadSubjectCatalog(1, e.target.value);
        }, 300);

        document.getElementById('level-filter').onchange = () => this.applyFilters();
        document.getElementById('category-filter').onchange = () => this.applyFilters();
    },

    applyFilters() {
        const query = document.getElementById('search-catalog').value;
        const level = document.getElementById('level-filter').value;
        const category = document.getElementById('category-filter').value;
        this.loadSubjectCatalog(1, query, level, category);
    },

    async loadSubjectCatalog(page = 1, query = '', levelGroup = '', category = '') {
        const res = await API.request('listSubjectCatalog', { page, pageSize: 20, query, levelGroup, category });
        const tbody = document.getElementById('catalog-tbody');

        if (!res.success || !res.data?.data?.length) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center py-8 text-gray-500">ไม่พบรายวิชา</td></tr>`;
            return;
        }

        tbody.innerHTML = res.data.data.map(item => `
            <tr>
                <td><span class="font-mono text-sm bg-gray-100 px-2 py-1 rounded">${Utils.escapeHtml(item.subjectCode)}</span></td>
                <td>${Utils.escapeHtml(item.subjectName)}</td>
                <td>${Utils.escapeHtml(item.levelGroup || '-')}</td>
                <td><span class="badge badge-submitted">${Utils.escapeHtml(item.category || '-')}</span></td>
                <td>
                    <div class="flex space-x-1">
                        <button onclick="Admin.editCatalog('${item.id}')" class="btn btn-sm btn-ghost">แก้ไข</button>
                        <button onclick="Admin.deleteCatalog('${item.id}')" class="btn btn-sm btn-ghost text-red-600">ลบ</button>
                    </div>
                </td>
            </tr>
        `).join('');

        document.getElementById('catalog-pagination').innerHTML = UI.pagination(res.data, (p) => {
            this.loadSubjectCatalog(p, query, levelGroup, category);
        });
    },

    showCreateCatalogModal() {
        UI.showModal('เพิ่มรายวิชาใหม่', `
            <form id="create-catalog-form" class="space-y-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">รหัสวิชา <span class="text-red-500">*</span></label>
                    <input type="text" name="subjectCode" class="input-field" placeholder="เช่น ค21101" required>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">ชื่อวิชา <span class="text-red-500">*</span></label>
                    <input type="text" name="subjectName" class="input-field" placeholder="เช่น คณิตศาสตร์พื้นฐาน" required>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">ระดับชั้น</label>
                    <select name="levelGroup" class="input-field">
                        <option value="">เลือกระดับชั้น</option>
                        <option value="ป.1">ป.1</option><option value="ป.2">ป.2</option><option value="ป.3">ป.3</option>
                        <option value="ป.4">ป.4</option><option value="ป.5">ป.5</option><option value="ป.6">ป.6</option>
                        <option value="ม.1">ม.1</option><option value="ม.2">ม.2</option><option value="ม.3">ม.3</option>
                        <option value="ม.4">ม.4</option><option value="ม.5">ม.5</option><option value="ม.6">ม.6</option>
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">กลุ่มสาระ</label>
                    <select name="category" class="input-field">
                        <option value="อื่นๆ">เลือกกลุ่มสาระ</option>
                        <option value="วิทย์-คณิต">วิทย์-คณิต</option>
                        <option value="ภาษา">ภาษา</option>
                        <option value="สังคม">สังคม</option>
                        <option value="สุขศึกษา-พละ">สุขศึกษา-พละ</option>
                        <option value="ศิลปะ">ศิลปะ</option>
                        <option value="การงาน">การงาน</option>
                    </select>
                </div>
                <button type="submit" class="btn btn-primary w-full">เพิ่มรายวิชา</button>
            </form>
        `);

        document.getElementById('create-catalog-form').onsubmit = async (e) => {
            e.preventDefault();
            const fd = new FormData(e.target);
            const res = await API.request('createSubjectCatalog', {
                subjectCode: fd.get('subjectCode'),
                subjectName: fd.get('subjectName'),
                levelGroup: fd.get('levelGroup'),
                category: fd.get('category')
            });

            if (res.success) {
                UI.hideModal();
                UI.showToast('เพิ่มรายวิชาสำเร็จ', 'success');
                this.loadSubjectCatalog();
            } else {
                UI.showToast(res.error, 'error');
            }
        };
    },

    async editCatalog(catalogId) {
        const res = await API.request('listSubjectCatalog', { pageSize: 1000 });
        const catalog = res.data?.data?.find(c => c.id === catalogId);

        if (!catalog) {
            UI.showToast('ไม่พบรายวิชา', 'error');
            return;
        }

        UI.showModal('แก้ไขรายวิชา', `
            <form id="edit-catalog-form" class="space-y-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">รหัสวิชา</label>
                    <input type="text" name="subjectCode" class="input-field" value="${Utils.escapeHtml(catalog.subjectCode)}" required>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">ชื่อวิชา</label>
                    <input type="text" name="subjectName" class="input-field" value="${Utils.escapeHtml(catalog.subjectName)}" required>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">ระดับชั้น</label>
                    <select name="levelGroup" class="input-field">
                        <option value="">เลือกระดับชั้น</option>
                        <option value="ม.ต้น" ${catalog.levelGroup === 'ม.ต้น' ? 'selected' : ''}>ม.ต้น</option>
                        <option value="ม.ปลาย" ${catalog.levelGroup === 'ม.ปลาย' ? 'selected' : ''}>ม.ปลาย</option>
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">กลุ่มสาระ</label>
                    <select name="category" class="input-field">
                        <option value="อื่นๆ">เลือกกลุ่มสาระ</option>
                        <option value="วิทย์-คณิต" ${catalog.category === 'วิทย์-คณิต' ? 'selected' : ''}>วิทย์-คณิต</option>
                        <option value="ภาษา" ${catalog.category === 'ภาษา' ? 'selected' : ''}>ภาษา</option>
                        <option value="สังคม" ${catalog.category === 'สังคม' ? 'selected' : ''}>สังคม</option>
                        <option value="สุขศึกษา-พละ" ${catalog.category === 'สุขศึกษา-พละ' ? 'selected' : ''}>สุขศึกษา-พละ</option>
                        <option value="ศิลปะ" ${catalog.category === 'ศิลปะ' ? 'selected' : ''}>ศิลปะ</option>
                        <option value="การงาน" ${catalog.category === 'การงาน' ? 'selected' : ''}>การงาน</option>
                    </select>
                </div>
                <button type="submit" class="btn btn-primary w-full">บันทึก</button>
            </form>
        `);

        document.getElementById('edit-catalog-form').onsubmit = async (e) => {
            e.preventDefault();
            const fd = new FormData(e.target);
            const res = await API.request('updateSubjectCatalog', {
                catalogId,
                subjectCode: fd.get('subjectCode'),
                subjectName: fd.get('subjectName'),
                levelGroup: fd.get('levelGroup'),
                category: fd.get('category')
            });

            if (res.success) {
                UI.hideModal();
                UI.showToast('บันทึกสำเร็จ', 'success');
                this.loadSubjectCatalog();
            } else {
                UI.showToast(res.error, 'error');
            }
        };
    },

    async deleteCatalog(catalogId) {
        if (!confirm('ต้องการลบรายวิชานี้หรือไม่?')) return;

        const res = await API.request('deleteSubjectCatalog', { catalogId });
        if (res.success) {
            UI.showToast('ลบรายวิชาสำเร็จ', 'success');
            this.loadSubjectCatalog();
        } else {
            UI.showToast(res.error, 'error');
        }
    },

    // ===== Class Subjects Management =====
    async renderClassSubjects() {
        const app = document.getElementById('app');
        app.innerHTML = UI.pageWrapper(`
            <div class="page-enter">
                ${UI.header('มอบหมายวิชา', `<button onclick="Admin.showAssignSubjectModal()" class="btn btn-primary btn-sm">+ มอบหมายวิชาให้ห้อง</button>`)}
                
                <div class="flex flex-wrap gap-4 mb-4">
                    <select id="class-filter" class="input-field w-auto flex-1 min-w-[200px]">
                        <option value="">ทุกห้องเรียน</option>
                    </select>
                </div>

                <div class="card overflow-hidden">
                    <div class="table-responsive">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>ห้องเรียน</th>
                                    <th>รหัสวิชา</th>
                                    <th>ชื่อวิชา</th>
                                    <th>ครูผู้สอน</th>
                                    <th>การดำเนินการ</th>
                                </tr>
                            </thead>
                            <tbody id="class-subjects-tbody">
                                <tr><td colspan="5">${UI.skeleton(1)}</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
                <div id="class-subjects-pagination" class="mt-4"></div>
            </div>
        `);

        // Load classes for filter
        const classesRes = await API.request('adminListClasses', {});
        if (classesRes.success) {
            const select = document.getElementById('class-filter');
            classesRes.data.data.forEach(c => {
                select.innerHTML += `<option value="${c.id}">${Utils.escapeHtml(c.name)}</option>`;
            });
        }

        document.getElementById('class-filter').onchange = () => {
            this.loadClassSubjects(1, document.getElementById('class-filter').value);
        };

        this.loadClassSubjects();
    },

    async loadClassSubjects(page = 1, classId = '') {
        const res = await API.request('listClassSubjects', { page, pageSize: 30, classId });
        const tbody = document.getElementById('class-subjects-tbody');

        if (!res.success || !res.data?.data?.length) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center py-8 text-gray-500">ยังไม่มีการมอบหมายวิชา</td></tr>`;
            return;
        }

        tbody.innerHTML = res.data.data.map(item => `
            <tr>
                <td><span class="font-medium">${Utils.escapeHtml(item.className || '-')}</span></td>
                <td><span class="font-mono text-sm bg-gray-100 px-2 py-1 rounded">${Utils.escapeHtml(item.subjectCode)}</span></td>
                <td>${Utils.escapeHtml(item.subjectName)}</td>
                <td>
                    ${item.teacherName
                ? `<span class="text-green-600">${Utils.escapeHtml(item.teacherName)}</span>`
                : `<span class="text-yellow-600">ยังไม่มอบหมาย</span>`
            }
                </td>
                <td>
                    <div class="flex space-x-1">
                        <button onclick="Admin.showAssignTeacherModal('${item.id}')" class="btn btn-sm btn-ghost">มอบหมายครู</button>
                        <button onclick="Admin.deleteClassSubject('${item.id}')" class="btn btn-sm btn-ghost text-red-600">ลบ</button>
                    </div>
                </td>
            </tr>
        `).join('');

        document.getElementById('class-subjects-pagination').innerHTML = UI.pagination(res.data, (p) => {
            this.loadClassSubjects(p, classId);
        });
    },

    async showAssignSubjectModal() {
        // Load classes and catalog
        const [classesRes, catalogRes, teachersRes] = await Promise.all([
            API.request('adminListClasses', { pageSize: 100, sort: 'name' }), // Sort by name for dropdown
            API.request('listSubjectCatalog', { pageSize: 100, sort: 'code' }), // Sort by code for dropdown
            API.request('listTeachers', {})
        ]);

        const classes = classesRes.data?.data || classesRes.data || []; // Handle both array and paginated
        const catalogs = catalogRes.data?.data || catalogRes.data || [];
        const teachers = teachersRes.data?.data || teachersRes.data || [];

        UI.showModal('มอบหมายวิชาให้ห้องเรียน', `
            <form id="assign-subject-form" class="space-y-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">ห้องเรียน <span class="text-red-500">*</span></label>
                    <select name="classId" class="input-field" required>
                        <option value="">เลือกห้องเรียน</option>
                        ${classes.map(c => `<option value="${c.id}">${Utils.escapeHtml(c.name)}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">วิชา <span class="text-red-500">*</span></label>
                    <select name="catalogId" class="input-field" required>
                        <option value="">เลือกวิชา</option>
                        ${catalogs.map(c => `<option value="${c.id}">[${Utils.escapeHtml(c.subjectCode)}] ${Utils.escapeHtml(c.subjectName)}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">ครูผู้สอน (Optional)</label>
                    <select name="teacherId" class="input-field">
                        <option value="">- เลือกครูผู้สอนภายหลัง -</option>
                        ${teachers.map(t => `<option value="${t.id}">${Utils.escapeHtml(t.name)}</option>`).join('')}
                    </select>
                </div>
                <button type="submit" class="btn btn-primary w-full">มอบหมาย</button>
            </form>
        `);

        document.getElementById('assign-subject-form').onsubmit = async (e) => {
            e.preventDefault();
            const fd = new FormData(e.target);
            const res = await API.request('createClassSubject', {
                classId: fd.get('classId'),
                catalogId: fd.get('catalogId'),
                teacherId: fd.get('teacherId')
            });

            if (res.success) {
                UI.hideModal();
                UI.showToast('มอบหมายวิชาสำเร็จ', 'success');
                this.loadClassSubjects();
            } else {
                UI.showToast(res.error, 'error');
            }
        };
    },

    async showAssignTeacherModal(classSubjectId) {
        const teachersRes = await API.request('listTeachers', {});
        const teachers = teachersRes.data || [];

        UI.showModal('มอบหมายครูผู้สอน', `
            <form id="assign-teacher-form" class="space-y-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">ครูผู้สอน</label>
                    <select name="teacherId" class="input-field" required>
                        <option value="">เลือกครู</option>
                        ${teachers.map(t => `<option value="${t.id}">${Utils.escapeHtml(t.name)} (${Utils.escapeHtml(t.email)})</option>`).join('')}
                    </select>
                </div>
                <button type="submit" class="btn btn-primary w-full">มอบหมาย</button>
            </form>
        `);

        document.getElementById('assign-teacher-form').onsubmit = async (e) => {
            e.preventDefault();
            const fd = new FormData(e.target);
            const res = await API.request('assignTeacherToClassSubject', {
                classSubjectId,
                teacherId: fd.get('teacherId')
            });

            if (res.success) {
                UI.hideModal();
                UI.showToast('มอบหมายครูสำเร็จ', 'success');
                this.loadClassSubjects();
            } else {
                UI.showToast(res.error, 'error');
            }
        };
    },

    async deleteClassSubject(classSubjectId) {
        if (!confirm('ต้องการลบการมอบหมายนี้หรือไม่?')) return;

        const res = await API.request('deleteClassSubject', { classSubjectId });
        if (res.success) {
            UI.showToast('ลบสำเร็จ', 'success');
            this.loadClassSubjects();
        } else {
            UI.showToast(res.error, 'error');
        }
    }
};

window.Admin = Admin;
