/**
 * Main App - Initialize and Route Registration
 */
const App = {
    init() {
        // Wait for DOM
        document.addEventListener('DOMContentLoaded', () => {
            try {
                this.registerRoutes();
                this.initUI();
                Router.init();
            } catch (e) {
                console.error('Initialization Error:', e);
                UI.showToast('เกิดข้อผิดพลาดในการโหลดระบบ: ' + e.message, 'error');
            } finally {
                UI.hideLoading();
            }
        });
    },

    registerRoutes() {
        // Public routes
        Router.register('/', () => this.renderLanding());
        Router.register('/login', () => this.renderLogin());
        Router.register('/register', () => this.renderRegister());

        // Teacher routes
        Router.register('/teacher', () => Teacher.renderDashboard(), { requireAuth: true, roles: ['teacher'] });
        Router.register('/teacher/classes', () => Teacher.renderClasses(), { requireAuth: true, roles: ['teacher'] });
        Router.register('/teacher/class/:id', (p) => Teacher.renderClassDetail(p), { requireAuth: true, roles: ['teacher'] });
        Router.register('/teacher/class/:id/subjects', (p) => Teacher.renderSubjects(p), { requireAuth: true, roles: ['teacher'] });
        Router.register('/teacher/subject/:id/assignments', (p) => Teacher.renderSubjectAssignments(p), { requireAuth: true, roles: ['teacher'] });
        Router.register('/teacher/assignments', () => Teacher.renderAssignments(), { requireAuth: true, roles: ['teacher'] });
        Router.register('/teacher/assignment/:id', (p) => Teacher.renderAssignmentDetail(p), { requireAuth: true, roles: ['teacher'] });
        Router.register('/teacher/assignment/:id/submissions', (p) => Teacher.renderSubmissions(p), { requireAuth: true, roles: ['teacher'] });
        Router.register('/teacher/grade/:id', (p) => Teacher.renderGradeSubmission(p), { requireAuth: true, roles: ['teacher'] });
        Router.register('/teacher/gradebook', () => Teacher.renderGradebook(), { requireAuth: true, roles: ['teacher'] });
        Router.register('/teacher/my-subjects', () => Teacher.renderMySubjects(), { requireAuth: true, roles: ['teacher'] });
        Router.register('/teacher/my-subject/:id', (p) => Teacher.renderMySubjectDetail(p), { requireAuth: true, roles: ['teacher'] });
        Router.register('/teacher/settings', () => Teacher.renderSettings(), { requireAuth: true, roles: ['teacher'] });


        // Student routes
        Router.register('/student', () => Student.renderDashboard(), { requireAuth: true, roles: ['student'] });
        Router.register('/student/classes', () => Student.renderClasses(), { requireAuth: true, roles: ['student'] });
        Router.register('/student/class/:id', (p) => Student.renderClassSubjects(p), { requireAuth: true, roles: ['student'] });
        Router.register('/student/subject/:id/assignments', (p) => Student.renderSubjectAssignments(p), { requireAuth: true, roles: ['student'] });
        Router.register('/student/assignments', () => Student.renderAssignments(), { requireAuth: true, roles: ['student'] });
        Router.register('/student/submit/:id', (p) => Student.renderSubmitAssignment(p), { requireAuth: true, roles: ['student'] });
        Router.register('/student/submission/:id', (p) => Student.renderSubmissionDetail(p), { requireAuth: true, roles: ['student'] });
        Router.register('/student/grades', () => Student.renderGrades(), { requireAuth: true, roles: ['student'] });
        Router.register('/student/settings', () => Student.renderSettings(), { requireAuth: true, roles: ['student'] });

        // Parent routes
        Router.register('/parent', () => Parent.renderDashboard(), { requireAuth: true, roles: ['parent'] });
        Router.register('/parent/children', () => Parent.renderChildren(), { requireAuth: true, roles: ['parent'] });
        Router.register('/parent/child/:id', (p) => Parent.renderChildGrades(p), { requireAuth: true, roles: ['parent'] });
        Router.register('/parent/grades', () => Parent.renderGrades(), { requireAuth: true, roles: ['parent'] });
        Router.register('/parent/settings', () => Parent.renderSettings(), { requireAuth: true, roles: ['parent'] });

        // Admin routes
        Router.register('/admin', () => Admin.renderDashboard(), { requireAuth: true, roles: ['admin'] });
        Router.register('/admin/classes', () => Admin.renderClassManagement(), { requireAuth: true, roles: ['admin'] });
        Router.register('/admin/users', () => Admin.renderUsers(), { requireAuth: true, roles: ['admin'] });
        Router.register('/admin/subjects', () => Admin.renderSubjectCatalog(), { requireAuth: true, roles: ['admin'] });
        Router.register('/admin/class-subjects', () => Admin.renderClassSubjects(), { requireAuth: true, roles: ['admin'] });
        Router.register('/admin/logs', () => Admin.renderLogs(), { requireAuth: true, roles: ['admin'] });
        Router.register('/admin/settings', () => Admin.renderSettings(), { requireAuth: true, roles: ['admin'] });

        // 404
        Router.register('/404', () => Router.show404());
    },

    initUI() {
        // Initialize Store & Demo Data
        Store.initDemoData();
    },

    renderLanding() {
        // If already logged in, redirect to dashboard
        if (Auth.isAuthenticated()) {
            Router.navigateByRole(Auth.getCurrentRole());
            return;
        }

        const app = document.getElementById('app');
        app.innerHTML = `
            <div class="min-h-screen bg-gradient-to-br from-primary-600 via-primary-700 to-primary-800">
                <!-- Hero Section -->
                <div class="container mx-auto px-4 py-12 md:py-20">
                    <div class="text-center mb-12">
                        <div class="inline-flex items-center justify-center w-20 h-20 bg-white rounded-2xl shadow-xl mb-6">
                            <svg class="w-12 h-12 text-primary-600" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838l-2.727 1.17 1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zM9.3 16.573A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0z"/>
                            </svg>
                        </div>
                        <h1 class="text-4xl md:text-5xl font-bold text-white mb-4">
                            ระบบตรวจงาน<br>พร้อมให้คะแนนออนไลน์
                        </h1>
                        <p class="text-xl text-primary-100 max-w-2xl mx-auto">
                            ระบบจัดการงานมอบหมาย ตรวจงาน และให้คะแนน<br>
                            สำหรับครู นักเรียน และผู้ปกครอง
                        </p>
                    </div>

                    <!-- Features -->
                    <div class="grid md:grid-cols-3 gap-6 mb-12 max-w-4xl mx-auto">
                        <div class="bg-white/10 backdrop-blur-sm rounded-2xl p-6 text-center">
                            <div class="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center mx-auto mb-4">
                                <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/>
                                </svg>
                            </div>
                            <h3 class="text-lg font-semibold text-white mb-2">ส่งงานง่าย</h3>
                            <p class="text-primary-100 text-sm">นักเรียนส่งงานได้ทุกที่ทุกเวลา รองรับไฟล์หลายรูปแบบ</p>
                        </div>
                        <div class="bg-white/10 backdrop-blur-sm rounded-2xl p-6 text-center">
                            <div class="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center mx-auto mb-4">
                                <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
                                </svg>
                            </div>
                            <h3 class="text-lg font-semibold text-white mb-2">ดูคะแนนละเอียด</h3>
                            <p class="text-primary-100 text-sm">ติดตามคะแนนทุกงาน พร้อม feedback จากครู</p>
                        </div>
                        <div class="bg-white/10 backdrop-blur-sm rounded-2xl p-6 text-center">
                            <div class="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center mx-auto mb-4">
                                <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"/>
                                </svg>
                            </div>
                            <h3 class="text-lg font-semibold text-white mb-2">ใช้งานมือถือ</h3>
                            <p class="text-primary-100 text-sm">ติดตั้งเหมือนแอป ใช้งานได้ทั้ง Android และ iOS</p>
                        </div>
                    </div>

                    <!-- CTA -->
                    <div class="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <a href="/login" data-link class="btn bg-white text-primary-700 hover:bg-gray-100 px-8 py-4 text-lg shadow-xl">
                            เข้าสู่ระบบ
                        </a>
                        <a href="/register" data-link class="btn border-2 border-white text-white hover:bg-white/10 px-8 py-4 text-lg">
                            สมัครสมาชิก
                        </a>
                    </div>


                    <!-- Demo Accounts Removed -->

                </div>
            </div>
        `;
    },

    renderLogin() {
        if (Auth.isAuthenticated()) {
            Router.navigateByRole(Auth.getCurrentRole());
            return;
        }

        const app = document.getElementById('app');
        app.innerHTML = `
            <div class="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
                <div class="w-full max-w-md">
                    <div class="text-center mb-8">
                        <a href="/" data-link class="inline-flex items-center justify-center w-16 h-16 bg-primary-600 rounded-2xl mb-4">
                            <svg class="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838l-2.727 1.17 1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zM9.3 16.573A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0z"/>
                            </svg>
                        </a>
                        <h1 class="text-2xl font-bold text-gray-900">เข้าสู่ระบบ</h1>
                        <p class="text-gray-500 mt-2">ระบบตรวจงานพร้อมให้คะแนนออนไลน์</p>
                    </div>

                    <div class="card p-8">
                        <form id="login-form" class="space-y-4">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">อีเมล</label>
                                <input type="email" name="email" class="input-field" placeholder="example@email.com" required>
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">รหัสผ่าน</label>
                                <input type="password" name="password" class="input-field" placeholder="••••••••" required>
                            </div>
                            <button type="submit" class="btn btn-primary w-full">เข้าสู่ระบบ</button>
                        </form>

                        <div class="mt-6 text-center">
                            <p class="text-gray-500">ยังไม่มีบัญชี? <a href="/register" data-link class="text-primary-600 font-medium hover:underline">สมัครสมาชิก</a></p>
                        </div>
                    </div>

                    <div class="mt-6 text-center">
                        <p class="text-sm text-gray-400">โหมด: ${Store.getMode() === 'demo' ? 'ทดลอง (Demo)' : 'API จริง'}</p>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('login-form').onsubmit = async (e) => {
            e.preventDefault();
            const btn = e.target.querySelector('button[type="submit"]');
            btn.classList.add('btn-loading');
            btn.disabled = true;

            try {
                const email = e.target.email.value;
                const password = e.target.password.value;
                await Auth.login(email, password);
            } finally {
                btn.classList.remove('btn-loading');
                btn.disabled = false;
            }
        };
    },

    renderRegister() {
        if (Auth.isAuthenticated()) {
            Router.navigateByRole(Auth.getCurrentRole());
            return;
        }

        const app = document.getElementById('app');
        app.innerHTML = `
            <div class="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
                <div class="w-full max-w-md">
                    <div class="text-center mb-8">
                        <a href="/" data-link class="inline-flex items-center justify-center w-16 h-16 bg-primary-600 rounded-2xl mb-4">
                            <svg class="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838l-2.727 1.17 1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zM9.3 16.573A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0z"/>
                            </svg>
                        </a>
                        <h1 class="text-2xl font-bold text-gray-900">สมัครสมาชิก</h1>
                        <p class="text-gray-500 mt-2">สร้างบัญชีใหม่เพื่อเริ่มใช้งาน</p>
                    </div>

                    <div class="card p-8">
                        <form id="register-form" class="space-y-4">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">ฉันคือ</label>
                                <div class="grid grid-cols-3 gap-2">
                                    <label class="flex items-center justify-center p-3 border-2 rounded-xl cursor-pointer has-[:checked]:border-primary-600 has-[:checked]:bg-primary-50">
                                        <input type="radio" name="role" value="teacher" class="hidden" id="role-teacher">
                                        <span class="text-sm font-medium">ครู</span>
                                    </label>
                                    <label class="flex items-center justify-center p-3 border-2 rounded-xl cursor-pointer has-[:checked]:border-primary-600 has-[:checked]:bg-primary-50">
                                        <input type="radio" name="role" value="student" class="hidden" checked>
                                        <span class="text-sm font-medium">นักเรียน</span>
                                    </label>
                                    <label class="flex items-center justify-center p-3 border-2 rounded-xl cursor-pointer has-[:checked]:border-primary-600 has-[:checked]:bg-primary-50">
                                        <input type="radio" name="role" value="parent" class="hidden">
                                        <span class="text-sm font-medium">ผู้ปกครอง</span>
                                    </label>
                                </div>
                            </div>
                            
                            <!-- Teacher Subject Selection (hidden by default) -->
                            <div id="teacher-subjects-section" class="hidden">
                                <label class="block text-sm font-medium text-gray-700 mb-1">
                                    เลือกวิชาที่สอน <span class="text-red-500">*</span>
                                </label>
                                <div id="subjects-loading" class="input-field flex items-center justify-center py-3">
                                    <div class="animate-spin w-5 h-5 border-2 border-primary-600 border-t-transparent rounded-full mr-2"></div>
                                    <span class="text-xs text-gray-500">กำลังโหลดรายวิชา...</span>
                                </div>
                                <div id="subjects-container" class="hidden"></div>
                                <p class="text-xs text-gray-500 mt-1">
                                    <span id="selected-count">0</span> วิชาที่เลือก
                                </p>
                            </div>

                            <!-- Student Room Selection -->
                            <div id="student-room-section">
                                <label class="block text-sm font-medium text-gray-700 mb-1">
                                    เลือกห้องเรียน <span class="text-red-500">*</span>
                                </label>
                                <div class="grid grid-cols-2 gap-2">
                                    <select name="level" id="class-level" class="input-field">
                                        <option value="">ชั้น</option>
                                        <optgroup label="ประถมศึกษา">
                                            <option value="ป.1">ป.1</option>
                                            <option value="ป.2">ป.2</option>
                                            <option value="ป.3">ป.3</option>
                                            <option value="ป.4">ป.4</option>
                                            <option value="ป.5">ป.5</option>
                                            <option value="ป.6">ป.6</option>
                                        </optgroup>
                                        <optgroup label="มัธยมศึกษา">
                                            <option value="ม.1">ม.1</option>
                                            <option value="ม.2">ม.2</option>
                                            <option value="ม.3">ม.3</option>
                                            <option value="ม.4">ม.4</option>
                                            <option value="ม.5">ม.5</option>
                                            <option value="ม.6">ม.6</option>
                                        </optgroup>
                                    </select>
                                    <select name="room" id="class-room" class="input-field">
                                        <option value="">ห้อง</option>
                                        <option value="1">1</option>
                                        <option value="2">2</option>
                                        <option value="3">3</option>
                                        <option value="4">4</option>
                                        <option value="5">5</option>
                                    </select>
                                </div>
                                <p class="text-xs text-gray-500 mt-1">เลือกระดับชั้นและห้องเรียน (เช่น ป.5 ห้อง 1)</p>
                            </div>

                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">ชื่อ-นามสกุล</label>
                                <input type="text" name="name" class="input-field" placeholder="ชื่อ นามสกุล" required>
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">อีเมล</label>
                                <input type="email" name="email" class="input-field" placeholder="example@email.com" required>
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">รหัสผ่าน</label>
                                <input type="password" name="password" class="input-field" placeholder="••••••••" minlength="4" required>
                            </div>
                            <button type="submit" class="btn btn-primary w-full">สมัครสมาชิก</button>
                        </form>

                        <div class="mt-6 text-center">
                            <p class="text-gray-500">มีบัญชีแล้ว? <a href="/login" data-link class="text-primary-600 font-medium hover:underline">เข้าสู่ระบบ</a></p>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Teacher subjects state
        let teacherSubjects = [];
        let subjectTemplates = [];



        // Initialize Data
        let allSubjectsData = [];
        let groupedSubjectsData = {};

        const loadSubjectTemplates = async () => {
            const result = await API.request('listSubjectTemplates', {});
            if (result.success) {
                subjectTemplates = result.data.templates;
                allSubjectsData = result.data.templates;
                groupedSubjectsData = result.data.grouped;
                renderMultiSelectUI();
            }
        };

        const renderMultiSelectUI = () => {
            const container = document.getElementById('subjects-container');
            const loading = document.getElementById('subjects-loading');

            // Create Multi-select HTML Structure
            container.innerHTML = `
                <div class="relative group">
                    <div id="multiselect-box" class="input-field min-h-[46px] h-auto flex flex-wrap items-center gap-2 p-2 cursor-text bg-white hover:border-primary-400 focus-within:border-primary-600 focus-within:ring-1 focus-within:ring-primary-600 transition-all">
                        <div id="selected-tags" class="contents"></div>
                        <input type="text" id="subject-search" class="flex-1 bg-transparent border-none outline-none text-sm min-w-[120px] h-8 placeholder-gray-400" placeholder="คลิกเพื่อเลือกหรือพิมพ์ค้นหา..." autocomplete="off">
                    </div>
                    
                    <!-- Dropdown Menu -->
                    <div id="subject-dropdown" class="hidden absolute top-full left-0 right-0 mt-2 bg-white border border-gray-100 rounded-xl shadow-2xl max-h-64 overflow-y-auto z-20 scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent">
                        <div id="dropdown-content" class="p-2"></div>
                    </div>
                </div>
                <div class="mt-1.5 flex justify-between items-center text-xs text-gray-400 px-1">
                    <span>* สามารถเลือกได้มากกว่า 1 วิชา</span>
                    <span>เลือกแล้ว <span id="selected-count" class="font-bold text-primary-600">0</span> วิชา</span>
                </div>
            `;

            loading.classList.add('hidden');
            container.classList.remove('hidden');

            const searchInput = document.getElementById('subject-search');
            const dropdown = document.getElementById('subject-dropdown');
            const multiselectBox = document.getElementById('multiselect-box');

            // Event Listeners
            multiselectBox.addEventListener('click', () => {
                searchInput.focus();
                showDropdown(searchInput.value);
            });

            searchInput.addEventListener('focus', () => showDropdown(searchInput.value));

            searchInput.addEventListener('input', (e) => {
                showDropdown(e.target.value.trim());
            });

            // Close dropdown when clicking outside
            document.addEventListener('click', (e) => {
                if (!container.contains(e.target)) {
                    dropdown.classList.add('hidden');
                }
            });

            // Prevent closing when clicking inside dropdown
            dropdown.addEventListener('click', (e) => e.stopPropagation());

            renderDropdownContent(groupedSubjectsData);
        };

        const showDropdown = (query) => {
            const dropdown = document.getElementById('subject-dropdown');
            dropdown.classList.remove('hidden');

            if (!query) {
                renderDropdownContent(groupedSubjectsData);
                return;
            }

            // Filter logic
            const filtered = allSubjectsData.filter(s =>
                s.name.toLowerCase().includes(query.toLowerCase())
            );

            // Group the filtered results simply or show as flat list if searching
            renderDropdownFlat(filtered);
        };

        const renderDropdownContent = (grouped) => {
            const content = document.getElementById('dropdown-content');
            if (!grouped || Object.keys(grouped).length === 0) {
                content.innerHTML = '<div class="text-center py-4 text-gray-400 text-sm">ไม่พบข้อมูลรายวิชา</div>';
                return;
            }

            let html = '';
            for (const [category, subjects] of Object.entries(grouped)) {
                // Filter out already selected
                const available = subjects.filter(s => !teacherSubjects.includes(s.name));

                if (available.length > 0) {
                    html += `
                        <div class="mb-3 last:mb-0">
                            <div class="px-2 py-1 text-xs font-semibold text-gray-400 bg-gray-50 rounded-lg mb-1">${category}</div>
                            <div class="space-y-1">
                                ${available.map(s => createOptionHtml(s)).join('')}
                            </div>
                        </div>
                    `;
                }
            }

            if (html === '') {
                html = '<div class="text-center py-4 text-gray-400 text-sm">เลือกครบทุกวิชาแล้ว</div>';
            }

            content.innerHTML = html;
            attachOptionListeners();
        };

        const renderDropdownFlat = (list) => {
            const content = document.getElementById('dropdown-content');
            const available = list.filter(s => !teacherSubjects.includes(s.name));

            if (available.length === 0) {
                content.innerHTML = '<div class="text-center py-4 text-gray-400 text-sm">ไม่พบวิชาที่ค้นหา</div>';
                return;
            }

            content.innerHTML = `
                <div class="space-y-1">
                    ${available.map(s => createOptionHtml(s)).join('')}
                </div>
            `;
            attachOptionListeners();
        };

        const createOptionHtml = (s) => `
            <div class="option-item flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-primary-50 hover:text-primary-700 cursor-pointer transition-colors group" data-name="${s.name}" data-id="${s.id}">
                <span class="text-sm font-medium text-gray-700 group-hover:text-primary-700">${s.name}</span>
                <svg class="w-4 h-4 text-primary-400 opacity-0 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
                </svg>
            </div>
        `;

        const attachOptionListeners = () => {
            document.querySelectorAll('.option-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    e.stopPropagation(); // Stop bubbling
                    const name = item.dataset.name;
                    addSubject(name);

                    // Reset search
                    const input = document.getElementById('subject-search');
                    input.value = '';
                    input.focus();
                    showDropdown(''); // Refresh dropdown
                });
            });
        };

        const addSubject = (name) => {
            if (!teacherSubjects.includes(name)) {
                teacherSubjects.push(name);
                renderTags();
                updateSelectedCount();
            }
        };

        const removeSubject = (name) => {
            teacherSubjects = teacherSubjects.filter(s => s !== name);
            renderTags();
            updateSelectedCount();
            // Also refresh dropdown if open to show the added item back
            const dropdown = document.getElementById('subject-dropdown');
            if (!dropdown.classList.contains('hidden')) {
                const input = document.getElementById('subject-search');
                showDropdown(input.value);
            }
        };

        const renderTags = () => {
            const container = document.getElementById('selected-tags');
            container.innerHTML = teacherSubjects.map(name => `
                <div class="animate-scale-in inline-flex items-center px-3 py-1 bg-primary-50 border border-primary-200 text-primary-700 rounded-lg text-sm font-medium">
                    <span>${name}</span>
                    <button type="button" class="ml-2 p-0.5 hover:bg-primary-100 rounded-full text-primary-400 hover:text-primary-700 transition-colors" onclick="window.removeSubject('${name}')">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                    </button>
                </div>
             `).join('');
        };

        // Expose remove function globally for inline onclick
        window.removeSubject = removeSubject;

        const updateSelectedCount = () => {
            document.getElementById('selected-count').textContent = teacherSubjects.length;
        };

        // --- Event Listeners ---

        // Show/hide sections based on role
        document.querySelectorAll('input[name="role"]').forEach(radio => {
            radio.addEventListener('change', async (e) => {
                const teacherSection = document.getElementById('teacher-subjects-section');
                const studentSection = document.getElementById('student-room-section');
                const role = e.target.value;

                if (role === 'teacher') {
                    teacherSection.classList.remove('hidden');
                    studentSection.classList.add('hidden');
                    if (subjectTemplates.length === 0) await loadSubjectTemplates();
                } else if (role === 'student') {
                    teacherSection.classList.add('hidden');
                    studentSection.classList.remove('hidden');
                } else {
                    teacherSection.classList.add('hidden');
                    studentSection.classList.add('hidden');
                }
            });
        });

        // Form Submission
        document.getElementById('register-form').onsubmit = async (e) => {
            e.preventDefault();
            const btn = e.target.querySelector('button[type="submit"]');
            const role = e.target.role.value;

            // Get room info if student
            let roomInfo = null;
            if (role === 'student') {
                const level = e.target.level.value;
                const room = e.target.room.value;
                if (level && room) {
                    roomInfo = { level, room };
                }
            }

            // Validate inputs
            if (role === 'teacher' && teacherSubjects.length === 0) {
                UI.showToast('กรุณาเพิ่มวิชาที่สอนอย่างน้อย 1 วิชา', 'error');
                return;
            }
            if (role === 'student' && !roomInfo) {
                UI.showToast('กรุณาระบุระดับชั้นและห้อง', 'error');
                return;
            }

            btn.classList.add('btn-loading');
            btn.disabled = true;

            try {
                const name = e.target.name.value;
                const email = e.target.email.value;
                const password = e.target.password.value;

                // Pass roomInfo to Auth.register
                await Auth.register(role, name, email, password, role === 'teacher' ? teacherSubjects : [], roomInfo);
            } finally {
                btn.classList.remove('btn-loading');
                btn.disabled = false;
            }
        };

    }
};

