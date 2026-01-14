/**
 * Store - State Management
 */
const Store = {
    KEYS: {
        SESSION: 'homework_session',
        USER: 'homework_user',
        MODE: 'homework_mode',
        DEMO_DATA: 'homework_demo_data_v2'
    },

    getMode() {
        return localStorage.getItem(this.KEYS.MODE) || 'demo';
    },

    setMode(mode) {
        localStorage.setItem(this.KEYS.MODE, mode);
    },

    getSession() {
        const session = localStorage.getItem(this.KEYS.SESSION);
        if (!session) return null;
        try {
            const parsed = JSON.parse(session);
            if (parsed.expiresAt && new Date(parsed.expiresAt) < new Date()) {
                this.clearSession();
                return null;
            }
            return parsed;
        } catch (e) {
            return null;
        }
    },

    setSession(sessionData) {
        localStorage.setItem(this.KEYS.SESSION, JSON.stringify(sessionData));
    },

    clearSession() {
        localStorage.removeItem(this.KEYS.SESSION);
        localStorage.removeItem(this.KEYS.USER);
    },

    getUser() {
        const user = localStorage.getItem(this.KEYS.USER);
        return user ? JSON.parse(user) : null;
    },

    setUser(userData) {
        localStorage.setItem(this.KEYS.USER, JSON.stringify(userData));
    },

    isLoggedIn() {
        return this.getSession() !== null;
    },

    getRole() {
        const user = this.getUser();
        return user ? user.role : null;
    },

    initDemoData() {
        if (localStorage.getItem(this.KEYS.DEMO_DATA)) return;
        const demoData = this.createInitialDemoData();
        this.saveDemoData(demoData);
    },

    getDemoData() {
        const data = localStorage.getItem(this.KEYS.DEMO_DATA);

        // ถ้าไม่มีข้อมูลเลย ให้สร้างใหม่
        if (!data) return this.createInitialDemoData();

        // ถ้ามีข้อมูลเก่า ให้ลองตรวจสอบว่ามี Key ครบตาม Schema ปัจจุบันไหม
        const parsed = JSON.parse(data);
        const initial = this.createInitialDemoData();
        let changed = false;

        // Auto-migration: เติม key ที่หายไป (เช่น terms, subject_catalog ที่เพิ่งเพิ่มใหม่)
        Object.keys(initial).forEach(key => {
            if (parsed[key] === undefined) {
                parsed[key] = initial[key];
                changed = true;
            }
        });

        if (changed) {
            this.saveDemoData(parsed);
        }

        return parsed;
    },

    saveDemoData(data) {
        localStorage.setItem(this.KEYS.DEMO_DATA, JSON.stringify(data));
    },

    resetDemoData() {
        const demoData = this.createInitialDemoData();
        this.saveDemoData(demoData);
        return demoData;
    },

    createInitialDemoData() {
        const now = new Date().toISOString();
        const tomorrow = new Date(Date.now() + 86400000).toISOString();
        const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString();
        const hash = 'demo_hash_1234';

        return {
            users: [
                // ครู 2 คน เพื่อทดสอบ Subject Ownership
                { id: 'user_teacher1', role: 'teacher', name: 'อาจารย์สมศรี ใจดี', email: 'teacher@demo.com', passwordHash: hash, salt: 'demo', teacherProfileJSON: JSON.stringify({ preferredSubjects: ['คณิตศาสตร์', 'วิทยาศาสตร์'] }), createdAt: now, isActive: true },
                { id: 'user_teacher2', role: 'teacher', name: 'อาจารย์มานี มีสุข', email: 'teacher2@demo.com', passwordHash: hash, salt: 'demo', teacherProfileJSON: JSON.stringify({ preferredSubjects: ['ภาษาไทย', 'สังคมศึกษา'] }), createdAt: now, isActive: true },
                { id: 'user_student1', role: 'student', name: 'ด.ช.สมชาย รักเรียน', email: 'student@demo.com', passwordHash: hash, salt: 'demo', primaryClassId: 'class_1', teacherProfileJSON: '', createdAt: now, isActive: true },
                { id: 'user_student2', role: 'student', name: 'ด.ญ.สมหญิง ตั้งใจ', email: 'student2@demo.com', passwordHash: hash, salt: 'demo', primaryClassId: 'class_2', teacherProfileJSON: '', createdAt: now, isActive: true },
                { id: 'user_parent1', role: 'parent', name: 'นางสมใจ รักเรียน', email: 'parent@demo.com', passwordHash: hash, salt: 'demo', teacherProfileJSON: '', createdAt: now, isActive: true },
                { id: 'user_admin1', role: 'admin', name: 'ผู้ดูแลระบบ', email: 'admin@demo.com', passwordHash: hash, salt: 'demo', teacherProfileJSON: '', createdAt: now, isActive: true }
            ],
            sessions: [],
            terms: [
                // Generate Dynamic Terms based on current year
                ...(() => {
                    const currentYearAD = new Date().getFullYear();
                    const currentYearTH = currentYearAD + 543;
                    return [
                        // Previous Year
                        { id: 'term_1_prev', academicYear: String(currentYearTH - 1), term: '1', startDate: `${currentYearAD - 1}-05-16`, endDate: `${currentYearAD - 1}-10-10`, isActive: true },
                        { id: 'term_2_prev', academicYear: String(currentYearTH - 1), term: '2', startDate: `${currentYearAD - 1}-11-01`, endDate: `${currentYearAD}-03-31`, isActive: true },
                        // Current Year
                        { id: 'term_1', academicYear: String(currentYearTH), term: '1', startDate: `${currentYearAD}-05-16`, endDate: `${currentYearAD}-10-10`, isActive: true },
                        { id: 'term_2', academicYear: String(currentYearTH), term: '2', startDate: `${currentYearAD}-11-01`, endDate: `${currentYearAD + 1}-03-31`, isActive: true }
                    ];
                })()
            ],
            classes: [
                // Seed Classes: P.1 - M.3 (4 rooms each) + M.4-6 (sample)
                ...(() => {
                    const classes = [];
                    const levels = ['ป.1', 'ป.2', 'ป.3', 'ป.4', 'ป.5', 'ป.6', 'ม.1', 'ม.2', 'ม.3'];
                    let idCounter = 1;

                    levels.forEach(level => {
                        for (let r = 1; r <= 4; r++) {
                            classes.push({
                                id: `class_gen_${idCounter}`,
                                name: `${level}/${r}`,
                                level: level,
                                room: String(r),
                                termId: 'term_1',
                                teacherId: 'user_teacher1', // Default owner
                                joinCode: `CODE${idCounter}`,
                                roomJoinCode: `ROOM${level.replace('.', '')}${r}`, // ROOMP11
                                createdAt: now,
                                isActive: true
                            });
                            idCounter++;
                        }
                    });

                    // Add existing sample classes for existing links (map old IDs to new logic or just keep them)
                    // Keeping class_1, class_2, class_3 manually to ensure hardcoded relationships in demo works
                    // class_1 = ม.3/1 (matches generated class_gen_33) -> Let's overwrite generated one or just let them coexist?
                    // Better to just add the requested ones AND keep critical legacy ones for relationships
                    // actually, let's just REPLACE the array but ensure IDs used elsewhere verify.
                    // class_1 is used in: enrollments, class_subjects, subjects.
                    // Let's modify the above generation to include hardcoded IDs for specific classes.

                    return classes.map(c => {
                        if (c.name === 'ม.3/1') return { ...c, id: 'class_1', joinCode: 'ABC123' };
                        if (c.name === 'ม.3/2') return { ...c, id: 'class_2', joinCode: 'XYZ789' };
                        // For M.4/1, we add it separately since it wasn't in the loop P.1-M.3
                        return c;
                    });
                })(),
                { id: 'class_3', name: 'ม.4/1', level: 'ม.4', room: '1', termId: 'term_1', teacherId: 'user_teacher1', joinCode: 'DEF456', roomJoinCode: 'ROOM401', createdAt: now, isActive: true }
            ],
            // ===== SUBJECT CATALOG (Admin จัดการ) =====
            // รายวิชากลางของโรงเรียน พร้อมรหัสวิชา
            subject_catalog: [
                { id: 'cat_1', subjectCode: 'ค21101', subjectName: 'คณิตศาสตร์พื้นฐาน', levelGroup: 'ม.ต้น', category: 'วิทย์-คณิต', createdAt: now, isActive: true },
                { id: 'cat_2', subjectCode: 'ค21102', subjectName: 'คณิตศาสตร์เพิ่มเติม', levelGroup: 'ม.ต้น', category: 'วิทย์-คณิต', createdAt: now, isActive: true },
                { id: 'cat_3', subjectCode: 'ว21101', subjectName: 'วิทยาศาสตร์พื้นฐาน', levelGroup: 'ม.ต้น', category: 'วิทย์-คณิต', createdAt: now, isActive: true },
                { id: 'cat_4', subjectCode: 'ว21102', subjectName: 'วิทยาศาสตร์เพิ่มเติม', levelGroup: 'ม.ต้น', category: 'วิทย์-คณิต', createdAt: now, isActive: true },
                { id: 'cat_5', subjectCode: 'ท21101', subjectName: 'ภาษาไทยพื้นฐาน', levelGroup: 'ม.ต้น', category: 'ภาษา', createdAt: now, isActive: true },
                { id: 'cat_6', subjectCode: 'อ21101', subjectName: 'ภาษาอังกฤษพื้นฐาน', levelGroup: 'ม.ต้น', category: 'ภาษา', createdAt: now, isActive: true },
                { id: 'cat_7', subjectCode: 'ส21101', subjectName: 'สังคมศึกษา ศาสนา และวัฒนธรรม', levelGroup: 'ม.ต้น', category: 'สังคม', createdAt: now, isActive: true },
                { id: 'cat_8', subjectCode: 'ส21102', subjectName: 'ประวัติศาสตร์', levelGroup: 'ม.ต้น', category: 'สังคม', createdAt: now, isActive: true },
                { id: 'cat_9', subjectCode: 'พ21101', subjectName: 'สุขศึกษาและพลศึกษา', levelGroup: 'ม.ต้น', category: 'สุขศึกษา-พละ', createdAt: now, isActive: true },
                { id: 'cat_10', subjectCode: 'ศ21101', subjectName: 'ศิลปะ', levelGroup: 'ม.ต้น', category: 'ศิลปะ', createdAt: now, isActive: true },
                { id: 'cat_11', subjectCode: 'ง21101', subjectName: 'การงานอาชีพ', levelGroup: 'ม.ต้น', category: 'การงาน', createdAt: now, isActive: true },
                { id: 'cat_12', subjectCode: 'ว21103', subjectName: 'วิทยาการคำนวณ', levelGroup: 'ม.ต้น', category: 'การงาน', createdAt: now, isActive: true },
                // ม.ปลาย
                { id: 'cat_13', subjectCode: 'ค31101', subjectName: 'คณิตศาสตร์พื้นฐาน', levelGroup: 'ม.ปลาย', category: 'วิทย์-คณิต', createdAt: now, isActive: true },
                { id: 'cat_14', subjectCode: 'ว31101', subjectName: 'ฟิสิกส์', levelGroup: 'ม.ปลาย', category: 'วิทย์-คณิต', createdAt: now, isActive: true },
                { id: 'cat_15', subjectCode: 'ว31102', subjectName: 'เคมี', levelGroup: 'ม.ปลาย', category: 'วิทย์-คณิต', createdAt: now, isActive: true },
                { id: 'cat_16', subjectCode: 'ว31103', subjectName: 'ชีววิทยา', levelGroup: 'ม.ปลาย', category: 'วิทย์-คณิต', createdAt: now, isActive: true }
            ],
            // ===== CLASS SUBJECTS (วิชาในห้องเรียน + ครูผู้สอน) =====
            // Admin มอบหมายวิชาจาก catalog ให้ห้องเรียน พร้อมระบุครูผู้สอน
            class_subjects: [
                // ม.3/1 - ครู 1 สอน
                { id: 'cs_1', classId: 'class_1', catalogId: 'cat_1', teacherId: 'user_teacher1', createdAt: now, isActive: true },
                { id: 'cs_2', classId: 'class_1', catalogId: 'cat_3', teacherId: 'user_teacher1', createdAt: now, isActive: true },
                // ม.3/2 - ครู 2 สอน
                { id: 'cs_3', classId: 'class_2', catalogId: 'cat_5', teacherId: 'user_teacher2', createdAt: now, isActive: true },
                { id: 'cs_4', classId: 'class_2', catalogId: 'cat_7', teacherId: 'user_teacher2', createdAt: now, isActive: true },
                // ม.3/1 - ครู 2 สอนบางวิชา (ครู 1 คน สอนได้หลายห้อง)
                { id: 'cs_5', classId: 'class_1', catalogId: 'cat_5', teacherId: 'user_teacher2', createdAt: now, isActive: true },
                // ม.4/1 - ครู 1 สอน
                { id: 'cs_6', classId: 'class_3', catalogId: 'cat_13', teacherId: 'user_teacher1', createdAt: now, isActive: true }
            ],
            // ===== OLD SUBJECTS (backward compatible, จะค่อยๆ migrate) =====
            subjects: [
                // วิชาของครู 1 (teacher@demo.com) - ใช้ class_subjects แทน
                { id: 'subject_1', classId: 'class_1', classSubjectId: 'cs_1', name: 'คณิตศาสตร์พื้นฐาน', teacherId: 'user_teacher1', createdAt: now, isActive: true },
                { id: 'subject_2', classId: 'class_1', classSubjectId: 'cs_2', name: 'วิทยาศาสตร์พื้นฐาน', teacherId: 'user_teacher1', createdAt: now, isActive: true },
                // วิชาของครู 2 (teacher2@demo.com)
                { id: 'subject_3', classId: 'class_2', classSubjectId: 'cs_3', name: 'ภาษาไทยพื้นฐาน', teacherId: 'user_teacher2', createdAt: now, isActive: true },
                { id: 'subject_4', classId: 'class_2', classSubjectId: 'cs_4', name: 'สังคมศึกษา ศาสนา และวัฒนธรรม', teacherId: 'user_teacher2', createdAt: now, isActive: true }
            ],
            enrollments: [
                { id: 'enroll_1', classId: 'class_1', studentId: 'user_student1', createdAt: now, isActive: true },
                { id: 'enroll_2', classId: 'class_1', studentId: 'user_student2', createdAt: now, isActive: true },
                { id: 'enroll_3', classId: 'class_2', studentId: 'user_student1', createdAt: now, isActive: true }
            ],
            assignments: [
                // งานของครู 1 (ผูกกับ class_subject)
                { id: 'assign_1', subjectId: 'subject_1', classSubjectId: 'cs_1', title: 'แบบฝึกหัดบทที่ 1', detail: 'ทำแบบฝึกหัดหน้า 25-27', dueDate: tomorrow, maxScore: 10, rubricJSON: '[]', filesJSON: '[]', createdAt: now, isActive: true },
                { id: 'assign_2', subjectId: 'subject_1', classSubjectId: 'cs_1', title: 'รายงานกลุ่ม', detail: 'ทำรายงานเรื่องเศษส่วน', dueDate: nextWeek, maxScore: 20, rubricJSON: '[]', filesJSON: '[]', createdAt: now, isActive: true },
                // งานของครู 2
                { id: 'assign_3', subjectId: 'subject_3', classSubjectId: 'cs_3', title: 'เขียนเรียงความ', detail: 'เรื่อง ความกตัญญู', dueDate: nextWeek, maxScore: 10, rubricJSON: '[]', filesJSON: '[]', createdAt: now, isActive: true }
            ],
            submissions: [
                { id: 'submit_1', assignmentId: 'assign_1', studentId: 'user_student1', submittedAt: now, text: 'ส่งงานครับ', link: '', filesJSON: '[]', status: 'GRADED', version: 1, parentSubmissionId: null }
            ],
            grades: [
                { id: 'grade_1', submissionId: 'submit_1', teacherId: 'user_teacher1', score: 8, feedback: 'ทำได้ดี', rubricScoreJSON: '[]', gradedAt: now, status: 'GRADED' }
            ],
            parents: [
                { id: 'parent_link_1', parentId: 'user_parent1', studentId: 'user_student1', relation: 'มารดา', linkCode: 'LINK01', createdAt: now, isActive: true }
            ],
            notifications: [],
            audit_logs: [],
            error_logs: [],
            // ===== SUBJECT TEMPLATES (สำหรับครูเลือกตอนสมัคร - backward compat) =====
            subject_templates: [
                { id: 'tpl_1', name: 'คณิตศาสตร์', category: 'วิทย์-คณิต', isActive: true },
                { id: 'tpl_2', name: 'วิทยาศาสตร์', category: 'วิทย์-คณิต', isActive: true },
                { id: 'tpl_3', name: 'ฟิสิกส์', category: 'วิทย์-คณิต', isActive: true },
                { id: 'tpl_4', name: 'เคมี', category: 'วิทย์-คณิต', isActive: true },
                { id: 'tpl_5', name: 'ชีววิทยา', category: 'วิทย์-คณิต', isActive: true },
                { id: 'tpl_6', name: 'ภาษาไทย', category: 'ภาษา', isActive: true },
                { id: 'tpl_7', name: 'ภาษาอังกฤษ', category: 'ภาษา', isActive: true },
                { id: 'tpl_8', name: 'ภาษาจีน', category: 'ภาษา', isActive: true },
                { id: 'tpl_9', name: 'สังคมศึกษา', category: 'สังคม', isActive: true },
                { id: 'tpl_10', name: 'ประวัติศาสตร์', category: 'สังคม', isActive: true },
                { id: 'tpl_11', name: 'พระพุทธศาสนา', category: 'สังคม', isActive: true },
                { id: 'tpl_12', name: 'สุขศึกษา', category: 'สุขศึกษา-พละ', isActive: true },
                { id: 'tpl_13', name: 'พลศึกษา', category: 'สุขศึกษา-พละ', isActive: true },
                { id: 'tpl_14', name: 'ศิลปะ', category: 'ศิลปะ', isActive: true },
                { id: 'tpl_15', name: 'ดนตรี', category: 'ศิลปะ', isActive: true },
                { id: 'tpl_16', name: 'นาฏศิลป์', category: 'ศิลปะ', isActive: true },
                { id: 'tpl_17', name: 'การงานอาชีพ', category: 'การงาน', isActive: true },
                { id: 'tpl_18', name: 'คอมพิวเตอร์', category: 'การงาน', isActive: true }
            ],
            config: { currentTerm: '1', academicYear: String(new Date().getFullYear() + 543), schoolName: 'โรงเรียนตัวอย่าง' }
        };
    },

    demoFind(collection, predicate) {
        const data = this.getDemoData();
        return data[collection]?.find(predicate) || null;
    },

    demoFilter(collection, predicate) {
        const data = this.getDemoData();
        return data[collection]?.filter(predicate) || [];
    },

    demoAdd(collection, item) {
        const data = this.getDemoData();
        if (!data[collection]) data[collection] = [];
        data[collection].push(item);
        this.saveDemoData(data);
        return item;
    },

    demoUpdate(collection, id, updates) {
        const data = this.getDemoData();
        const index = data[collection]?.findIndex(item => item.id === id);
        if (index !== -1) {
            data[collection][index] = { ...data[collection][index], ...updates };
            this.saveDemoData(data);
            return data[collection][index];
        }
        return null;
    },

    demoDelete(collection, id) {
        return this.demoUpdate(collection, id, { isActive: false });
    },

    demoCheckUnique(collection, field, value, excludeId = null) {
        const data = this.getDemoData();
        return !data[collection]?.some(item => item[field] === value && item.id !== excludeId && item.isActive !== false);
    }
};

window.Store = Store;
Store.initDemoData();
