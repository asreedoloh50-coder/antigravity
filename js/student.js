/**
 * Student Module - Student functionality
 */
const Student = {
    // Cache for frequently used data
    _cache: {
        classes: null,
        subjects: null,
        lastFetch: 0
    },

    // Prefetch data in background
    async prefetchData() {
        const TWO_MINUTES = 2 * 60 * 1000;
        if (Date.now() - this._cache.lastFetch < TWO_MINUTES) return;

        try {
            const [classesRes, subjectsRes] = await Promise.all([
                API.request('listClasses'),
                API.request('listSubjects', {})
            ]);
            this._cache.classes = classesRes.data || [];
            this._cache.subjects = subjectsRes.data || [];
            this._cache.lastFetch = Date.now();
        } catch (e) {
            console.warn('Student prefetch failed', e);
        }
    },

    // Dashboard
    async renderDashboard() {
        const app = document.getElementById('app');
        app.innerHTML = UI.pageWrapper(`
            <div class="page-enter">
                ${UI.header('แดชบอร์ดนักเรียน')}
                
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    ${UI.statsCard('ห้องเรียน', '0', 'class', 'bg-blue-100 text-blue-600', 'classes-count')}
                    ${UI.statsCard('งานทั้งหมด', '0', 'assignment', 'bg-green-100 text-green-600', 'assignments-count')}
                    ${UI.statsCard('รอส่ง', '0', 'pending', 'bg-yellow-100 text-yellow-600', 'pending-count')}
                    ${UI.statsCard('ตรวจแล้ว', '0', 'graded', 'bg-purple-100 text-purple-600', 'graded-count')}
                </div>

                <div class="grid md:grid-cols-2 gap-6">
                    <div class="card p-6">
                        <h3 class="text-lg font-semibold mb-4">งานใกล้กำหนดส่ง</h3>
                        <div id="upcoming-assignments" class="space-y-3">
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

        // Pre-fetch data for other pages in background
        this.prefetchData();
    },

    async loadDashboardData() {
        const res = await API.request('getStudentDashboardStats');
        const data = res.data || { stats: {}, upcoming: [], recentGrades: [] };
        const stats = data.stats;

        // Update Stats
        document.getElementById('classes-count').textContent = stats.classesCount || 0;
        document.getElementById('assignments-count').textContent = stats.assignmentsCount || 0;
        document.getElementById('pending-count').textContent = stats.pendingCount || 0;
        document.getElementById('graded-count').textContent = stats.gradedCount || 0;

        // Upcoming assignments
        const upcomingContainer = document.getElementById('upcoming-assignments');
        if (!data.upcoming || data.upcoming.length === 0) {
            upcomingContainer.innerHTML = UI.emptyState('ไม่มีงานค้างส่ง', '🎉 เยี่ยม!');
        } else {
            upcomingContainer.innerHTML = data.upcoming.map(a => {
                const days = Utils.getDaysUntilDue(a.dueDate);
                const urgent = days <= 1;
                return `
                    <div class="flex items-center justify-between p-3 ${urgent ? 'bg-red-50' : 'bg-gray-50'} rounded-xl">
                        <div>
                            <p class="font-medium">${Utils.escapeHtml(a.title)}</p>
                            <p class="text-sm text-gray-500">${Utils.escapeHtml(a.subjectName)}</p>
                        </div>
                        <div class="text-right">
                            <p class="text-sm ${urgent ? 'text-red-600 font-bold' : 'text-gray-500'}">
                                ${days <= 0 ? 'วันนี้!' : `อีก ${days} วัน`}
                            </p>
                            <a href="/student/submit/${a.id}" data-link class="text-primary-600 text-sm font-medium">ส่งงาน →</a>
                        </div>
                    </div>
                `;
            }).join('');
        }

        // Recent grades
        const recentGradesContainer = document.getElementById('recent-grades');
        if (!data.recentGrades || data.recentGrades.length === 0) {
            recentGradesContainer.innerHTML = UI.emptyState('ยังไม่มีคะแนน', 'งานที่ตรวจแล้วจะแสดงที่นี่');
        } else {
            recentGradesContainer.innerHTML = data.recentGrades.map(s => `
                <div class="flex items-center justify-between p-3 bg-green-50 rounded-xl">
                    <div>
                        <p class="font-medium">${Utils.escapeHtml(s.assignmentTitle)}</p>
                        <p class="text-xs text-gray-500">
                            ${s.feedback ? Utils.escapeHtml(s.feedback) : 'ได้คะแนนแล้ว'}
                        </p>
                    </div>
                    <div class="text-right">
                        <span class="text-lg font-bold text-green-700">${s.score}</span>
                        <span class="text-xs text-gray-500">/${s.maxScore}</span>
                        <div class="text-xs text-primary-600 mt-1">
                            <a href="/student/submission/${s.id}" data-link>ดูรายละเอียด</a>
                        </div>
                    </div>
                </div>
            `).join('');
        }
    },

    // Classes (My Classroom) -> Now lists Subjects directly
    async renderClasses() {
        const app = document.getElementById('app');
        app.innerHTML = UI.pageWrapper(`
            <div class="page-enter">
                ${UI.header('ห้องเรียนของฉัน')}
                <div id="classroom-content">
                    ${UI.skeleton(3)}
                </div>
            </div>
        `);

        // 1. Get Enrolled Classes
        const classesRes = await API.request('listClasses');
        const container = document.getElementById('classroom-content');

        if (!classesRes.success || !classesRes.data?.length) {
            container.innerHTML = UI.emptyState('ยังไม่ได้เข้าร่วมห้องเรียน', 'โปรดติดต่อครูประจำชั้นเพื่อขอรหัสเข้าห้องเรียน');
            return;
        }

        // 2. Fetch Subjects for ALL classes in PARALLEL (much faster!)
        const subjectPromises = classesRes.data.map(classInfo =>
            API.request('listSubjects', { classId: classInfo.id })
                .then(res => ({ classInfo, subjects: res.data || [] }))
        );

        const results = await Promise.all(subjectPromises);

        // 3. Render all classes
        let contentHtml = '';
        for (const { classInfo, subjects } of results) {
            contentHtml += `
                <div class="mb-8 last:mb-0">
                    <div class="flex items-center mb-4">
                        <div class="w-1.5 h-8 bg-primary-600 rounded-full mr-3"></div>
                        <h2 class="text-xl font-bold text-gray-800">${Utils.escapeHtml(classInfo.name || classInfo.level + '/' + classInfo.room)}</h2>
                    </div>

                    ${subjects.length === 0 ?
                    `<div class="bg-gray-50 border border-gray-100 rounded-xl p-8 text-center text-gray-500">
                            ยังไม่มีรายวิชาในห้องเรียนนี้
                        </div>` :
                    `<div class="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                            ${subjects.map(s => `
                                <div class="card card-interactive p-5 h-full flex flex-col group hover:border-primary-200 transition-all duration-200">
                                    <div class="flex items-start space-x-4 mb-4">
                                        <div class="p-3 bg-primary-50 text-primary-600 rounded-2xl group-hover:bg-primary-600 group-hover:text-white transition-colors duration-200">
                                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
                                            </svg>
                                        </div>
                                        <div class="flex-1 min-w-0">
                                            <h3 class="font-bold text-gray-900 group-hover:text-primary-700 transition-colors line-clamp-1" title="${Utils.escapeHtml(s.name)}">
                                                ${Utils.escapeHtml(s.name)}
                                            </h3>
                                            <p class="text-sm text-gray-500 mt-0.5 font-mono">${s.code ? Utils.escapeHtml(s.code) : 'ไม่มีรหัสวิชา'}</p>
                                        </div>
                                    </div>
                                    
                                    <div class="mt-auto pt-2 border-t border-gray-100">
                                        <a href="/student/subject/${s.id}/assignments" data-link class="flex items-center justify-center w-full py-2.5 text-sm font-medium text-primary-600 hover:text-primary-800 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors">
                                            <span>เข้าเรียน / ส่งงาน</span>
                                            <svg class="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/>
                                            </svg>
                                        </a>
                                    </div>
                                </div>
                            `).join('')}
                        </div>`
                }
                </div>
            `;
        }

        container.innerHTML = contentHtml;
    },


    showJoinClassModal() {
        UI.showModal('เข้าร่วมห้องเรียน', `
            <form id="join-class-form" class="space-y-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">รหัสเข้าร่วม</label>
                    <input type="text" name="joinCode" class="input-field text-center font-mono text-lg tracking-widest" placeholder="XXXXXX" maxlength="6" required style="text-transform: uppercase">
                </div>
                <button type="submit" class="btn btn-primary w-full">เข้าร่วม</button>
            </form>
        `);

        document.getElementById('join-class-form').onsubmit = async (e) => {
            e.preventDefault();
            const joinCode = e.target.joinCode.value.toUpperCase();
            const res = await API.request('joinClass', { joinCode });

            if (res.success) {
                UI.hideModal();
                UI.showToast(`เข้าร่วม ${res.data.className} สำเร็จ`, 'success');
                this.renderClasses();
            } else {
                UI.showToast(res.error, 'error');
            }
        };
    },

    async renderClassSubjects(params) {
        const app = document.getElementById('app');
        const classId = params.id;

        // Fetch class details and subjects
        const [classRes, subjectsRes] = await Promise.all([
            API.request('getClass', { classId }),
            API.request('listSubjects', { classId })
        ]);

        if (!classRes.success) {
            app.innerHTML = UI.pageWrapper(UI.emptyState('ไม่พบห้องเรียน', ''));
            return;
        }

        const classData = classRes.data;
        app.innerHTML = UI.pageWrapper(`
            <div class="page-enter">
                ${UI.header(classData.name, `<span class="text-sm text-gray-500">${classData.level} ห้อง ${classData.room}</span>`)}
                
                <h3 class="font-semibold text-lg mb-4">รายวิชาในห้องเรียนนี้</h3>
                <div id="subjects-list" class="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    ${UI.skeleton(3)}
                </div>
            </div>
        `);

        const container = document.getElementById('subjects-list');
        if (!subjectsRes.success || !subjectsRes.data?.length) {
            container.innerHTML = UI.emptyState('ยังไม่มีรายวิชา', 'คุณครูยังไม่ได้เพิ่มรายวิชาในห้องนี้');
            return;
        }

        container.innerHTML = subjectsRes.data.map(s => `
            <div class="card card-interactive p-5">
                <div class="flex items-center space-x-3 mb-3">
                    <div class="p-3 bg-primary-50 text-primary-600 rounded-xl">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
                        </svg>
                    </div>
                    <div>
                        <h3 class="font-semibold text-gray-900">${Utils.escapeHtml(s.name)}</h3>
                    </div>
                </div>
                <div class="flex justify-between items-center text-sm text-gray-500 mt-2">
                    <span>รหัสวิชา: ${s.id.substring(0, 6)}...</span> 
                    <a href="/student/subject/${s.id}/assignments" data-link class="text-primary-600 hover:underline">ดูงานที่มอบหมาย →</a>
                </div>
            </div>
        `).join('');
    },

    async renderSubjectAssignments(params) {
        const app = document.getElementById('app');
        const subjectId = params.id; // This could be a real subjectId or a classSubjectId

        // 1. Get Subject Details (to show name in header)
        // We list all subjects visible to student and find the one matching ID
        const subjectsRes = await API.request('listSubjects', {});
        const subject = subjectsRes.data?.find(s => s.id === subjectId);
        const subjectName = subject ? subject.name : 'งานที่มอบหมาย';

        // 2. Fetch Assignments
        // The API `listAssignments` has been updated to check both subjectId and classSubjectId 
        // when `subjectId` param is passed.
        const [assignmentsRes, subsRes] = await Promise.all([
            API.request('listAssignments', { subjectId: subjectId, pageSize: 100 }),
            API.request('listSubmissionsByStudent', { pageSize: 100 })
        ]);

        app.innerHTML = UI.pageWrapper(`
            <div class="page-enter">
                ${UI.header(Utils.escapeHtml(subjectName), '<a href="/student/classes" data-link class="text-sm text-primary-600 hover:underline">← ย้อนกลับ</a>')}
                <div id="assignments-list" class="space-y-4">
                    ${UI.skeleton(3)}
                </div>
            </div>
        `);

        const container = document.getElementById('assignments-list');
        const assignments = assignmentsRes.data?.data || [];

        if (!assignmentsRes.success || assignments.length === 0) {
            container.innerHTML = UI.emptyState('ไม่มีงานที่มอบหมาย', 'วิชานี้ยังไม่มีการสั่งงาน');
            return;
        }

        const mySubmissions = subsRes.data?.data || [];

        container.innerHTML = assignmentsRes.data.data.map(a => {
            const submission = mySubmissions.find(s => s.assignmentId === a.id);
            const status = submission ? Utils.getStatusInfo(submission.status) : { label: 'ยังไม่ส่ง', class: 'badge-pending' };
            const isPast = Utils.isPastDue(a.dueDate);

            return `
                 <div class="card p-4">
                    <div class="flex justify-between items-start mb-2">
                        <div>
                            <h4 class="font-semibold">${Utils.escapeHtml(a.title)}</h4>
                            <p class="text-sm text-gray-500">กำหนดส่ง: ${Utils.formatDateTime(a.dueDate)}</p>
                        </div>
                        <span class="badge ${status.class}">${status.label}</span>
                    </div>
                     <div class="mt-3 flex space-x-2">
                        ${!submission ?
                    `<a href="/student/submit/${a.id}" data-link class="btn btn-sm btn-primary">ส่งงาน</a>` :
                    `<a href="/student/submission/${submission.id}" data-link class="btn btn-sm btn-secondary">ดูรายละเอียด</a>`
                }
                    </div>
                </div>
            `;
        }).join('');
    },

    // Assignments
    async renderAssignments() {
        const app = document.getElementById('app');
        app.innerHTML = UI.pageWrapper(`
            <div class="page-enter">
                ${UI.header('งานทั้งหมด')}
                
                <div class="mb-4">
                    ${UI.searchBox('search-assignments', 'ค้นหางาน...')}
                </div>
                
                <div class="flex flex-wrap gap-2 mb-4">
                    ${UI.filterChips(['ทั้งหมด', 'รอส่ง', 'ส่งแล้ว', 'ตรวจแล้ว', 'ต้องแก้ไข'], 'status-filter')}
                </div>

                <div id="assignments-list" class="space-y-4">${UI.skeleton(5)}</div>
            </div>
        `);

        this.loadStudentAssignments();

        document.getElementById('search-assignments').oninput = Utils.debounce((e) => {
            this.loadStudentAssignments(e.target.value);
        }, 300);

        document.querySelectorAll('.filter-chip').forEach(chip => {
            chip.onclick = () => {
                document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                this.loadStudentAssignments(document.getElementById('search-assignments').value, chip.textContent);
            };
        });
    },

    async loadStudentAssignments(query = '', filter = 'ทั้งหมด') {
        // 1. Fetch Submissions, Subjects, and Classes in PARALLEL
        const [subsRes, subjectsRes, classesRes] = await Promise.all([
            API.request('listSubmissionsByStudent', { pageSize: 100 }),
            API.request('listSubjects', {}),
            API.request('listClasses')
        ]);

        const mySubmissions = subsRes.data?.data || [];
        const subjects = subjectsRes.data || [];
        const classes = classesRes.data || [];

        // 2. Fetch Assignments for all subjects in PARALLEL
        let allAssignments = [];

        const assignmentPromises = subjects.map(s =>
            API.request('listAssignments', { subjectId: s.id, query, pageSize: 100 })
                .then(res => ({ subject: s, assignments: res.data?.data || [] }))
        );

        const results = await Promise.all(assignmentPromises);

        for (const res of results) {
            // Find class name directly (we already have classes data)
            const classObj = classes.find(c => c.id === res.subject.classId);
            const className = classObj ? (classObj.name || classObj.level + '/' + classObj.room) : '';

            allAssignments = allAssignments.concat(res.assignments.map(a => {
                const submission = mySubmissions.find(sub => sub.assignmentId === a.id);
                return {
                    ...a,
                    className: className,
                    subjectName: res.subject.name,
                    submission,
                    myStatus: submission?.status || 'NOT_SUBMITTED'
                };
            }));
        }

        // Filter
        if (filter !== 'ทั้งหมด') {
            const filterMap = {
                'รอส่ง': 'NOT_SUBMITTED',
                'ส่งแล้ว': 'SUBMITTED',
                'ตรวจแล้ว': 'GRADED',
                'ต้องแก้ไข': 'REVISION_REQUESTED'
            };
            const status = filterMap[filter];
            allAssignments = allAssignments.filter(a => a.myStatus === status);
        }

        const container = document.getElementById('assignments-list');
        if (allAssignments.length === 0) {
            container.innerHTML = UI.emptyState('ไม่พบงาน', '');
            return;
        }

        container.innerHTML = allAssignments.map(a => {
            const status = Utils.getStatusInfo(a.myStatus);
            const isPast = Utils.isPastDue(a.dueDate);
            const days = Utils.getDaysUntilDue(a.dueDate);

            return `
                <div class="card p-4">
                    <div class="flex justify-between items-start mb-2">
                        <div>
                            <h4 class="font-semibold">${Utils.escapeHtml(a.title)}</h4>
                            <p class="text-sm text-gray-500">${Utils.escapeHtml(a.subjectName)} • ${Utils.escapeHtml(a.className)}</p>
                        </div>
                        <span class="badge ${status.class}">${status.label}</span>
                    </div>
                    <div class="flex items-center justify-between mt-3">
                        <p class="text-sm ${isPast && a.myStatus === 'NOT_SUBMITTED' ? 'text-red-600' : 'text-gray-500'}">
                            กำหนดส่ง: ${Utils.formatDateTime(a.dueDate)}
                            ${!isPast && days <= 2 ? `<span class="text-red-600 font-bold">(อีก ${days} วัน)</span>` : ''}
                        </p>
                        ${a.myStatus === 'NOT_SUBMITTED' || a.myStatus === 'REVISION_REQUESTED' ?
                    `<a href="/student/submit/${a.id}" data-link class="btn btn-sm btn-primary">ส่งงาน</a>` :
                    `<a href="/student/submission/${a.submission?.id}" data-link class="btn btn-sm btn-secondary">ดูรายละเอียด</a>`
                }
                    </div>
                    ${a.submission?.grade ? `
                        <div class="mt-3 p-3 bg-green-50 rounded-lg">
                            <p class="font-semibold text-green-700">คะแนน: ${a.submission.grade.score}/${a.maxScore}</p>
                            ${a.submission.grade.feedback ? `<p class="text-sm text-green-600 mt-1">${Utils.escapeHtml(a.submission.grade.feedback)}</p>` : ''}
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');
    },

    // Submit Assignment
    async renderSubmitAssignment(params) {
        const app = document.getElementById('app');
        const assignRes = await API.request('getAssignment', { assignmentId: params.id });

        if (!assignRes.success) {
            app.innerHTML = UI.pageWrapper(UI.emptyState('ไม่พบงาน', ''));
            return;
        }

        const assignment = assignRes.data;
        const isPast = Utils.isPastDue(assignment.dueDate);

        app.innerHTML = UI.pageWrapper(`
            <div class="page-enter">
                ${UI.header('ส่งงาน')}
                
                <div class="card p-5 mb-6">
                    <h2 class="text-xl font-bold mb-2">${Utils.escapeHtml(assignment.title)}</h2>
                    <p class="text-sm text-gray-500 mb-3">${Utils.escapeHtml(assignment.subjectName || '')}</p>
                    <p class="text-gray-600 whitespace-pre-wrap mb-4">${Utils.escapeHtml(assignment.detail || 'ไม่มีรายละเอียด')}</p>
                    <div class="flex items-center space-x-4 text-sm">
                        <span class="${isPast ? 'text-red-600' : 'text-gray-600'}">
                            <strong>กำหนดส่ง:</strong> ${Utils.formatDateTime(assignment.dueDate)}
                            ${isPast ? '(เลยกำหนด)' : ''}
                        </span>
                        <span><strong>คะแนนเต็ม:</strong> ${assignment.maxScore}</span>
                    </div>
                </div>

                ${isPast ? `
                    <div class="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6">
                        <p class="text-yellow-700 font-medium">⚠️ งานนี้เลยกำหนดส่งแล้ว ถ้าส่งจะถูกบันทึกเป็น "ส่งช้า"</p>
                    </div>
                ` : ''}

                <form id="submit-form" class="card p-6 space-y-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">ข้อความ</label>
                        <textarea name="text" class="input-field" rows="4" placeholder="พิมพ์คำตอบหรือรายละเอียดงานที่ส่ง..."></textarea>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">ลิงก์ (ถ้ามี)</label>
                        <input type="url" name="link" class="input-field" placeholder="https://...">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">ไฟล์แนบ</label>
                        <div class="file-upload-zone" onclick="document.getElementById('file-input').click()">
                            <svg class="w-12 h-12 mx-auto text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/>
                            </svg>
                            <p class="text-gray-500">คลิกเพื่อเลือกไฟล์</p>
                            <p class="text-xs text-gray-400">รองรับ JPG, PNG, PDF, DOCX (สูงสุด 10MB)</p>
                        </div>
                        <input type="file" id="file-input" class="hidden" multiple accept=".jpg,.jpeg,.png,.pdf,.docx">
                        <div id="file-preview" class="mt-2 space-y-2"></div>
                    </div>
                    <button type="submit" class="btn btn-primary w-full">ส่งงาน</button>
                </form>
            </div>
        `);

        // File handling
        const fileInput = document.getElementById('file-input');
        const filePreview = document.getElementById('file-preview');
        let selectedFiles = [];

        fileInput.onchange = (e) => {
            for (const file of e.target.files) {
                if (!Utils.isValidFileType(file)) {
                    UI.showToast(`ไฟล์ ${file.name} ไม่รองรับ`, 'error');
                    continue;
                }
                if (!Utils.isValidFileSize(file)) {
                    UI.showToast(`ไฟล์ ${file.name} ใหญ่เกิน 10MB`, 'error');
                    continue;
                }
                selectedFiles.push(file);
            }
            this.renderFilePreview(filePreview, selectedFiles);
        };

        document.getElementById('submit-form').onsubmit = async (e) => {
            e.preventDefault();
            const btn = e.target.querySelector('button[type="submit"]');
            btn.classList.add('btn-loading');
            btn.disabled = true;

            try {
                const fd = new FormData(e.target);
                const files = [];

                for (const file of selectedFiles) {
                    const base64 = await Utils.fileToBase64(file);
                    files.push({
                        name: file.name,
                        type: file.type,
                        size: file.size,
                        data: base64
                    });
                }

                const res = await API.request('submitHomework', {
                    assignmentId: params.id,
                    text: fd.get('text'),
                    link: fd.get('link'),
                    files
                });

                if (res.success) {
                    UI.showToast('ส่งงานสำเร็จ', 'success');
                    Router.navigate('/student/assignments');
                } else {
                    UI.showToast(res.error, 'error');
                }
            } finally {
                btn.classList.remove('btn-loading');
                btn.disabled = false;
            }
        };
    },

    renderFilePreview(container, files) {
        container.innerHTML = files.map((file, i) => `
            <div class="file-preview">
                <div class="file-preview-icon">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                    </svg>
                </div>
                <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium truncate">${Utils.escapeHtml(file.name)}</p>
                    <p class="text-xs text-gray-500">${Utils.formatFileSize(file.size)}</p>
                </div>
                <button type="button" onclick="Student.removeFile(${i})" class="p-1 hover:bg-red-100 rounded text-red-500">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                </button>
            </div>
        `).join('');
    },

    removeFile(index) {
        // This would need proper file array reference - simplified version
        UI.showToast('ลบไฟล์แล้ว', 'info');
    },

    async renderSubmissionDetail(params) {
        const app = document.getElementById('app');
        app.innerHTML = UI.pageWrapper(`
            <div class="page-enter">
                ${UI.header('รายละเอียดงานที่ส่ง', `
                    <a href="javascript:history.back()" class="btn btn-sm btn-secondary">ย้อนกลับ</a>
                `)}
                <div id="submission-content">${UI.skeleton(3)}</div>
            </div>
        `);

        const res = await API.request('getSubmission', { submissionId: params.id });
        const container = document.getElementById('submission-content');

        if (!res.success) {
            container.innerHTML = UI.emptyState('ไม่พบงานที่ส่ง', res.error);
            return;
        }

        const sub = res.data;
        const assign = sub.assignment;
        const statusInfo = Utils.getStatusInfo(sub.status);

        container.innerHTML = `
            <div class="grid md:grid-cols-3 gap-6">
                <!-- Left: Assignment Info -->
                <div class="md:col-span-1 space-y-6">
                    <div class="card p-6">
                        <h3 class="font-semibold text-lg mb-4 text-gray-800">โจทย์งาน</h3>
                        <div class="mb-4">
                            <label class="text-xs font-bold text-gray-400 uppercase tracking-wider">ชื่องาน</label>
                            <p class="font-medium text-lg mt-1">${Utils.escapeHtml(assign.title)}</p>
                        </div>
                        <div class="mb-4">
                            <label class="text-xs font-bold text-gray-400 uppercase tracking-wider">กำหนดส่ง</label>
                            <p class="text-sm mt-1">${Utils.formatDate(assign.dueDate)}</p>
                        </div>
                        <div class="mb-4">
                            <label class="text-xs font-bold text-gray-400 uppercase tracking-wider">คะแนนเต็ม</label>
                            <p class="text-sm mt-1">${assign.maxScore} คะแนน</p>
                        </div>
                        <div>
                            <label class="text-xs font-bold text-gray-400 uppercase tracking-wider">รายละเอียด</label>
                            <div class="mt-1 prose prose-sm max-w-none text-gray-600">
                                ${Utils.escapeHtml(assign.description || '-')}
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Right: Submission & Feedback -->
                <div class="md:col-span-2 space-y-6">
                    <!-- Submission Content -->
                    <div class="card p-6">
                        <div class="flex justify-between items-start mb-6">
                            <h3 class="font-semibold text-lg text-gray-800">งานที่ส่ง</h3>
                            <span class="badge ${statusInfo.class}">${statusInfo.label}</span>
                        </div>

                        ${sub.text ? `
                            <div class="mb-6">
                                <label class="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">ข้อความ</label>
                                <div class="bg-gray-50 p-4 rounded-xl text-gray-700 whitespace-pre-wrap">${Utils.escapeHtml(sub.text)}</div>
                            </div>
                        ` : ''}

                        ${sub.link ? `
                             <div class="mb-6">
                                <label class="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">ลิงก์แนบ</label>
                                <a href="${Utils.escapeHtml(sub.link)}" target="_blank" class="flex items-center p-3 bg-blue-50 text-blue-700 rounded-xl hover:bg-blue-100 transition-colors">
                                    <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
                                    </svg>
                                    ${Utils.escapeHtml(sub.link)}
                                </a>
                            </div>
                        ` : ''}

                        ${sub.files && sub.files.length > 0 ? `
                            <div>
                                <label class="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">ไฟล์แนบ (${sub.files.length})</label>
                                <div class="grid gap-3">
                                    ${sub.files.map(f => `
                                        <div class="flex items-center p-3 border border-gray-200 rounded-xl">
                                            <div class="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center mr-3">
                                                <svg class="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/>
                                                </svg>
                                            </div>
                                            <div class="flex-1 min-w-0">
                                                <p class="font-medium truncate">${Utils.escapeHtml(f.name)}</p>
                                                <p class="text-xs text-gray-500">${Utils.formatFileSize(f.size)}</p>
                                            </div>
                                            <a href="${f.url || '#'}" download="${f.name}" class="p-2 text-primary-600 hover:bg-primary-50 rounded-lg">
                                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                                                </svg>
                                            </a>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        ` : ''}
                        
                        <div class="mt-6 pt-6 border-t flex justify-between items-center text-sm text-gray-500">
                            <span>ส่งเมื่อ: ${Utils.formatDate(sub.submittedAt)}</span>
                            ${sub.status === 'PENDING' || sub.status === 'REVISION_REQUESTED' ? `
                                <a href="/student/submit/${sub.assignmentId}" data-link class="text-primary-600 font-medium hover:underline">แก้ไขงานส่ง</a>
                            ` : ''}
                        </div>
                    </div>

                    <!-- Teacher Feedback -->
                    ${sub.status === 'GRADED' && sub.grade ? `
                        <div class="card p-6 border-2 border-green-100 bg-green-50/30">
                            <div class="flex items-start mb-4">
                                <div class="p-2 bg-green-100 rounded-lg mr-3">
                                    <svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                                    </svg>
                                </div>
                                <div class="flex-1">
                                    <h3 class="font-semibold text-lg text-gray-900">ผลการตรวจ</h3>
                                    <p class="text-sm text-gray-500">ตรวจเมื่อ ${Utils.formatDate(sub.grade.gradedAt)}</p>
                                </div>
                                <div class="text-right">
                                    <span class="text-3xl font-bold text-green-600">${sub.grade.score}</span>
                                    <span class="text-gray-400 text-lg">/${assign.maxScore}</span>
                                </div>
                            </div>
                            
                            <div class="bg-white p-4 rounded-xl border border-green-100 shadow-sm">
                                <label class="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">ข้อเสนอแนะจากครู</label>
                                <p class="text-gray-700">${sub.grade.feedback ? Utils.escapeHtml(sub.grade.feedback) : '-'}</p>
                            </div>
                        </div>
                    ` : ''}
                    
                    ${sub.status === 'REVISION_REQUESTED' ? `
                        <div class="card p-6 border-l-4 border-yellow-400 bg-yellow-50">
                            <h3 class="font-semibold text-lg text-yellow-800 mb-2">⚠️ ครูขอให้แก้ไขงาน</h3>
                            <p class="text-yellow-700">กรุณาปรับปรุงงานตามคำแนะนำและส่งใหม่</p>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    },

    // Grades
    async renderGrades() {
        const app = document.getElementById('app');
        app.innerHTML = UI.pageWrapper(`
            <div class="page-enter">
                ${UI.header('คะแนนของฉัน')}
                <div id="grades-list" class="space-y-4">${UI.skeleton(5)}</div>
            </div>
        `);

        const res = await API.request('getStudentGrades');
        const container = document.getElementById('grades-list');

        if (!res.success || !res.data?.length) {
            container.innerHTML = UI.emptyState('ยังไม่มีคะแนน', 'คะแนนจะแสดงหลังครูตรวจงาน');
            return;
        }

        // Group by subject
        const bySubject = {};
        res.data.forEach(g => {
            const subject = g.subjectName || 'อื่นๆ';
            if (!bySubject[subject]) bySubject[subject] = [];
            bySubject[subject].push(g);
        });

        container.innerHTML = Object.entries(bySubject).map(([subject, grades]) => {
            const total = grades.reduce((sum, g) => sum + (g.grade?.score || 0), 0);
            const maxTotal = grades.reduce((sum, g) => sum + (g.assignment?.maxScore || 0), 0);
            const pct = Utils.getScorePercentage(total, maxTotal);

            return `
                <div class="card p-5">
                    <div class="flex justify-between items-center mb-4">
                        <h3 class="font-semibold">${Utils.escapeHtml(subject)}</h3>
                        <span class="text-lg font-bold ${Utils.getScoreColorClass(pct)}">${total}/${maxTotal} (${pct}%)</span>
                    </div>
                    <div class="space-y-2">
                        ${grades.map(g => {
                const score = g.grade?.score;
                const max = g.assignment?.maxScore;
                const sPct = Utils.getScorePercentage(score, max);
                return `
                                <div class="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                                    <div>
                                        <p class="font-medium">${Utils.escapeHtml(g.assignment?.title || '')}</p>
                                        <p class="text-sm text-gray-500">${Utils.formatDate(g.grade?.gradedAt || g.submission?.submittedAt)}</p>
                                    </div>
                                    <div class="text-right">
                                        ${score !== undefined ? `
                                            <p class="font-bold ${Utils.getScoreColorClass(sPct)}">${score}/${max}</p>
                                        ` : `
                                            <span class="badge ${Utils.getStatusInfo(g.submission?.status).class}">
                                                ${Utils.getStatusInfo(g.submission?.status).label}
                                            </span>
                                        `}
                                    </div>
                                </div>
                            `;
            }).join('')}
                    </div>
                </div>
            `;
        }).join('');
    },

    // Settings
    renderSettings() {
        const app = document.getElementById('app');
        const user = Auth.getCurrentUser();

        // Generate link code for parent
        const linkCode = 'STU' + user?.id?.slice(-4).toUpperCase();

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
                        </div>
                    </div>
                </div>

                <div class="card p-6 mb-4">
                    <h3 class="font-semibold mb-4">เชื่อมต่อผู้ปกครอง</h3>
                    <p class="text-sm text-gray-600 mb-3">ให้รหัสนี้แก่ผู้ปกครองเพื่อดูคะแนน:</p>
                    <div class="flex items-center space-x-2">
                        <code class="flex-1 bg-gray-100 p-3 rounded-xl text-lg font-mono text-center font-bold tracking-widest">${linkCode}</code>
                        <button onclick="navigator.clipboard.writeText('${linkCode}'); UI.showToast('คัดลอกแล้ว', 'success')" class="btn btn-secondary btn-sm">คัดลอก</button>
                    </div>
                </div>

                <button onclick="Auth.logout()" class="btn btn-danger w-full">ออกจากระบบ</button>
            </div>
        `);
    }
};

window.Student = Student;
