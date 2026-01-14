/**
 * Teacher Module - Teacher functionality
 */
const Teacher = {
    // Dashboard
    async renderDashboard() {
        const app = document.getElementById('app');
        app.innerHTML = UI.pageWrapper(`
            <div class="page-enter">
                ${UI.header('แดชบอร์ดครู')}
                
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    ${UI.statsCard('ห้องเรียน', '0', 'class', 'bg-blue-100 text-blue-600', 'classes-count')}
                    ${UI.statsCard('งานทั้งหมด', '0', 'assignment', 'bg-green-100 text-green-600', 'assignments-count')}
                    ${UI.statsCard('รอตรวจ', '0', 'pending', 'bg-yellow-100 text-yellow-600', 'pending-count')}
                    ${UI.statsCard('ตรวจแล้ว', '0', 'graded', 'bg-purple-100 text-purple-600', 'graded-count')}
                </div>

                <div class="grid md:grid-cols-2 gap-6">
                    <div class="card p-6">
                        <h3 class="text-lg font-semibold mb-4">งานรอตรวจล่าสุด</h3>
                        <div id="pending-submissions" class="space-y-3">
                            ${UI.skeleton(3)}
                        </div>
                    </div>
                    
                    <div class="card p-6">
                        <h3 class="text-lg font-semibold mb-4">ลิงก์ด่วน</h3>
                        <div class="grid grid-cols-2 gap-3">
                            <a href="/teacher/classes" data-link class="btn btn-secondary">จัดการห้องเรียน</a>
                            <a href="/teacher/assignments" data-link class="btn btn-secondary">สร้างงานใหม่</a>
                            <a href="/teacher/gradebook" data-link class="btn btn-secondary">สมุดคะแนน</a>
                            <button onclick="Teacher.exportGrades()" class="btn btn-secondary">ส่งออก CSV</button>
                        </div>
                    </div>
                </div>
            </div>
        `);

        this.loadDashboardData();
    },

    async loadDashboardData() {
        const res = await API.request('getTeacherDashboardStats');
        const data = res.data || { stats: {}, recentPending: [] };
        const stats = data.stats;

        // Update Stats
        document.getElementById('classes-count').textContent = stats.classesCount || 0;
        document.getElementById('assignments-count').textContent = stats.assignmentsCount || 0;
        document.getElementById('pending-count').textContent = stats.pendingCount || 0;
        document.getElementById('graded-count').textContent = stats.gradedCount || 0;

        // Update Recent Pending
        const container = document.getElementById('pending-submissions');
        if (!data.recentPending || data.recentPending.length === 0) {
            container.innerHTML = UI.emptyState('ไม่มีงานรอตรวจ', 'งานที่ส่งเข้ามาจะแสดงที่นี่');
        } else {
            container.innerHTML = data.recentPending.map(s => `
                <div class="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                    <div>
                        <p class="font-medium">${Utils.escapeHtml(s.studentName)}</p>
                        <p class="text-sm text-gray-500">${Utils.escapeHtml(s.assignmentTitle)} - ${Utils.escapeHtml(s.subjectName)}</p>
                        <p class="text-xs text-gray-400">${Utils.formatDateTime(s.submittedAt)}</p>
                    </div>
                    <a href="/teacher/grade/${s.id}" data-link class="btn btn-sm btn-primary">ตรวจ</a>
                </div>
            `).join('');
        }
    },

    // ===== วิชาของฉัน (My Subjects - จาก Admin Assignment) =====
    async renderMySubjects() {
        const app = document.getElementById('app');
        app.innerHTML = UI.pageWrapper(`
            <div class="page-enter">
                ${UI.header('วิชาของฉัน', `<span class="text-sm text-gray-500">วิชาที่ได้รับมอบหมายจากผู้ดูแลระบบ</span>`)}
                
                <div id="my-subjects-list" class="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    ${UI.skeleton(3)}
                </div>
            </div>
        `);

        const res = await API.request('listMyClassSubjects', {});
        const container = document.getElementById('my-subjects-list');

        if (!res.success || !res.data?.data?.length) {
            container.innerHTML = UI.emptyState(
                'ยังไม่มีวิชาที่ได้รับมอบหมาย',
                'กรุณาติดต่อผู้ดูแลระบบเพื่อมอบหมายวิชา'
            );
            return;
        }

        // Group by class
        const byClass = {};
        res.data.data.forEach(cs => {
            if (!byClass[cs.classId]) {
                byClass[cs.classId] = { className: cs.className, subjects: [] };
            }
            byClass[cs.classId].subjects.push(cs);
        });

        container.innerHTML = Object.values(byClass).map(group => `
            <div class="card p-5">
                <div class="flex items-center justify-between mb-4">
                    <h3 class="text-lg font-semibold">${Utils.escapeHtml(group.className)}</h3>
                    <span class="badge badge-submitted">${group.subjects.length} วิชา</span>
                </div>
                <div class="space-y-2">
                    ${group.subjects.map(s => `
                        <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div>
                                <p class="font-medium">${Utils.escapeHtml(s.subjectName)}</p>
                                <p class="text-xs text-gray-500 font-mono">${Utils.escapeHtml(s.subjectCode)}</p>
                            </div>
                            <div class="flex items-center space-x-2">
                                <span class="text-xs text-gray-500">${s.assignmentCount || 0} งาน</span>
                                <a href="/teacher/my-subject/${s.id}" data-link class="btn btn-sm btn-primary">จัดการ</a>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `).join('');
    },

    // ===== My Subject Detail (แสดงงานในวิชา) =====
    async renderMySubjectDetail(params) {
        const app = document.getElementById('app');
        const classSubjectId = params.id;

        // Get subject info
        const mySubjectsRes = await API.request('listMyClassSubjects', {});
        const subject = mySubjectsRes.data?.data?.find(s => s.id === classSubjectId);

        if (!subject) {
            app.innerHTML = UI.pageWrapper(UI.emptyState('ไม่พบวิชา หรือคุณไม่มีสิทธิ์เข้าถึง', ''));
            return;
        }

        app.innerHTML = UI.pageWrapper(`
            <div class="page-enter">
                ${UI.header(`${subject.subjectName}`, `
                    <div class="flex items-center space-x-2">
                        <span class="text-sm text-gray-500">${Utils.escapeHtml(subject.className)}</span>
                        <button onclick="Teacher.showCreateAssignmentV2('${classSubjectId}')" class="btn btn-primary btn-sm">+ สร้างงาน</button>
                    </div>
                `)}
                
                <div class="card p-4 mb-4">
                    <div class="grid grid-cols-3 gap-4 text-center">
                        <div>
                            <p class="text-2xl font-bold text-blue-600">${subject.studentCount || 0}</p>
                            <p class="text-sm text-gray-500">นักเรียน</p>
                        </div>
                        <div>
                            <p class="text-2xl font-bold text-green-600">${subject.assignmentCount || 0}</p>
                            <p class="text-sm text-gray-500">งาน</p>
                        </div>
                        <div>
                            <p class="text-2xl font-bold text-purple-600">-</p>
                            <p class="text-sm text-gray-500">รอตรวจ</p>
                        </div>
                    </div>
                </div>

                <h3 class="font-semibold mb-3">งานในวิชานี้</h3>
                <div id="subject-assignments" class="space-y-3">${UI.skeleton(3)}</div>
            </div>
        `);

        // Load assignments for this class_subject
        const assignRes = await API.request('listAssignmentsByClassSubject', { classSubjectId });
        const container = document.getElementById('subject-assignments');

        if (!assignRes.success || !assignRes.data?.data?.length) {
            container.innerHTML = UI.emptyState('ยังไม่มีงาน', 'สร้างงานใหม่เพื่อมอบหมายให้นักเรียน');
            return;
        }

        container.innerHTML = assignRes.data.data.map(a => {
            const isPast = Utils.isPastDue(a.dueDate);
            return `
                <div class="card p-4">
                    <div class="flex justify-between items-start mb-2">
                        <div>
                            <h4 class="font-semibold">${Utils.escapeHtml(a.title)}</h4>
                            <p class="text-sm text-gray-500">คะแนน ${a.maxScore} | ส่งแล้ว ${a.submissionCount || 0} | ตรวจแล้ว ${a.gradedCount || 0}</p>
                        </div>
                        <span class="badge ${isPast ? 'badge-late-submission' : 'badge-submitted'}">
                            ${isPast ? 'เลยกำหนด' : 'เปิดรับ'}
                        </span>
                    </div>
                    <p class="text-sm text-gray-600 mb-3">กำหนดส่ง: ${Utils.formatDateTime(a.dueDate)}</p>
                    <div class="flex space-x-2">
                        <a href="/teacher/assignment/${a.id}/submissions" data-link class="btn btn-sm btn-primary">ดูงานส่ง</a>
                        <button onclick="Teacher.showEditAssignmentV2('${a.id}', '${classSubjectId}')" class="btn btn-sm btn-secondary">แก้ไข</button>
                    </div>
                </div>
            `;
        }).join('');
    },

    // ===== Create Assignment V2 (ใช้กับ class_subject) =====
    async showCreateAssignmentV2(classSubjectId) {
        UI.showModal('สร้างงานใหม่', `
            <form id="create-assignment-v2-form" class="space-y-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">ชื่องาน</label>
                    <input type="text" name="title" class="input-field" required>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">รายละเอียด</label>
                    <textarea name="detail" class="input-field" rows="3"></textarea>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">กำหนดส่ง</label>
                    <input type="datetime-local" name="dueDate" class="input-field" required>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">คะแนนเต็ม</label>
                    <input type="number" name="maxScore" class="input-field" value="10" min="1" required>
                </div>
                <button type="submit" class="btn btn-primary w-full">สร้างงาน</button>
            </form>
        `);

        document.getElementById('create-assignment-v2-form').onsubmit = async (e) => {
            e.preventDefault();
            const fd = new FormData(e.target);
            const res = await API.request('createAssignmentV2', {
                classSubjectId,
                title: fd.get('title'),
                detail: fd.get('detail'),
                dueDate: new Date(fd.get('dueDate')).toISOString(),
                maxScore: parseInt(fd.get('maxScore'))
            });

            if (res.success) {
                UI.hideModal();
                UI.showToast('สร้างงานสำเร็จ', 'success');
                this.renderMySubjectDetail({ id: classSubjectId });
            } else {
                UI.showToast(res.error, 'error');
            }
        };
    },

    async showEditAssignmentV2(assignmentId, classSubjectId) {
        // Fetch existing assignment data
        const res = await API.request('getAssignment', { assignmentId });
        if (!res.success) {
            UI.showToast('ไม่พบข้อมูลงาน', 'error');
            return;
        }
        const assignment = res.data;

        // Format datetime-local value (YYYY-MM-DDThh:mm)
        const dueDate = new Date(assignment.dueDate);
        // Correct timezone offset for display
        const offset = dueDate.getTimezoneOffset() * 60000;
        const localISOTime = (new Date(dueDate - offset)).toISOString().slice(0, 16);

        UI.showModal('แก้ไขงาน', `
            <form id="edit-assignment-v2-form" class="space-y-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">ชื่องาน</label>
                    <input type="text" name="title" class="input-field" value="${Utils.escapeHtml(assignment.title)}" required>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">รายละเอียด</label>
                    <textarea name="detail" class="input-field" rows="3">${Utils.escapeHtml(assignment.detail || '')}</textarea>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">กำหนดส่ง</label>
                    <input type="datetime-local" name="dueDate" class="input-field" value="${localISOTime}" required>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">คะแนนเต็ม</label>
                    <input type="number" name="maxScore" class="input-field" value="${assignment.maxScore}" min="1" required>
                </div>
                <button type="submit" class="btn btn-primary w-full">บันทึกการแก้ไข</button>
            </form>
        `);

        document.getElementById('edit-assignment-v2-form').onsubmit = async (e) => {
            e.preventDefault();
            const fd = new FormData(e.target);

            // Assuming updateAssignment API exists or we reuse create with 'id' if backend supports upsert, 
            // but checking api.js, we don't have 'updateAssignment'. 
            // Let's assume we need to add it or use a demo function. 
            // Looking at API handlers, there isn't an explicit 'updateAssignment' exposed in the huge list.
            // But for demo let's add the call and I will implement it in API.js next step.

            const res = await API.request('updateAssignment', {
                assignmentId,
                title: fd.get('title'),
                detail: fd.get('detail'),
                dueDate: new Date(fd.get('dueDate')).toISOString(),
                maxScore: parseInt(fd.get('maxScore'))
            });

            if (res.success) {
                UI.hideModal();
                UI.showToast('แก้ไขงานสำเร็จ', 'success');
                this.renderMySubjectDetail({ id: classSubjectId });
            } else {
                UI.showToast(res.error, 'error');
            }
        };
    },

    // Classes Management
    async renderClasses() {
        const app = document.getElementById('app');
        app.innerHTML = UI.pageWrapper(`
            <div class="page-enter">
                ${UI.header('ห้องเรียน', `<button onclick="Teacher.showCreateClassModal()" class="btn btn-primary btn-sm">+ สร้างห้อง</button>`)}
                
                <div id="classes-list" class="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    ${UI.skeleton(3)}
                </div>
            </div>
        `);

        const res = await API.request('listClasses');
        const container = document.getElementById('classes-list');

        if (!res.success || !res.data?.length) {
            container.innerHTML = UI.emptyState('ยังไม่มีห้องเรียน', 'สร้างห้องเรียนใหม่เพื่อเริ่มต้น');
            return;
        }

        container.innerHTML = res.data.map(c => `
            <div class="card card-interactive p-5">
                <div class="flex justify-between items-start mb-4">
                    <div>
                        <h3 class="text-lg font-semibold">${Utils.escapeHtml(c.name)}</h3>
                        <p class="text-sm text-gray-500">รหัสเข้าร่วม: <span class="font-mono font-bold text-primary-600">${c.joinCode}</span></p>
                    </div>
                    <button onclick="Teacher.copyJoinCode('${c.joinCode}')" class="p-2 hover:bg-gray-100 rounded-lg">
                        <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                        </svg>
                    </button>
                </div>
                <div class="flex space-x-2">
                    <a href="/teacher/class/${c.id}" data-link class="btn btn-sm btn-secondary flex-1">จัดการ</a>
                    <a href="/teacher/class/${c.id}/subjects" data-link class="btn btn-sm btn-primary flex-1">รายวิชา</a>
                </div>
            </div>
        `).join('');
    },

    showCreateClassModal() {
        UI.showModal('สร้างห้องเรียนใหม่', `
            <form id="create-class-form" class="space-y-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">ชื่อห้องเรียน</label>
                    <input type="text" name="name" class="input-field" placeholder="เช่น ม.3/1" required>
                </div>
                <button type="submit" class="btn btn-primary w-full">สร้างห้องเรียน</button>
            </form>
        `);

        document.getElementById('create-class-form').onsubmit = async (e) => {
            e.preventDefault();
            const name = e.target.name.value;
            const res = await API.request('createClass', { name });
            if (res.success) {
                UI.hideModal();
                UI.showToast('สร้างห้องเรียนสำเร็จ', 'success');
                this.renderClasses();
            } else {
                UI.showToast(res.error, 'error');
            }
        };
    },

    copyJoinCode(code) {
        navigator.clipboard.writeText(code);
        UI.showToast('คัดลอกรหัสแล้ว', 'success');
    },

    // Class Detail
    async renderClassDetail(params) {
        const app = document.getElementById('app');
        const res = await API.request('getClass', { classId: params.id });

        if (!res.success) {
            app.innerHTML = UI.pageWrapper(UI.emptyState('ไม่พบห้องเรียน', ''));
            return;
        }

        const c = res.data;
        app.innerHTML = UI.pageWrapper(`
            <div class="page-enter">
                ${UI.header(c.name, `<span class="text-sm text-gray-500">รหัส: ${c.joinCode}</span>`)}
                
                <div class="card p-6 mb-6">
                    <h3 class="font-semibold mb-4">นักเรียนในห้อง (${c.studentCount} คน)</h3>
                    ${c.students.length ? `
                        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                            ${c.students.map(s => `
                                <div class="flex items-center space-x-2 p-2 bg-gray-50 rounded-lg">
                                    <div class="avatar avatar-sm">${Utils.getInitials(s.name)}</div>
                                    <span class="text-sm truncate">${Utils.escapeHtml(s.name)}</span>
                                </div>
                            `).join('')}
                        </div>
                    ` : UI.emptyState('ยังไม่มีนักเรียน', 'แชร์รหัสเข้าร่วมให้นักเรียน')}
                </div>
                
                <div class="flex space-x-3">
                    <a href="/teacher/class/${c.id}/subjects" data-link class="btn btn-primary">จัดการรายวิชา</a>
                    <button onclick="Teacher.copyJoinCode('${c.joinCode}')" class="btn btn-secondary">คัดลอกรหัส</button>
                </div>
            </div>
        `);
    },

    // Subjects
    async renderSubjects(params) {
        const app = document.getElementById('app');
        app.innerHTML = UI.pageWrapper(`
            <div class="page-enter">
                ${UI.header('รายวิชา', `<button onclick="Teacher.showCreateSubjectModal('${params.id}')" class="btn btn-primary btn-sm">+ เพิ่มวิชา</button>`)}
                <div id="subjects-list" class="space-y-3">${UI.skeleton(3)}</div>
            </div>
        `);

        const res = await API.request('listSubjects', { classId: params.id });
        const container = document.getElementById('subjects-list');

        if (!res.success || !res.data?.length) {
            container.innerHTML = UI.emptyState('ยังไม่มีรายวิชา', 'เพิ่มรายวิชาเพื่อสร้างงาน');
            return;
        }

        container.innerHTML = res.data.map(s => `
            <div class="card card-interactive p-4 flex justify-between items-center">
                <span class="font-medium">${Utils.escapeHtml(s.name)}</span>
                <a href="/teacher/subject/${s.id}/assignments" data-link class="btn btn-sm btn-primary">ดูงาน</a>
            </div>
        `).join('');
    },

    showCreateSubjectModal(classId) {
        UI.showModal('เพิ่มรายวิชาใหม่', `
            <form id="create-subject-form" class="space-y-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">ชื่อวิชา</label>
                    <input type="text" name="name" class="input-field" placeholder="เช่น คณิตศาสตร์" required>
                </div>
                <button type="submit" class="btn btn-primary w-full">เพิ่มวิชา</button>
            </form>
        `);

        document.getElementById('create-subject-form').onsubmit = async (e) => {
            e.preventDefault();
            const res = await API.request('createSubject', { classId, name: e.target.name.value });
            if (res.success) {
                UI.hideModal();
                UI.showToast('เพิ่มวิชาสำเร็จ', 'success');
                this.renderSubjects({ id: classId });
            } else {
                UI.showToast(res.error, 'error');
            }
        };
    },

    // Assignments List
    async renderAssignments() {
        const app = document.getElementById('app');
        app.innerHTML = UI.pageWrapper(`
            <div class="page-enter">
                ${UI.header('งานทั้งหมด', `<button onclick="Teacher.showCreateAssignmentFlow()" class="btn btn-primary btn-sm">+ สร้างงาน</button>`)}
                
                <div class="mb-4">
                    ${UI.searchBox('search-assignments', 'ค้นหางาน...')}
                </div>
                
                <div id="assignments-list" class="space-y-4">${UI.skeleton(3)}</div>
                <div id="assignments-pagination" class="mt-4"></div>
            </div>
        `);

        this.loadAssignments();

        document.getElementById('search-assignments').oninput = Utils.debounce((e) => {
            this.loadAssignments(1, e.target.value);
        }, 300);
    },

    async loadAssignments(page = 1, query = '') {
        const res = await API.request('listAssignments', { page, pageSize: 10, query });
        const container = document.getElementById('assignments-list');

        if (!res.success || !res.data?.data?.length) {
            container.innerHTML = UI.emptyState('ยังไม่มีงาน', 'สร้างงานใหม่เพื่อมอบหมายให้นักเรียน');
            return;
        }

        container.innerHTML = res.data.data.map(a => {
            const isPast = Utils.isPastDue(a.dueDate);
            return `
                <div class="card p-4">
                    <div class="flex justify-between items-start mb-2">
                        <div>
                            <h4 class="font-semibold">${Utils.escapeHtml(a.title)}</h4>
                            <p class="text-sm text-gray-500">${Utils.escapeHtml(a.subjectName || '')}</p>
                        </div>
                        <span class="badge ${isPast ? 'badge-late-submission' : 'badge-submitted'}">
                            ${isPast ? 'เลยกำหนด' : 'เปิดรับ'}
                        </span>
                    </div>
                    <p class="text-sm text-gray-600 mb-3">กำหนดส่ง: ${Utils.formatDateTime(a.dueDate)}</p>
                    <div class="flex space-x-2">
                        <a href="/teacher/assignment/${a.id}/submissions" data-link class="btn btn-sm btn-primary">ดูงานส่ง</a>
                        <a href="/teacher/assignment/${a.id}" data-link class="btn btn-sm btn-secondary">แก้ไข</a>
                    </div>
                </div>
            `;
        }).join('');

        document.getElementById('assignments-pagination').innerHTML = UI.pagination(res.data, (p) => this.loadAssignments(p, query));
    },

    async showCreateAssignmentFlow() {
        // First select class and subject
        const classesRes = await API.request('listClasses');
        if (!classesRes.success || !classesRes.data?.length) {
            UI.showToast('กรุณาสร้างห้องเรียนก่อน', 'warning');
            return;
        }

        let subjectsHtml = '';
        for (const c of classesRes.data) {
            const subRes = await API.request('listSubjects', { classId: c.id });
            if (subRes.data?.length) {
                subjectsHtml += subRes.data.map(s =>
                    `<option value="${s.id}">${c.name} - ${s.name}</option>`
                ).join('');
            }
        }

        if (!subjectsHtml) {
            UI.showToast('กรุณาสร้างรายวิชาก่อน', 'warning');
            return;
        }

        UI.showModal('สร้างงานใหม่', `
            <form id="create-assignment-form" class="space-y-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">วิชา</label>
                    <select name="subjectId" class="input-field" required>${subjectsHtml}</select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">ชื่องาน</label>
                    <input type="text" name="title" class="input-field" required>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">รายละเอียด</label>
                    <textarea name="detail" class="input-field" rows="3"></textarea>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">กำหนดส่ง</label>
                    <input type="datetime-local" name="dueDate" class="input-field" required>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">คะแนนเต็ม</label>
                    <input type="number" name="maxScore" class="input-field" value="10" min="1" required>
                </div>
                <button type="submit" class="btn btn-primary w-full">สร้างงาน</button>
            </form>
        `);

        document.getElementById('create-assignment-form').onsubmit = async (e) => {
            e.preventDefault();
            const fd = new FormData(e.target);
            const res = await API.request('createAssignment', {
                subjectId: fd.get('subjectId'),
                title: fd.get('title'),
                detail: fd.get('detail'),
                dueDate: new Date(fd.get('dueDate')).toISOString(),
                maxScore: parseInt(fd.get('maxScore'))
            });

            if (res.success) {
                UI.hideModal();
                UI.showToast('สร้างงานสำเร็จ', 'success');
                this.renderAssignments();
            } else {
                UI.showToast(res.error, 'error');
            }
        };
    },

    // Submissions by Assignment
    async renderSubmissions(params) {
        const app = document.getElementById('app');
        const assignRes = await API.request('getAssignment', { assignmentId: params.id });

        if (!assignRes.success) {
            app.innerHTML = UI.pageWrapper(UI.emptyState('ไม่พบงาน', ''));
            return;
        }

        const assignment = assignRes.data;
        app.innerHTML = UI.pageWrapper(`
            <div class="page-enter">
                ${UI.header(assignment.title, `<span class="text-sm text-gray-500">${assignment.subjectName}</span>`)}
                
                <div class="card p-4 mb-4">
                    <p class="text-sm"><strong>กำหนดส่ง:</strong> ${Utils.formatDateTime(assignment.dueDate)}</p>
                    <p class="text-sm"><strong>คะแนนเต็ม:</strong> ${assignment.maxScore}</p>
                </div>

                <div class="flex flex-wrap gap-2 mb-4">
                    ${UI.filterChips(['ทั้งหมด', 'รอตรวจ', 'ตรวจแล้ว', 'ส่งช้า'], 'status-filter')}
                </div>

                <div id="submissions-list" class="space-y-3">${UI.skeleton(5)}</div>
                <div id="submissions-pagination" class="mt-4"></div>
            </div>
        `);

        this.loadSubmissions(params.id);

        document.querySelectorAll('.filter-chip').forEach(chip => {
            chip.onclick = () => {
                document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                const statusMap = { 'ทั้งหมด': '', 'รอตรวจ': 'SUBMITTED', 'ตรวจแล้ว': 'GRADED', 'ส่งช้า': 'LATE_SUBMISSION' };
                this.loadSubmissions(params.id, 1, statusMap[chip.textContent]);
            };
        });
    },

    async loadSubmissions(assignmentId, page = 1, statusFilter = '') {
        const res = await API.request('listSubmissionsByAssignment', { assignmentId, page, pageSize: 10, statusFilter });
        const container = document.getElementById('submissions-list');

        if (!res.success || !res.data?.data?.length) {
            container.innerHTML = UI.emptyState('ยังไม่มีงานส่ง', 'นักเรียนยังไม่ได้ส่งงาน');
            return;
        }

        container.innerHTML = res.data.data.map(s => {
            const status = Utils.getStatusInfo(s.status);
            return `
                <div class="card p-4 flex justify-between items-center">
                    <div class="flex items-center space-x-3">
                        <div class="avatar">${Utils.getInitials(s.studentName)}</div>
                        <div>
                            <p class="font-medium">${Utils.escapeHtml(s.studentName)}</p>
                            <p class="text-sm text-gray-500">${Utils.formatDateTime(s.submittedAt)}</p>
                        </div>
                    </div>
                    <div class="flex items-center space-x-3">
                        <span class="badge ${status.class}">${status.label}</span>
                        ${s.grade ? `<span class="font-bold text-green-600">${s.grade.score}</span>` : ''}
                        <a href="/teacher/grade/${s.id}" data-link class="btn btn-sm btn-primary">
                            ${s.status === 'GRADED' ? 'ดู' : 'ตรวจ'}
                        </a>
                    </div>
                </div>
            `;
        }).join('');
    },

    // Grade Submission
    async renderGradeSubmission(params) {
        // Get submission details using explicit API
        const res = await API.request('getSubmission', { submissionId: params.id });

        if (!res.success) {
            document.getElementById('app').innerHTML = UI.pageWrapper(UI.emptyState('ไม่พบงานส่ง', res.error || ''));
            return;
        }

        const submission = res.data;
        const assignment = submission.assignment;
        const existingGrade = submission.grade;

        document.getElementById('app').innerHTML = UI.pageWrapper(`
            <div class="page-enter">
                ${UI.header('ตรวจงาน')}
                
                <div class="grid md:grid-cols-2 gap-6">
                    <div>
                        <div class="card p-5 mb-4">
                            <h3 class="font-semibold mb-2">${Utils.escapeHtml(assignment?.title || '')}</h3>
                            <p class="text-sm text-gray-600 mb-4">${Utils.escapeHtml(assignment?.detail || '')}</p>
                            <p class="text-sm"><strong>คะแนนเต็ม:</strong> ${assignment?.maxScore || 10}</p>
                        </div>
                        
                        <div class="card p-5">
                            <h4 class="font-semibold mb-3">งานที่ส่ง</h4>
                            <div class="bg-gray-50 p-4 rounded-xl">
                                <p class="whitespace-pre-wrap">${Utils.escapeHtml(submission.text || 'ไม่มีข้อความ')}</p>
                                ${submission.link ? `<a href="${submission.link}" target="_blank" class="text-primary-600 underline mt-2 block">${submission.link}</a>` : ''}
                            </div>
                            <p class="text-sm text-gray-500 mt-3">ส่งเมื่อ: ${Utils.formatDateTime(submission.submittedAt)}</p>
                            <p class="text-sm text-gray-500">เวอร์ชัน: ${submission.version}</p>
                        </div>
                    </div>
                    
                    <div class="card p-5">
                        <h4 class="font-semibold mb-4">ให้คะแนน</h4>
                        <form id="grade-form" class="space-y-4">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">คะแนน (เต็ม ${assignment?.maxScore || 10})</label>
                                <input type="number" name="score" class="input-field" min="0" max="${assignment?.maxScore || 10}" value="${existingGrade?.score || ''}" required>
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">ความคิดเห็น</label>
                                <textarea name="feedback" class="input-field" rows="4">${existingGrade?.feedback || ''}</textarea>
                            </div>
                            <div class="flex space-x-3">
                                <button type="submit" class="btn btn-success flex-1">บันทึกคะแนน</button>
                                <button type="button" onclick="Teacher.requestRevision('${submission.id}')" class="btn btn-secondary flex-1">ขอแก้ไข</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `);

        document.getElementById('grade-form').onsubmit = async (e) => {
            e.preventDefault();
            const fd = new FormData(e.target);
            const res = await API.request('gradeHomework', {
                submissionId: params.id,
                score: parseFloat(fd.get('score')),
                feedback: fd.get('feedback')
            });

            if (res.success) {
                UI.showToast('บันทึกคะแนนสำเร็จ', 'success');
                history.back();
            } else {
                UI.showToast(res.error, 'error');
            }
        };
    },

    async requestRevision(submissionId) {
        UI.showModal('ขอให้แก้ไข', `
            <form id="revision-form" class="space-y-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">เหตุผลที่ต้องแก้ไข</label>
                    <textarea name="reason" class="input-field" rows="3" required></textarea>
                </div>
                <button type="submit" class="btn btn-primary w-full">ส่งคำขอ</button>
            </form>
        `);

        document.getElementById('revision-form').onsubmit = async (e) => {
            e.preventDefault();
            const res = await API.request('requestRevision', {
                submissionId,
                reason: e.target.reason.value
            });

            if (res.success) {
                UI.hideModal();
                UI.showToast('ส่งคำขอแก้ไขแล้ว', 'success');
                history.back();
            } else {
                UI.showToast(res.error, 'error');
            }
        };
    },

    // Gradebook
    async renderGradebook() {
        const app = document.getElementById('app');
        app.innerHTML = UI.pageWrapper(`
            <div class="page-enter">
                ${UI.header('สมุดคะแนน', `
                    <div class="flex space-x-2">
                        <button onclick="Teacher.exportGrades()" class="btn btn-sm btn-secondary">ส่งออกคะแนน</button>
                        <button onclick="Teacher.exportMissing()" class="btn btn-sm btn-secondary">ส่งออกค้างส่ง</button>
                    </div>
                `)}
                
                <div id="gradebook-content">${UI.skeleton(5)}</div>
            </div>
        `);
        this.loadGradebook();
    },

    async loadGradebook() {
        const res = await API.request('getGradebookData');
        const container = document.getElementById('gradebook-content');

        if (!res.success || !res.data?.length) {
            container.innerHTML = UI.emptyState('ยังไม่มีข้อมูลการเรียนการสอน', 'สร้างห้องเรียนและรายวิชาเพื่อเริ่มต้น');
            return;
        }

        let html = '';

        for (const c of res.data) {
            // Only show classes that have subjects or students, otherwise it's just empty noise (unless it's homeroom)
            // But let's show all returned by API (which already filters mostly)

            const students = c.students || [];
            const subjects = c.subjects || [];

            html += `<div class="card p-4 mb-4">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="font-semibold text-lg">${Utils.escapeHtml(c.className)}</h3>
                    <span class="text-sm text-gray-500">${students.length} นักเรียน</span>
                </div>
                <div class="table-responsive">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th class="w-1/4">นักเรียน</th>
                                ${subjects.map(s => `
                                    <th class="text-center">
                                        ${Utils.escapeHtml(s.name)}
                                        <div class="text-xs text-gray-400 font-normal">เต็ม ${s.totalMaxScore}</div>
                                    </th>
                                `).join('')}
                            </tr>
                        </thead>
                        <tbody>
                            ${students.length > 0 ? students.map(st => `
                                <tr>
                                    <td class="font-medium">
                                        <div class="flex items-center space-x-2">
                                            <div class="avatar avatar-xs">${Utils.getInitials(st.name)}</div>
                                            <span>${Utils.escapeHtml(st.name)}</span>
                                        </div>
                                    </td>
                                    ${subjects.map(s => {
                const score = s.studentScores[st.id] !== undefined ? s.studentScores[st.id] : 0;
                return `<td class="text-center font-mono">${score}</td>`;
            }).join('')}
                                </tr>
                            `).join('') : `<tr><td colspan="${subjects.length + 1}" class="text-center py-4 text-gray-500">ยังไม่มีนักเรียนในห้องนี้</td></tr>`}
                        </tbody>
                    </table>
                </div>
            </div>`;
        }

        container.innerHTML = html || UI.emptyState('ไม่พบข้อมูลคะแนน', 'ยังไม่มีการมอบหมายงานหรือตรวจคะแนน');
    },

    async exportGrades() {
        const res = await API.request('exportGradesCSV');
        if (res.success && res.data) {
            const headers = [
                { key: 'subjectName', label: 'วิชา' },
                { key: 'title', label: 'งาน' },
                { key: 'score', label: 'คะแนน' },
                { key: 'maxScore', label: 'เต็ม' },
                { key: 'status', label: 'สถานะ' }
            ];

            const rows = res.data.map(g => ({
                subjectName: g.subjectName,
                title: g.assignment?.title,
                score: g.grade?.score || '-',
                maxScore: g.assignment?.maxScore,
                status: Utils.getStatusInfo(g.submission?.status).label
            }));

            const csv = Utils.arrayToCSV(rows, headers);
            Utils.downloadCSV(csv, 'grades_export.csv');
            UI.showToast('ส่งออกสำเร็จ', 'success');
        }
    },

    async exportMissing() {
        const res = await API.request('exportMissingCSV');
        if (res.success && res.data) {
            const headers = [
                { key: 'className', label: 'ห้อง' },
                { key: 'subjectName', label: 'วิชา' },
                { key: 'assignmentTitle', label: 'งาน' },
                { key: 'studentName', label: 'นักเรียน' },
                { key: 'dueDate', label: 'กำหนดส่ง' }
            ];

            const rows = res.data.map(m => ({
                ...m,
                dueDate: Utils.formatDate(m.dueDate)
            }));

            const csv = Utils.arrayToCSV(rows, headers);
            Utils.downloadCSV(csv, 'missing_submissions.csv');
            UI.showToast('ส่งออกสำเร็จ', 'success');
        }
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
                    <div class="flex items-center space-x-4 mb-4">
                        <div class="avatar avatar-lg">${Utils.getInitials(user?.name)}</div>
                        <div>
                            <p class="font-semibold text-lg">${Utils.escapeHtml(user?.name || '')}</p>
                            <p class="text-gray-500">${Utils.escapeHtml(user?.email || '')}</p>
                        </div>
                    </div>
                </div>

                <div class="card p-6 mb-4">
                    <h3 class="font-semibold mb-4">โหมดระบบ</h3>
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="font-medium">โหมดปัจจุบัน: ${Store.getMode() === 'demo' ? 'ทดลอง (Demo)' : 'API จริง'}</p>
                            <p class="text-sm text-gray-500">โหมดทดลองใช้ข้อมูลใน localStorage</p>
                        </div>
                        <button onclick="Teacher.toggleMode()" class="btn btn-secondary btn-sm">สลับโหมด</button>
                    </div>
                </div>

                <button onclick="Auth.logout()" class="btn btn-danger w-full">ออกจากระบบ</button>
            </div>
        `);
    },

    toggleMode() {
        const current = Store.getMode();
        Store.setMode(current === 'demo' ? 'api' : 'demo');
        UI.showToast(`เปลี่ยนเป็นโหมด ${Store.getMode() === 'demo' ? 'ทดลอง' : 'API'}`, 'success');
        this.renderSettings();
    }
};

window.Teacher = Teacher;
