/**
 * Parent Module - Parent functionality
 */
const Parent = {
    // Dashboard
    async renderDashboard() {
        const app = document.getElementById('app');
        app.innerHTML = UI.pageWrapper(`
            <div class="page-enter">
                ${UI.header('แดชบอร์ดผู้ปกครอง')}
                
                <div id="children-overview" class="mb-6">${UI.skeleton(2)}</div>
                
                <div class="grid md:grid-cols-2 gap-6">
                    <div class="card p-6">
                        <h3 class="text-lg font-semibold mb-4">งานค้างส่ง</h3>
                        <div id="pending-work" class="space-y-3">
                            ${UI.skeleton(3)}
                        </div>
                    </div>
                    
                    <div class="card p-6">
                        <h3 class="text-lg font-semibold mb-4">คะแนนล่าสุด</h3>
                        <div id="recent-grades" class="space-y-3">
                            ${UI.skeleton(3)}
                        </div>
                    </div>
                </div>
            </div>
        `);

        this.loadDashboardData();
    },

    async loadDashboardData() {
        const childrenRes = await API.request('getLinkedStudents');
        const children = childrenRes.data || [];

        const overviewContainer = document.getElementById('children-overview');
        if (children.length === 0) {
            overviewContainer.innerHTML = `
                <div class="card p-6 text-center">
                    <p class="text-gray-500 mb-4">ยังไม่ได้เชื่อมต่อกับนักเรียน</p>
                    <button onclick="Parent.showLinkChildModal()" class="btn btn-primary">เชื่อมต่อลูก</button>
                </div>
            `;
            document.getElementById('pending-work').innerHTML = UI.emptyState('ไม่มีข้อมูล', 'เชื่อมต่อกับนักเรียนก่อน');
            document.getElementById('recent-grades').innerHTML = UI.emptyState('ไม่มีข้อมูล', 'เชื่อมต่อกับนักเรียนก่อน');
            return;
        }

        overviewContainer.innerHTML = `
            <div class="grid grid-cols-2 md:grid-cols-${Math.min(children.length, 4)} gap-4">
                ${children.map(child => `
                    <div class="card p-4 text-center relative">
                        <button onclick="Parent.unlinkChild('${child.id}', '${Utils.escapeHtml(child.name)}')" class="absolute top-2 right-2 p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors" title="ยกเลิกการเชื่อมต่อ">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                            </svg>
                        </button>
                        <div class="avatar avatar-lg mx-auto mb-2">${Utils.getInitials(child.name)}</div>
                        <p class="font-semibold">${Utils.escapeHtml(child.name)}</p>
                        <p class="text-sm text-gray-500">${Utils.escapeHtml(child.relation)}</p>
                        <a href="/parent/child/${child.id}" data-link class="btn btn-sm btn-primary mt-2 w-full">ดูรายละเอียด</a>
                    </div>
                `).join('')}
            </div>
        `;

        // Load pending and grades for first child
        const firstChild = children[0];
        await this.loadChildSummary(firstChild.id);
    },

    async loadChildSummary(studentId) {
        const gradesRes = await API.request('parentGetGrades', { studentId });
        const grades = gradesRes.data || [];

        // Pending work
        const pending = grades.filter(g =>
            g.submission?.status === 'NOT_SUBMITTED' ||
            g.submission?.status === 'REVISION_REQUESTED'
        );

        const pendingContainer = document.getElementById('pending-work');
        if (pending.length === 0) {
            pendingContainer.innerHTML = UI.emptyState('ไม่มีงานค้างส่ง', '🎉 เยี่ยม!');
        } else {
            pendingContainer.innerHTML = pending.slice(0, 5).map(g => `
                <div class="flex justify-between items-center p-3 bg-yellow-50 rounded-xl">
                    <div>
                        <p class="font-medium">${Utils.escapeHtml(g.assignment?.title || '')}</p>
                        <p class="text-sm text-gray-500">${Utils.escapeHtml(g.subjectName || '')}</p>
                    </div>
                    <span class="text-sm text-red-600">
                        ${Utils.isPastDue(g.assignment?.dueDate) ? 'เลยกำหนด!' : Utils.formatDate(g.assignment?.dueDate)}
                    </span>
                </div>
            `).join('');
        }

        // Recent grades
        const graded = grades.filter(g => g.grade);
        const recentContainer = document.getElementById('recent-grades');

        if (graded.length === 0) {
            recentContainer.innerHTML = UI.emptyState('ยังไม่มีคะแนน', 'รอครูตรวจงาน');
        } else {
            recentContainer.innerHTML = graded.slice(0, 5).map(g => {
                const pct = Utils.getScorePercentage(g.grade.score, g.assignment?.maxScore);
                return `
                    <div class="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                        <div>
                            <p class="font-medium">${Utils.escapeHtml(g.assignment?.title || '')}</p>
                            <p class="text-sm text-gray-500">${Utils.formatDate(g.grade.gradedAt)}</p>
                        </div>
                        <span class="text-lg font-bold ${Utils.getScoreColorClass(pct)}">
                            ${g.grade.score}/${g.assignment?.maxScore}
                        </span>
                    </div>
                `;
            }).join('');
        }
    },

    // Children list
    async renderChildren() {
        const app = document.getElementById('app');
        app.innerHTML = UI.pageWrapper(`
            <div class="page-enter">
                ${UI.header('ลูกของฉัน', `<button onclick="Parent.showLinkChildModal()" class="btn btn-primary btn-sm">+ เพิ่มลูก</button>`)}
                <div id="children-list" class="grid md:grid-cols-2 lg:grid-cols-3 gap-4">${UI.skeleton(2)}</div>
            </div>
        `);

        const res = await API.request('getLinkedStudents');
        const container = document.getElementById('children-list');

        if (!res.success || !res.data?.length) {
            container.innerHTML = UI.emptyState('ยังไม่มีลูกที่เชื่อมต่อ', 'ใช้รหัสจากนักเรียนเพื่อเชื่อมต่อ');
            return;
        }

        container.innerHTML = res.data.map(child => `
            <div class="card p-5 text-center relative group">
                <button onclick="Parent.unlinkChild('${child.id}', '${Utils.escapeHtml(child.name)}')" class="absolute top-3 right-3 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors" title="ยกเลิกการเชื่อมต่อ">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                    </svg>
                </button>
                <div class="avatar avatar-lg mx-auto mb-3">${Utils.getInitials(child.name)}</div>
                <h3 class="font-semibold text-lg">${Utils.escapeHtml(child.name)}</h3>
                <p class="text-sm text-gray-500 mb-4">${Utils.escapeHtml(child.relation)}</p>
                <a href="/parent/child/${child.id}" data-link class="btn btn-primary w-full">ดูคะแนน</a>
            </div>
        `).join('');
    },

    async unlinkChild(studentId, studentName) {
        if (!confirm(`คุณต้องการยกเลิกการเชื่อมต่อกับ "${studentName}" ใช่หรือไม่? \nข้อมูลคะแนนจะไม่หายไป แต่คุณจะไม่เห็นข้อมูลของนักเรียนคนนี้อีก`)) return;

        UI.showLoading();
        const res = await API.request('parentUnlink', { studentId });
        UI.hideLoading();

        if (res.success) {
            UI.showToast('ยกเลิกการเชื่อมต่อเรียบร้อย', 'success');
            this.renderChildren();
        } else {
            UI.showToast(res.error, 'error');
        }
    },

    showLinkChildModal() {
        UI.showModal('เชื่อมต่อลูก', `
            <form id="link-child-form" class="space-y-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">รหัสเชื่อมต่อ</label>
                    <input type="text" name="linkCode" class="input-field text-center font-mono text-lg tracking-widest" placeholder="รหัสจากนักเรียน" required>
                    <p class="text-xs text-gray-500 mt-1">ขอรหัสจากนักเรียนในหน้าตั้งค่าของนักเรียน</p>
                </div>
                <button type="submit" class="btn btn-primary w-full">เชื่อมต่อ</button>
            </form>
        `);

        document.getElementById('link-child-form').onsubmit = async (e) => {
            e.preventDefault();
            const res = await API.request('parentLink', { linkCode: e.target.linkCode.value });

            if (res.success) {
                UI.hideModal();
                UI.showToast(`เชื่อมต่อกับ ${res.data.studentName} สำเร็จ`, 'success');
                this.renderChildren();
            } else {
                UI.showToast(res.error, 'error');
            }
        };
    },

    // Child detail (grades)
    async renderChildGrades(params) {
        const app = document.getElementById('app');
        app.innerHTML = UI.pageWrapper(`
            <div class="page-enter">
                ${UI.header('คะแนนลูก')}
                
                <div class="mb-4">
                    ${UI.searchBox('search-grades', 'ค้นหางาน...')}
                </div>
                
                <div id="grades-list" class="space-y-4">${UI.skeleton(5)}</div>
            </div>
        `);

        this.loadChildGrades(params.id);

        document.getElementById('search-grades').oninput = Utils.debounce((e) => {
            this.loadChildGrades(params.id, e.target.value);
        }, 300);
    },

    async loadChildGrades(studentId, query = '') {
        const res = await API.request('parentGetGrades', { studentId });
        const container = document.getElementById('grades-list');

        if (!res.success) {
            container.innerHTML = UI.emptyState('ไม่สามารถโหลดข้อมูลได้', res.error);
            return;
        }

        let grades = res.data || [];

        if (query) {
            const q = query.toLowerCase();
            grades = grades.filter(g =>
                g.assignment?.title?.toLowerCase().includes(q) ||
                g.subjectName?.toLowerCase().includes(q)
            );
        }

        if (grades.length === 0) {
            container.innerHTML = UI.emptyState('ไม่พบข้อมูล', '');
            return;
        }

        container.innerHTML = grades.map(g => {
            const status = Utils.getStatusInfo(g.submission?.status || 'NOT_SUBMITTED');
            const hasGrade = g.grade !== null;
            const pct = hasGrade ? Utils.getScorePercentage(g.grade.score, g.assignment?.maxScore) : 0;

            return `
                <div class="card p-4">
                    <div class="flex justify-between items-start mb-2">
                        <div>
                            <h4 class="font-semibold">${Utils.escapeHtml(g.assignment?.title || '')}</h4>
                            <p class="text-sm text-gray-500">${Utils.escapeHtml(g.subjectName || '')}</p>
                        </div>
                        <span class="badge ${status.class}">${status.label}</span>
                    </div>
                    
                    <div class="flex items-center justify-between text-sm text-gray-600 mb-3">
                        <span>กำหนดส่ง: ${Utils.formatDateTime(g.assignment?.dueDate)}</span>
                        ${g.submission?.submittedAt ? `<span>ส่งเมื่อ: ${Utils.formatDateTime(g.submission.submittedAt)}</span>` : ''}
                    </div>

                    ${hasGrade ? `
                        <div class="bg-gradient-to-r from-green-50 to-blue-50 rounded-xl p-4">
                            <div class="flex justify-between items-center mb-2">
                                <span class="text-sm text-gray-600">คะแนนที่ได้:</span>
                                <span class="text-2xl font-bold ${Utils.getScoreColorClass(pct)}">${g.grade.score}/${g.assignment?.maxScore}</span>
                            </div>
                            <div class="progress-bar mb-2">
                                <div class="progress-bar-fill" style="width: ${pct}%"></div>
                            </div>
                            ${g.grade.feedback ? `
                                <div class="mt-3 pt-3 border-t border-gray-200">
                                    <p class="text-sm text-gray-600"><strong>ความคิดเห็นจากครู:</strong></p>
                                    <p class="text-sm text-gray-700 mt-1">${Utils.escapeHtml(g.grade.feedback)}</p>
                                </div>
                            ` : ''}
                        </div>
                    ` : ''}
                    
                    ${g.submission?.version > 1 ? `
                        <p class="text-xs text-gray-500 mt-2">เวอร์ชันการส่ง: ${g.submission.version}</p>
                    ` : ''}
                </div>
            `;
        }).join('');
    },

    // All grades overview
    async renderGrades() {
        const app = document.getElementById('app');
        app.innerHTML = UI.pageWrapper(`
            <div class="page-enter">
                ${UI.header('ภาพรวมคะแนน')}
                <div id="grades-overview">${UI.skeleton(3)}</div>
            </div>
        `);

        const childrenRes = await API.request('getLinkedStudents');
        const container = document.getElementById('grades-overview');

        if (!childrenRes.success || !childrenRes.data?.length) {
            container.innerHTML = UI.emptyState('ยังไม่มีลูกที่เชื่อมต่อ', '');
            return;
        }

        let html = '';
        for (const child of childrenRes.data) {
            const gradesRes = await API.request('parentGetGrades', { studentId: child.id });
            const grades = gradesRes.data || [];

            const graded = grades.filter(g => g.grade);
            const totalScore = graded.reduce((sum, g) => sum + (g.grade?.score || 0), 0);
            const totalMax = graded.reduce((sum, g) => sum + (g.assignment?.maxScore || 0), 0);
            const overallPct = Utils.getScorePercentage(totalScore, totalMax);

            html += `
                <div class="card p-6 mb-4">
                    <div class="flex items-center justify-between mb-4">
                        <div class="flex items-center space-x-3">
                            <div class="avatar">${Utils.getInitials(child.name)}</div>
                            <div>
                                <h3 class="font-semibold">${Utils.escapeHtml(child.name)}</h3>
                                <p class="text-sm text-gray-500">${Utils.escapeHtml(child.relation)}</p>
                            </div>
                        </div>
                        <div class="text-right">
                            <p class="text-2xl font-bold ${Utils.getScoreColorClass(overallPct)}">${overallPct}%</p>
                            <p class="text-sm text-gray-500">${totalScore}/${totalMax} คะแนน</p>
                        </div>
                    </div>
                    
                    <div class="grid grid-cols-3 gap-4 text-center">
                        <div class="p-3 bg-green-50 rounded-xl">
                            <p class="text-2xl font-bold text-green-600">${graded.length}</p>
                            <p class="text-sm text-gray-600">ตรวจแล้ว</p>
                        </div>
                        <div class="p-3 bg-yellow-50 rounded-xl">
                            <p class="text-2xl font-bold text-yellow-600">${grades.filter(g => g.submission && !g.grade).length}</p>
                            <p class="text-sm text-gray-600">รอตรวจ</p>
                        </div>
                        <div class="p-3 bg-red-50 rounded-xl">
                            <p class="text-2xl font-bold text-red-600">${grades.filter(g => !g.submission).length}</p>
                            <p class="text-sm text-gray-600">ยังไม่ส่ง</p>
                        </div>
                    </div>
                    
                    <a href="/parent/child/${child.id}" data-link class="btn btn-secondary w-full mt-4">ดูรายละเอียด</a>
                </div>
            `;
        }

        container.innerHTML = html || UI.emptyState('ไม่มีข้อมูล', '');
    },

    // Settings
    renderSettings() {
        const app = document.getElementById('app');
        const user = Auth.getCurrentUser();

        app.innerHTML = UI.pageWrapper(`
            <div class="page-enter">
                ${UI.header('ตั้งค่า')}
                
                <div class="card p-6 mb-4">
                    <h3 class="font-semibold mb-4">ข้อมูลบัญชี</h3>
                    <div class="flex items-center space-x-4">
                        <div class="avatar avatar-lg">${Utils.getInitials(user?.name)}</div>
                        <div>
                            <p class="font-semibold text-lg">${Utils.escapeHtml(user?.name || '')}</p>
                            <p class="text-gray-500">${Utils.escapeHtml(user?.email || '')}</p>
                            <p class="text-sm text-primary-600 mt-1">ผู้ปกครอง</p>
                        </div>
                    </div>
                </div>

                <div class="card p-6 mb-4">
                    <h3 class="font-semibold mb-4">เชื่อมต่อลูกเพิ่มเติม</h3>
                    <button onclick="Parent.showLinkChildModal()" class="btn btn-primary w-full">เพิ่มลูก</button>
                </div>

                <button onclick="Auth.logout()" class="btn btn-danger w-full">ออกจากระบบ</button>
            </div>
        `);
    }
};

window.Parent = Parent;