/**
 * UI Helper Module
 */
const UI = {
    showLoading() {
        document.getElementById('loading-overlay')?.classList.remove('hidden');
    },

    hideLoading() {
        document.getElementById('loading-overlay')?.classList.add('hidden');
    },

    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const colors = {
            success: 'bg-green-500',
            error: 'bg-red-500',
            warning: 'bg-yellow-500',
            info: 'bg-blue-500'
        };

        const toast = document.createElement('div');
        toast.className = `toast flex items-center space-x-2 px-4 py-3 rounded-xl shadow-lg text-white ${colors[type]}`;
        toast.innerHTML = `<span>${Utils.escapeHtml(message)}</span>`;

        container.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('toast-exit');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },

    showModal(title, content) {
        const existing = document.getElementById('modal-backdrop');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = 'modal-backdrop';
        modal.className = 'modal-backdrop fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4';
        modal.innerHTML = `
            <div class="modal-content bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
                <div class="flex items-center justify-between p-4 border-b">
                    <h3 class="text-lg font-semibold">${Utils.escapeHtml(title)}</h3>
                    <button onclick="UI.hideModal()" class="p-2 hover:bg-gray-100 rounded-lg">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                    </button>
                </div>
                <div class="p-6">${content}</div>
            </div>
        `;

        modal.addEventListener('click', (e) => {
            if (e.target === modal) UI.hideModal();
        });

        document.body.appendChild(modal);
    },

    hideModal() {
        document.getElementById('modal-backdrop')?.remove();
    },

    pageWrapper(content) {
        const hasNav = Auth.isAuthenticated();
        return `
            <main class="${hasNav ? 'main-with-sidebar has-bottom-nav' : ''} min-h-screen bg-gray-50">
                <div class="container mx-auto px-4 py-6 max-w-6xl">
                    ${content}
                </div>
            </main>
        `;
    },

    header(title, right = '') {
        return `
            <div class="flex items-center justify-between mb-6">
                <div class="flex items-center space-x-3">
                    <button onclick="history.back()" class="p-2 hover:bg-gray-100 rounded-xl md:hidden">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
                        </svg>
                    </button>
                    <h1 class="text-2xl font-bold text-gray-900">${Utils.escapeHtml(title)}</h1>
                </div>
                <div>${right}</div>
            </div>
        `;
    },

    statsCard(label, value, icon, bgClass, valueId) {
        return `
            <div class="stats-card">
                <div class="stats-card-icon ${bgClass}">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                    </svg>
                </div>
                <div>
                    <p class="stats-card-value" id="${valueId}">${value}</p>
                    <p class="stats-card-label">${label}</p>
                </div>
            </div>
        `;
    },

    skeleton(count = 1) {
        return Array(count).fill().map(() => `
            <div class="skeleton h-20 rounded-xl"></div>
        `).join('');
    },

    emptyState(title, description) {
        return `
            <div class="empty-state py-12">
                <svg class="empty-state-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"/>
                </svg>
                <p class="empty-state-title">${Utils.escapeHtml(title)}</p>
                <p class="empty-state-text">${Utils.escapeHtml(description)}</p>
            </div>
        `;
    },

    searchBox(id, placeholder) {
        return `
            <div class="search-box">
                <svg class="search-box-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                </svg>
                <input type="search" id="${id}" class="search-box-input" placeholder="${placeholder}">
            </div>
        `;
    },

    filterChips(items, name) {
        return `
            <div class="filter-chips">
                ${items.map((item, i) => `
                    <button class="filter-chip ${i === 0 ? 'active' : ''}" data-filter="${item}">${item}</button>
                `).join('')}
            </div>
        `;
    },

    pagination(data, onPageChange) {
        if (!data || data.totalPages <= 1) return '';

        const { page, totalPages } = data;
        let html = '<div class="pagination">';

        // Previous
        html += `<button class="pagination-btn" ${page <= 1 ? 'disabled' : ''} onclick="(${onPageChange})(${page - 1})">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
            </svg>
        </button>`;

        // Page numbers
        const start = Math.max(1, page - 2);
        const end = Math.min(totalPages, page + 2);

        for (let i = start; i <= end; i++) {
            html += `<button class="pagination-btn ${i === page ? 'active' : ''}" onclick="(${onPageChange})(${i})">${i}</button>`;
        }

        // Next
        html += `<button class="pagination-btn" ${page >= totalPages ? 'disabled' : ''} onclick="(${onPageChange})(${page + 1})">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
            </svg>
        </button>`;

        html += '</div>';
        return html;
    }
};

window.UI = UI;
window.App = App;

// Initialize App
App.init();
