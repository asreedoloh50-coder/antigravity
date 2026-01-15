/**
 * API Module - Handles both Demo and Real API modes
 */
const API = {
    // Base URL for Google Apps Script Web App
    BASE_URL: 'https://script.google.com/macros/s/AKfycbzuLHT853o9vAWSVKM63zHVKV8NZjMLzELhgV8eNWCVsrgludIm931KDDN7g3qJ6igg/exec',

    // Request ID for tracking
    generateRequestId() {
        return 'req_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    },

    // Main request handler
    async request(action, params = {}) {
        const mode = Store.getMode();
        const requestId = this.generateRequestId();

        if (mode === 'demo') {
            return this.demoRequest(action, params, requestId);
        } else {
            return this.apiRequest(action, params, requestId);
        }
    },

    // Real API request
    async apiRequest(action, params, requestId) {
        if (!this.BASE_URL) {
            return { success: false, error: 'กรุณาตั้งค่า API URL', requestId };
        }

        try {
            const session = Store.getSession();
            const payload = {
                action,
                requestId,
                token: session?.token || null,
                ...params
            };

            const response = await fetch(this.BASE_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // Prevent CORS Preflight
                body: JSON.stringify(payload)
            });

            const data = await response.json();
            return { ...data, requestId };
        } catch (error) {
            console.error('API Error:', error);
            return { success: false, error: 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้: ' + error.message, requestId };
        }
    },

    // Demo mode request handler
    async demoRequest(action, params, requestId) {
        await new Promise(r => setTimeout(r, 200)); // Simulate network delay

        const handlers = {
            // Auth
            'register': () => this.demoRegister(params),
            'login': () => this.demoLogin(params),
            'logout': () => this.demoLogout(params),
            'me': () => this.demoMe(params),

            // Classes
            'createClass': () => this.demoCreateClass(params),
            'listClasses': () => this.demoListClasses(params),
            'joinClass': () => this.demoJoinClass(params),
            'getClass': () => this.demoGetClass(params),

            // Subjects
            'createSubject': () => this.demoCreateSubject(params),
            'listSubjects': () => this.demoListSubjects(params),

            // Assignments
            'createAssignment': () => this.demoCreateAssignment(params),
            'listAssignments': () => this.demoListAssignments(params),
            'getAssignment': () => this.demoGetAssignment(params),
            'updateAssignment': () => this.demoUpdateAssignment(params),
            'deleteAssignment': () => this.demoDeleteAssignment(params),

            // Submissions
            'submitHomework': () => this.demoSubmitHomework(params),
            'listSubmissionsByAssignment': () => this.demoListSubmissionsByAssignment(params),
            'getSubmission': () => this.demoGetSubmission(params),
            'updateAssignment': () => this.demoUpdateAssignment(params),
            'deleteAssignment': () => this.demoDeleteAssignment(params),
            'listSubmissionsByStudent': () => this.demoListSubmissionsByStudent(params),
            'requestRevision': () => this.demoRequestRevision(params),

            // Grading
            'gradeHomework': () => this.demoGradeHomework(params),
            'getStudentGrades': () => this.demoGetStudentGrades(params),

            // Parent
            'parentLink': () => this.demoParentLink(params),
            'parentUnlink': () => this.demoParentUnlink(params),
            'parentGetGrades': () => this.demoParentGetGrades(params),
            'getLinkedStudents': () => this.demoGetLinkedStudents(params),

            // Notifications
            'listNotifications': () => this.demoListNotifications(params),
            'markRead': () => this.demoMarkRead(params),

            // Admin
            'listUsers': () => this.demoListUsers(params),
            'updateUser': () => this.demoUpdateUser(params),
            'getAuditLogs': () => this.demoGetAuditLogs(params),
            'backupData': () => this.demoBackupData(params),
            'restoreData': () => this.demoRestoreData(params),

            // Export
            'exportGradesCSV': () => this.demoExportGradesCSV(params),
            'exportMissingCSV': () => this.demoExportMissingCSV(params),

            // Students
            'listStudents': () => this.demoListStudents(params),

            // Subject Templates (Admin-defined subjects)
            'listSubjectTemplates': () => this.demoListSubjectTemplates(params),

            // ===== Admin Subject Catalog =====
            'listSubjectCatalog': () => this.demoListSubjectCatalog(params),
            'createSubjectCatalog': () => this.demoCreateSubjectCatalog(params),
            'updateSubjectCatalog': () => this.demoUpdateSubjectCatalog(params),
            'deleteSubjectCatalog': () => this.demoDeleteSubjectCatalog(params),

            // ===== Admin Class Subjects =====
            'listClassSubjects': () => this.demoListClassSubjects(params),
            'createClassSubject': () => this.demoCreateClassSubject(params),
            'updateClassSubject': () => this.demoUpdateClassSubject(params),
            'deleteClassSubject': () => this.demoDeleteClassSubject(params),
            'assignTeacherToClassSubject': () => this.demoAssignTeacherToClassSubject(params),

            // ===== Admin Helpers =====
            'adminListClasses': () => this.demoAdminListClasses(params),
            'listTeachers': () => this.demoListTeachers(params),

            // ===== Teacher Class Subjects =====
            'listMyClassSubjects': () => this.demoListMyClassSubjects(params),
            'createAssignmentV2': () => this.demoCreateAssignmentV2(params),
            'listAssignmentsByClassSubject': () => this.demoListAssignmentsByClassSubject(params),
            'getTeacherDashboardStats': () => this.demoGetTeacherDashboardStats(params),
            'getStudentDashboardStats': () => this.demoGetStudentDashboardStats(params),
            'getGradebookData': () => this.demoGetGradebookData(params),

            // ===== Admin Room Management =====
            'adminCreateClass': () => this.demoAdminCreateClass(params),
            'adminUpdateClass': () => this.demoAdminUpdateClass(params),
            'adminDeleteClass': () => this.demoAdminDeleteClass(params),
            'listTerms': () => this.demoListTerms(params)
        };

        const handler = handlers[action];
        if (handler) {
            try {
                const result = handler();
                return { ...result, requestId };
            } catch (e) {
                console.error('Demo API Error:', e);
                return { success: false, error: 'Demo Error: ' + e.message, requestId };
            }
        }

        return { success: false, error: 'ไม่พบ action นี้', requestId };
    },

    // ===== Demo Auth =====
    demoRegister(params) {
        const { role, name, email, password, teacherSubjects, roomJoinCode } = params;

        if (!name || !email || !password) {
            return { success: false, error: 'กรุณากรอกข้อมูลให้ครบถ้วน' };
        }

        // Student Role: ต้องระบุห้องเรียน (Code หรือ Level/Room)
        let primaryClassId = null;
        if (role === 'student') {
            if (roomJoinCode) {
                const targetClass = Store.demoFind('classes', c => c.roomJoinCode === roomJoinCode && c.isActive);
                if (!targetClass) {
                    return { success: false, error: 'ไม่พบห้องเรียนจากรหัสที่ระบุ' };
                }
                primaryClassId = targetClass.id;
            } else if (params.level && params.room) {
                const targetClass = Store.demoFind('classes', c => c.level === params.level && String(c.room) === String(params.room) && c.isActive);
                if (!targetClass) {
                    return { success: false, error: `ไม่พบห้องเรียน ${params.level}/${params.room}` };
                }
                primaryClassId = targetClass.id;
            } else {
                return { success: false, error: 'กรุณาระบุห้องเรียน' };
            }
        }

        // Teacher Role: ต้องระบุวิชาที่สอน (ถ้ามีส่งมา)
        // (Teacher Profile ปรับใหม่ ใช้ preferredSubjects แทน subjects เดิม)

        const normalizedEmail = email.toLowerCase().trim();
        if (!Store.demoCheckUnique('users', 'email', normalizedEmail)) {
            return { success: false, error: 'อีเมลนี้ถูกใช้งานแล้ว' };
        }

        const newUser = {
            id: Utils.generateId(),
            role: role || 'student',
            name: name.trim(),
            email: normalizedEmail,
            passwordHash: 'demo_hash_' + password,
            salt: 'demo',
            primaryClassId: primaryClassId, // บันทึกห้องหลัก
            teacherProfileJSON: role === 'teacher' ? JSON.stringify({ preferredSubjects: teacherSubjects || [] }) : '',
            createdAt: new Date().toISOString(),
            isActive: true
        };

        Store.demoAdd('users', newUser);

        // ถ้าเป็นครู ไม่ต้องสร้าง subjects อัตโนมัติแล้ว (ให้เลือกจาก catalog ทีหลัง)

        // ถ้าเป็นนักเรียน สร้าง enrollment ให้ห้องหลักด้วย
        if (role === 'student' && primaryClassId) {
            Store.demoAdd('enrollments', {
                id: Utils.generateId(),
                classId: primaryClassId,
                studentId: newUser.id,
                createdAt: new Date().toISOString(),
                isActive: true
            });
        }

        return { success: true, data: { userId: newUser.id } };
    },

    demoLogin(params) {
        const { email, password } = params;
        const normalizedEmail = email?.toLowerCase().trim();

        const user = Store.demoFind('users', u =>
            u.email === normalizedEmail && u.isActive
        );

        if (!user) {
            return { success: false, error: 'ไม่พบบัญชีผู้ใช้นี้' };
        }

        // Simple demo password check
        if (user.passwordHash !== 'demo_hash_' + password && password !== '1234') {
            return { success: false, error: 'รหัสผ่านไม่ถูกต้อง' };
        }

        const token = Utils.generateToken();
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

        const session = {
            token,
            userId: user.id,
            role: user.role,
            createdAt: new Date().toISOString(),
            expiresAt,
            deviceInfo: params.deviceInfo || 'Unknown',
            isRevoked: false
        };

        Store.demoAdd('sessions', session);
        Store.setSession({ token, expiresAt });
        Store.setUser({ id: user.id, name: user.name, email: user.email, role: user.role });

        return {
            success: true,
            data: {
                token,
                user: { id: user.id, name: user.name, email: user.email, role: user.role },
                expiresAt
            }
        };
    },

    demoLogout(params) {
        const session = Store.getSession();
        if (session?.token) {
            const data = Store.getDemoData();
            const sessionIndex = data.sessions.findIndex(s => s.token === session.token);
            if (sessionIndex !== -1) {
                data.sessions[sessionIndex].isRevoked = true;
                Store.saveDemoData(data);
            }
        }
        Store.clearSession();
        return { success: true };
    },

    demoMe(params) {
        const user = Store.getUser();
        if (!user) {
            return { success: false, error: 'ไม่ได้เข้าสู่ระบบ' };
        }
        return { success: true, data: { user } };
    },

    // ===== Demo Classes =====
    // เดิมคือ demoCreateClass สำหรับ Teacher (ยกเลิกใช้ เปลี่ยนเป็น Admin สร้าง)
    // เปลี่ยนเป็น demoAdminCreateClass แทน

    // ===== Admin Class Management =====
    demoAdminCreateClass(params) {
        const user = Store.getUser();
        if (!user || user.role !== 'admin') return { success: false, error: 'ไม่มีสิทธิ์' };

        // Generate unique roomJoinCode
        let roomJoinCode;
        do {
            roomJoinCode = 'ROOM' + Math.floor(1000 + Math.random() * 9000); // Ex: ROOM1234
        } while (!Store.demoCheckUnique('classes', 'roomJoinCode', roomJoinCode));

        const newClass = {
            id: Utils.generateId(),
            level: params.level, // e.g., "ม.1"
            room: params.room,   // e.g., "1"
            name: `${params.level}/${params.room}`,
            termId: params.termId || '',
            teacherId: params.homeroomTeacherId || '',
            roomJoinCode: roomJoinCode,
            joinCode: Utils.generateCode(6), // Legacy code (เผื่อใช้)
            createdAt: new Date().toISOString(),
            isActive: true
        };

        Store.demoAdd('classes', newClass);
        return { success: true, data: newClass };
    },

    demoAdminUpdateClass(params) {
        const user = Store.getUser();
        if (!user || user.role !== 'admin') return { success: false, error: 'ไม่มีสิทธิ์' };

        const target = Store.demoFind('classes', c => c.id === params.id);
        if (!target) return { success: false, error: 'ไม่พบห้องเรียน' };

        // Update fields
        if (params.level && params.room) {
            target.level = params.level;
            target.room = params.room;
            target.name = `${params.level}/${params.room}`;
        }
        if (params.termId) target.termId = params.termId;
        if (params.homeroomTeacherId !== undefined) target.teacherId = params.homeroomTeacherId;

        // ไม่ให้แก้ roomJoinCode manual (ระบบสร้างให้)

        Store.saveDemoData();
        return { success: true, data: target };
    },

    demoListTerms() {
        // Public or Authenticated
        const terms = Store.getDemoData().terms || [];
        return { success: true, data: terms.filter(t => t.isActive) };
    },

    demoListClasses(params) {
        const user = Store.getUser();
        if (!user) return { success: false, error: 'ไม่ได้เข้าสู่ระบบ' };

        let classes = [];
        const allClasses = Store.getDemoData().classes || [];

        if (user.role === 'admin') {
            classes = allClasses.filter(c => c.isActive);
        } else if (user.role === 'teacher') {
            // 1. Homeroom
            const homeroomIds = allClasses.filter(c => c.teacherId === user.id).map(c => c.id);

            // 2. Legacy Subjects
            const legacySubjects = Store.demoFilter('subjects', s => s.teacherId === user.id && s.isActive);
            const legacyClassIds = legacySubjects.map(s => s.classId);

            // 3. Class Subjects
            const classSubjects = Store.demoFilter('class_subjects', cs => cs.teacherId === user.id && cs.isActive !== false);
            const classSubjectClassIds = classSubjects.map(cs => cs.classId);

            const visibleClassIds = [...new Set([...homeroomIds, ...legacyClassIds, ...classSubjectClassIds])];
            classes = allClasses.filter(c => visibleClassIds.includes(c.id) && c.isActive);
        } else if (user.role === 'student') {
            // นักเรียนเห็นเฉพาะห้องตัวเอง (primaryClassId)
            if (user.primaryClassId) {
                classes = allClasses.filter(c => c.id === user.primaryClassId && c.isActive);
            } else {
                // Fallback: enrollment
                const enrollments = Store.demoFilter('enrollments', e => e.studentId === user.id && e.isActive);
                const classIds = enrollments.map(e => e.classId);
                classes = allClasses.filter(c => classIds.includes(c.id) && c.isActive);
            }
        }

        // Enrich with term info & homeroom teacher name
        const users = Store.getDemoData().users || [];
        const terms = Store.getDemoData().terms || [];

        classes = classes.map(c => {
            const t = terms.find(tm => tm.id === c.termId);
            const teacher = users.find(u => u.id === c.teacherId);
            return {
                ...c,
                termName: t ? `${t.term}/${t.academicYear}` : '-',
                teacherName: teacher ? teacher.name : '-'
            };
        });

        return { success: true, data: classes };
    },

    demoJoinClass(params) {
        const user = Store.getUser();
        if (!user || user.role !== 'student') {
            return { success: false, error: 'ไม่มีสิทธิ์ดำเนินการ' };
        }

        const targetClass = Store.demoFind('classes', c => c.joinCode === params.joinCode && c.isActive);
        if (!targetClass) {
            return { success: false, error: 'ไม่พบรหัสห้องเรียนนี้' };
        }

        const existing = Store.demoFind('enrollments', e =>
            e.classId === targetClass.id && e.studentId === user.id && e.isActive
        );
        if (existing) {
            return { success: false, error: 'คุณอยู่ในห้องเรียนนี้แล้ว' };
        }

        const enrollment = {
            id: Utils.generateId(),
            classId: targetClass.id,
            studentId: user.id,
            createdAt: new Date().toISOString(),
            isActive: true
        };

        Store.demoAdd('enrollments', enrollment);
        return { success: true, data: { className: targetClass.name } };
    },

    demoGetClass(params) {
        const targetClass = Store.demoFind('classes', c => c.id === params.classId && c.isActive);
        if (!targetClass) {
            return { success: false, error: 'ไม่พบห้องเรียน' };
        }

        const enrollments = Store.demoFilter('enrollments', e => e.classId === params.classId && e.isActive);
        const students = enrollments.map(e => {
            const student = Store.demoFind('users', u => u.id === e.studentId);
            return student ? { id: student.id, name: student.name } : null;
        }).filter(Boolean);

        return { success: true, data: { ...targetClass, students, studentCount: students.length } };
    },

    // ===== Demo Subjects =====
    demoCreateSubject(params) {
        const user = Store.getUser();
        if (!user || (user.role !== 'teacher' && user.role !== 'admin')) {
            return { success: false, error: 'ไม่มีสิทธิ์ดำเนินการ' };
        }

        const newSubject = {
            id: Utils.generateId(),
            classId: params.classId || '',
            name: params.name,
            teacherId: user.role === 'teacher' ? user.id : (params.teacherId || ''),
            createdAt: new Date().toISOString(),
            isActive: true
        };

        Store.demoAdd('subjects', newSubject);
        return { success: true, data: newSubject };
    },

    demoListSubjects(params) {
        const user = Store.getUser();

        // 1. Legacy Subjects
        let legacySubjects = Store.demoFilter('subjects', s => s.isActive);

        // 2. Class Subjects (New System)
        let classSubjects = Store.demoFilter('class_subjects', s => s.isActive !== false);

        // Enrich Class Subjects to look like Legacy Subjects
        let enrichedClassSubjects = classSubjects.map(cs => {
            const catalog = Store.demoFind('subject_catalog', c => c.id === cs.catalogId);
            return {
                id: cs.id, // Use class_subject id
                name: catalog ? catalog.subjectName : 'Unknown Subject',
                code: catalog ? catalog.subjectCode : '',
                classId: cs.classId,
                teacherId: cs.teacherId,
                isClassSubject: true,
                isActive: true
            };
        });

        let allSubjects = [...legacySubjects, ...enrichedClassSubjects];

        // Filter by Ownership (Teacher)
        if (user && user.role === 'teacher') {
            allSubjects = allSubjects.filter(s => s.teacherId === user.id);
        }

        // Filter by ClassId
        if (params.classId) {
            allSubjects = allSubjects.filter(s => s.classId === params.classId);
        }

        // Filter for Student (Enrolled Classes)
        if (user && user.role === 'student') {
            const enrollments = Store.demoFilter('enrollments', e => e.studentId === user.id && e.isActive);
            const myClassIds = enrollments.map(e => e.classId);
            allSubjects = allSubjects.filter(s => myClassIds.includes(s.classId) || s.classId === '');
        }

        return { success: true, data: allSubjects };
    },

    // ===== Demo Assignments =====
    demoCreateAssignment(params) {
        const user = Store.getUser();
        if (!user || user.role !== 'teacher') {
            return { success: false, error: 'ไม่มีสิทธิ์ดำเนินการ' };
        }

        // ตรวจสอบ Subject Ownership
        const subject = Store.demoFind('subjects', s => s.id === params.subjectId && s.isActive);
        if (!subject) {
            return { success: false, error: 'ไม่พบวิชา' };
        }

        if (subject.teacherId !== user.id) {
            return { success: false, error: 'ไม่มีสิทธิ์สร้างงานในวิชานี้ (วิชาไม่ใช่ของคุณ)' };
        }

        const newAssignment = {
            id: Utils.generateId(),
            subjectId: params.subjectId,
            title: params.title,
            detail: params.detail || '',
            dueDate: params.dueDate,
            maxScore: params.maxScore || 10,
            rubricJSON: JSON.stringify(params.rubric || []),
            filesJSON: JSON.stringify(params.files || []),
            createdAt: new Date().toISOString(),
            isActive: true
        };

        Store.demoAdd('assignments', newAssignment);
        return { success: true, data: newAssignment };
    },

    demoListAssignments(params) {
        // Filter assignments based on user role
        const user = Store.getUser();
        let assignments = Store.demoFilter('assignments', a => a.isActive);

        // Teacher: Only show assignments for their subjects
        if (user && user.role === 'teacher') {
            // 1. Get My Subjects (Legacy + New)
            const legacySubjects = Store.demoFilter('subjects', s => s.teacherId === user.id && s.isActive);
            const classSubjects = Store.demoFilter('class_subjects', cs => cs.teacherId === user.id && cs.isActive !== false);

            const subjectIds = legacySubjects.map(s => s.id);
            const classSubjectIds = classSubjects.map(cs => cs.id);

            assignments = assignments.filter(a =>
                (a.classSubjectId && classSubjectIds.includes(a.classSubjectId)) ||
                (a.subjectId && subjectIds.includes(a.subjectId))
            );
        }

        if (params.subjectId) {
            assignments = assignments.filter(a => a.subjectId === params.subjectId || a.classSubjectId === params.subjectId);
        }

        if (params.classId) {
            const subjects = Store.demoFilter('subjects', s => s.classId === params.classId);
            const subjectIds = subjects.map(s => s.id);
            assignments = assignments.filter(a => subjectIds.includes(a.subjectId));
        }

        if (params.query) {
            const q = params.query.toLowerCase();
            assignments = assignments.filter(a => a.title.toLowerCase().includes(q));
        }

        assignments = assignments.map(a => {
            const subject = Store.demoFind('subjects', s => s.id === a.subjectId);
            return { ...a, subjectName: subject?.name };
        });

        const sorted = Utils.sortBy(assignments, 'createdAt', params.sort === 'oldest' ? 'asc' : 'desc');
        const paginated = Utils.paginate(sorted, params.page || 1, params.pageSize || 10);

        return { success: true, data: paginated };
    },

    demoGetAssignment(params) {
        const assignment = Store.demoFind('assignments', a => a.id === params.assignmentId);
        if (!assignment) {
            return { success: false, error: 'ไม่พบงาน' };
        }
        const subject = Store.demoFind('subjects', s => s.id === assignment.subjectId);
        return { success: true, data: { ...assignment, subjectName: subject?.name } };
    },

    // ===== Demo Submissions =====
    demoSubmitHomework(params) {
        const user = Store.getUser();
        if (!user || user.role !== 'student') {
            return { success: false, error: 'ไม่มีสิทธิ์ดำเนินการ' };
        }

        const assignment = Store.demoFind('assignments', a => a.id === params.assignmentId);
        if (!assignment) {
            return { success: false, error: 'ไม่พบงาน' };
        }

        const existing = Store.demoFilter('submissions', s =>
            s.assignmentId === params.assignmentId && s.studentId === user.id
        );
        const version = existing.length + 1;
        const isLate = new Date() > new Date(assignment.dueDate);

        const submission = {
            id: Utils.generateId(),
            assignmentId: params.assignmentId,
            studentId: user.id,
            submittedAt: new Date().toISOString(),
            text: params.text || '',
            link: params.link || '',
            filesJSON: JSON.stringify(params.files || []),
            status: isLate ? 'LATE_SUBMISSION' : 'SUBMITTED',
            version,
            parentSubmissionId: existing.length > 0 ? existing[existing.length - 1].id : null
        };

        Store.demoAdd('submissions', submission);
        return { success: true, data: submission };
    },

    demoGetSubmission(params) {
        const user = Store.getUser();
        if (!user) return { success: false, error: 'ไม่ได้เข้าสู่ระบบ' };

        const submission = Store.demoFind('submissions', s => s.id === params.submissionId);
        if (!submission) {
            return { success: false, error: 'ไม่พบงานส่งนี้' };
        }

        const assignment = Store.demoFind('assignments', a => a.id === submission.assignmentId);
        if (!assignment) {
            return { success: false, error: 'ไม่พบงานต้นทาง' };
        }

        // Check Permissions
        let hasAccess = false;

        if (user.role === 'teacher') {
            // Check Ownership for teacher
            if (assignment.classSubjectId) {
                const cs = Store.demoFind('class_subjects', c => c.id === assignment.classSubjectId);
                if (cs && cs.teacherId === user.id) hasAccess = true;
            } else if (assignment.subjectId) {
                const s = Store.demoFind('subjects', s => s.id === assignment.subjectId);
                if (s && s.teacherId === user.id) hasAccess = true;
            }
        } else if (user.role === 'student') {
            // Check Ownership for student
            if (submission.studentId === user.id) hasAccess = true;
        }

        if (!hasAccess) {
            return { success: false, error: 'ไม่มีสิทธิ์เข้าถึงงานส่งนี้' };
        }

        const student = Store.demoFind('users', u => u.id === submission.studentId);
        const grade = Store.demoFind('grades', g => g.submissionId === submission.id);

        return {
            success: true,
            data: {
                ...submission,
                assignment,
                studentName: student?.name || 'Unknown',
                grade
            }
        };
    },

    demoListSubmissionsByAssignment(params) {
        const user = Store.getUser();
        if (!user || user.role !== 'teacher') {
            return { success: false, error: 'ไม่มีสิทธิ์ดำเนินการ' };
        }

        // ตรวจสอบ Ownership
        const assignment = Store.demoFind('assignments', a => a.id === params.assignmentId && a.isActive);
        if (!assignment) {
            return { success: false, error: 'ไม่พบงาน' };
        }

        let hasAccess = false;

        // 1. Check New System (Class Subject)
        if (assignment.classSubjectId) {
            const classSubject = Store.demoFind('class_subjects', cs => cs.id === assignment.classSubjectId);
            if (classSubject && classSubject.teacherId === user.id) {
                hasAccess = true;
            }
        }
        // 2. Check Legacy System (Subject)
        else if (assignment.subjectId) {
            const subject = Store.demoFind('subjects', s => s.id === assignment.subjectId);
            if (subject && subject.teacherId === user.id) {
                hasAccess = true;
            }
        }

        if (!hasAccess) {
            return { success: false, error: 'ไม่มีสิทธิ์ดูงานส่งในวิชานี้ (วิชาไม่ใช่ของคุณ)' };
        }

        let submissions = Store.demoFilter('submissions', s => s.assignmentId === params.assignmentId);

        submissions = submissions.map(s => {
            const student = Store.demoFind('users', u => u.id === s.studentId);
            const grade = Store.demoFind('grades', g => g.submissionId === s.id);
            return { ...s, studentName: student?.name, grade };
        });

        if (params.statusFilter) {
            submissions = submissions.filter(s => s.status === params.statusFilter);
        }

        if (params.query) {
            const q = params.query.toLowerCase();
            submissions = submissions.filter(s => s.studentName?.toLowerCase().includes(q));
        }

        const paginated = Utils.paginate(submissions, params.page || 1, params.pageSize || 10);
        return { success: true, data: paginated };
    },

    demoListSubmissionsByStudent(params) {
        const studentId = params.studentId || Store.getUser()?.id;
        let submissions = Store.demoFilter('submissions', s => s.studentId === studentId);

        submissions = submissions.map(s => {
            const assignment = Store.demoFind('assignments', a => a.id === s.assignmentId);
            const grade = Store.demoFind('grades', g => g.submissionId === s.id);
            return { ...s, assignment, grade };
        });

        const paginated = Utils.paginate(submissions, params.page || 1, params.pageSize || 10);
        return { success: true, data: paginated };
    },

    demoRequestRevision(params) {
        const user = Store.getUser();
        if (!user || user.role !== 'teacher') {
            return { success: false, error: 'ไม่มีสิทธิ์ดำเนินการ' };
        }

        Store.demoUpdate('submissions', params.submissionId, {
            status: 'REVISION_REQUESTED',
            revisionReason: params.reason
        });

        return { success: true };
    },

    // ===== Demo Grading =====
    demoGradeHomework(params) {
        const user = Store.getUser();
        if (!user || user.role !== 'teacher') {
            return { success: false, error: 'ไม่มีสิทธิ์ดำเนินการ' };
        }

        // ตรวจสอบ Ownership
        const submission = Store.demoFind('submissions', s => s.id === params.submissionId);
        if (!submission) {
            return { success: false, error: 'ไม่พบงานที่ส่ง' };
        }

        const assignment = Store.demoFind('assignments', a => a.id === submission.assignmentId);
        if (!assignment) {
            return { success: false, error: 'ไม่พบงาน' };
        }

        // Check Ownership
        let hasAccess = false;
        if (assignment.classSubjectId) {
            const cs = Store.demoFind('class_subjects', c => c.id === assignment.classSubjectId);
            if (cs && cs.teacherId === user.id) hasAccess = true;
        } else if (assignment.subjectId) {
            const s = Store.demoFind('subjects', s => s.id === assignment.subjectId);
            if (s && s.teacherId === user.id) hasAccess = true;
        }

        if (!hasAccess) {
            return { success: false, error: 'ไม่มีสิทธิ์ให้คะแนนงานในวิชานี้ (วิชาไม่ใช่ของคุณ)' };
        }

        const grade = {
            id: Utils.generateId(),
            submissionId: params.submissionId,
            teacherId: user.id,
            score: params.score,
            feedback: params.feedback || '',
            rubricScoreJSON: JSON.stringify(params.rubricScore || []),
            gradedAt: new Date().toISOString(),
            status: 'GRADED'
        };

        Store.demoAdd('grades', grade);
        Store.demoUpdate('submissions', params.submissionId, { status: 'GRADED' });

        return { success: true, data: grade };
    },

    demoGetStudentGrades(params) {
        const studentId = params.studentId || Store.getUser()?.id;
        const submissions = Store.demoFilter('submissions', s => s.studentId === studentId);

        const grades = submissions.map(s => {
            const assignment = Store.demoFind('assignments', a => a.id === s.assignmentId);
            const grade = Store.demoFind('grades', g => g.submissionId === s.id);
            const subject = assignment ? Store.demoFind('subjects', sub => sub.id === assignment.subjectId) : null;

            return {
                submission: s,
                assignment,
                grade,
                subjectName: subject?.name
            };
        });

        return { success: true, data: grades };
    },

    // ===== Demo Parent =====
    demoParentLink(params) {
        const user = Store.getUser();
        if (!user || user.role !== 'parent') {
            return { success: false, error: 'ไม่มีสิทธิ์ดำเนินการ' };
        }

        const linkCode = params.linkCode.trim().toUpperCase();
        const students = Store.demoFilter('users', u => u.role === 'student' && u.isActive);

        const targetStudent = students.find(s => {
            // Generate expected code for this student
            const code = 'STU' + s.id.slice(-4).toUpperCase();
            return code === linkCode;
        });

        if (!targetStudent) {
            return { success: false, error: 'ไม่พบรหัสเชื่อมโยงนี้ (ตรวจสอบรหัสอีกครั้ง)' };
        }

        // Check if already linked
        const existing = Store.demoFind('parents', p =>
            p.parentId === user.id && p.studentId === targetStudent.id && p.isActive
        );

        if (existing) {
            return { success: false, error: 'คุณเชื่อมต่อกับนักเรียนคนนี้อยู่แล้ว' };
        }

        // Create Link
        const newLink = {
            id: Utils.generateId(),
            parentId: user.id,
            studentId: targetStudent.id,
            relation: 'ผู้ปกครอง', // Default
            createdAt: new Date().toISOString(),
            isActive: true
        };

        Store.demoAdd('parents', newLink);
        return { success: true, data: { studentName: targetStudent.name } };
    },

    demoParentUnlink(params) {
        const user = Store.getUser();
        if (!user || user.role !== 'parent') {
            return { success: false, error: 'ไม่มีสิทธิ์ดำเนินการ' };
        }

        const existingLink = Store.demoFind('parents', p =>
            p.parentId === user.id && p.studentId === params.studentId && p.isActive
        );

        if (!existingLink) {
            return { success: false, error: 'ไม่พบการเชื่อมต่อ' };
        }

        Store.demoUpdate('parents', existingLink.id, { isActive: false });
        return { success: true };
    },

    demoGetLinkedStudents(params) {
        const user = Store.getUser();
        if (!user || user.role !== 'parent') {
            return { success: false, error: 'ไม่มีสิทธิ์ดำเนินการ' };
        }

        const links = Store.demoFilter('parents', p => p.parentId === user.id && p.isActive);
        const students = links.map(l => {
            const student = Store.demoFind('users', u => u.id === l.studentId);
            return student ? { id: student.id, name: student.name, relation: l.relation } : null;
        }).filter(Boolean);

        return { success: true, data: students };
    },

    demoParentGetGrades(params) {
        const user = Store.getUser();
        if (!user || user.role !== 'parent') {
            return { success: false, error: 'ไม่มีสิทธิ์ดำเนินการ' };
        }

        const link = Store.demoFind('parents', p =>
            p.parentId === user.id && p.studentId === params.studentId && p.isActive
        );
        if (!link) {
            return { success: false, error: 'ไม่มีสิทธิ์ดูข้อมูลนักเรียนนี้' };
        }

        return this.demoGetStudentGrades({ studentId: params.studentId });
    },

    // ===== Demo Notifications =====
    demoListNotifications(params) {
        const user = Store.getUser();
        if (!user) return { success: false, error: 'ไม่ได้เข้าสู่ระบบ' };

        const notifications = Store.demoFilter('notifications', n => n.userId === user.id);
        const sorted = Utils.sortBy(notifications, 'createdAt', 'desc');
        const paginated = Utils.paginate(sorted, params.page || 1, params.pageSize || 20);

        return { success: true, data: paginated };
    },

    demoMarkRead(params) {
        Store.demoUpdate('notifications', params.notificationId, { readAt: new Date().toISOString() });
        return { success: true };
    },

    // ===== Demo Admin =====
    demoListUsers(params) {
        const user = Store.getUser();
        if (!user || user.role !== 'admin') {
            return { success: false, error: 'ไม่มีสิทธิ์ดำเนินการ' };
        }

        let users = Store.demoFilter('users', u => true);

        if (params.query) {
            const q = params.query.toLowerCase();
            users = users.filter(u => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
        }

        if (params.roleFilter) {
            users = users.filter(u => u.role === params.roleFilter);
        }

        const safeUsers = users.map(u => ({
            id: u.id, name: u.name, email: u.email, role: u.role, isActive: u.isActive, createdAt: u.createdAt
        }));

        const paginated = Utils.paginate(safeUsers, params.page || 1, params.pageSize || 20);
        return { success: true, data: paginated };
    },

    demoUpdateUser(params) {
        const user = Store.getUser();
        if (!user || user.role !== 'admin') {
            return { success: false, error: 'ไม่มีสิทธิ์ดำเนินการ' };
        }

        const updates = {};
        if (params.name) updates.name = params.name;
        if (params.role) updates.role = params.role;
        if (typeof params.isActive === 'boolean') updates.isActive = params.isActive;

        Store.demoUpdate('users', params.userId, updates);
        return { success: true };
    },

    demoGetAuditLogs(params) {
        const user = Store.getUser();
        if (!user || user.role !== 'admin') {
            return { success: false, error: 'ไม่มีสิทธิ์ดำเนินการ' };
        }

        const logs = Store.demoFilter('audit_logs', l => true);
        const sorted = Utils.sortBy(logs, 'createdAt', 'desc');
        const paginated = Utils.paginate(sorted, params.page || 1, params.pageSize || 50);
        return { success: true, data: paginated };
    },

    demoBackupData(params) {
        const user = Store.getUser();
        if (!user || user.role !== 'admin') {
            return { success: false, error: 'ไม่มีสิทธิ์ดำเนินการ' };
        }

        const data = Store.getDemoData();
        return { success: true, data };
    },

    demoRestoreData(params) {
        const user = Store.getUser();
        if (!user || user.role !== 'admin') {
            return { success: false, error: 'ไม่มีสิทธิ์ดำเนินการ' };
        }

        Store.saveDemoData(params.data);
        return { success: true };
    },

    // ===== Demo Export =====
    demoExportGradesCSV(params) {
        const grades = this.demoGetStudentGrades({});
        return { success: true, data: grades.data };
    },

    demoExportMissingCSV(params) {
        const assignments = Store.demoFilter('assignments', a => a.isActive);
        const submissions = Store.demoFilter('submissions', s => true);

        const missing = [];
        assignments.forEach(a => {
            const subject = Store.demoFind('subjects', s => s.id === a.subjectId);
            if (!subject) return;

            const targetClass = Store.demoFind('classes', c => c.id === subject.classId);
            const enrollments = Store.demoFilter('enrollments', e => e.classId === subject.classId && e.isActive);

            enrollments.forEach(e => {
                const hasSubmission = submissions.some(s => s.assignmentId === a.id && s.studentId === e.studentId);
                if (!hasSubmission) {
                    const student = Store.demoFind('users', u => u.id === e.studentId);
                    missing.push({
                        className: targetClass?.name,
                        subjectName: subject.name,
                        assignmentTitle: a.title,
                        dueDate: a.dueDate,
                        studentName: student?.name
                    });
                }
            });
        });

        return { success: true, data: missing };
    },

    demoListStudents(params) {
        const students = Store.demoFilter('users', u => u.role === 'student' && u.isActive);

        if (params.classId) {
            const enrollments = Store.demoFilter('enrollments', e => e.classId === params.classId && e.isActive);
            const studentIds = enrollments.map(e => e.studentId);
            return { success: true, data: students.filter(s => studentIds.includes(s.id)) };
        }

        return { success: true, data: students };
    },

    // ===== Demo Subject Templates =====
    demoListSubjectTemplates(params) {
        // ดึงรายการวิชาที่ Admin เพิ่มในระบบ (public API ใช้ตอนสมัคร)
        const templates = Store.demoFilter('subject_templates', t => t.isActive);

        // จัดกลุ่มตาม category
        const grouped = {};
        templates.forEach(t => {
            if (!grouped[t.category]) {
                grouped[t.category] = [];
            }
            grouped[t.category].push(t);
        });

        return { success: true, data: { templates, grouped } };
    },

    // ===== Admin Subject Catalog Management =====
    demoListSubjectCatalog(params) {
        const user = Store.getUser();
        if (!user || user.role !== 'admin') {
            return { success: false, error: 'ไม่มีสิทธิ์ดำเนินการ', errorCode: 'FORBIDDEN' };
        }

        let catalog = Store.demoFilter('subject_catalog', c => c.isActive !== false);

        // Filter by query
        if (params.query) {
            const q = params.query.toLowerCase();
            catalog = catalog.filter(c =>
                c.subjectCode.toLowerCase().includes(q) ||
                c.subjectName.toLowerCase().includes(q)
            );
        }

        // Filter by levelGroup
        if (params.levelGroup) {
            catalog = catalog.filter(c => c.levelGroup === params.levelGroup);
        }

        // Filter by category
        if (params.category) {
            catalog = catalog.filter(c => c.category === params.category);
        }

        let sorted;
        if (params.sort === 'code') {
            sorted = Utils.sortBy(catalog, 'subjectCode', 'asc');
        } else {
            sorted = Utils.sortBy(catalog, 'createdAt', 'desc');
        }
        const paginated = Utils.paginate(sorted, params.page || 1, params.pageSize || 20);
        return { success: true, data: paginated };
    },

    demoCreateSubjectCatalog(params) {
        const user = Store.getUser();
        if (!user || user.role !== 'admin') {
            return { success: false, error: 'ไม่มีสิทธิ์ดำเนินการ', errorCode: 'FORBIDDEN' };
        }

        const { subjectCode, subjectName, levelGroup, category } = params;
        if (!subjectCode || !subjectName) {
            return { success: false, error: 'กรุณากรอกรหัสวิชาและชื่อวิชา' };
        }

        // Check unique subjectCode
        if (!Store.demoCheckUnique('subject_catalog', 'subjectCode', subjectCode)) {
            return { success: false, error: 'รหัสวิชานี้มีอยู่แล้วในระบบ' };
        }

        const newCatalog = {
            id: Utils.generateId(),
            subjectCode,
            subjectName,
            levelGroup: levelGroup || '',
            category: category || 'อื่นๆ',
            createdAt: new Date().toISOString(),
            isActive: true
        };

        Store.demoAdd('subject_catalog', newCatalog);
        return { success: true, data: newCatalog };
    },

    demoUpdateSubjectCatalog(params) {
        const user = Store.getUser();
        if (!user || user.role !== 'admin') {
            return { success: false, error: 'ไม่มีสิทธิ์ดำเนินการ', errorCode: 'FORBIDDEN' };
        }

        const { catalogId, subjectCode, subjectName, levelGroup, category, isActive } = params;

        // Check unique subjectCode if changed
        if (subjectCode && !Store.demoCheckUnique('subject_catalog', 'subjectCode', subjectCode, catalogId)) {
            return { success: false, error: 'รหัสวิชานี้มีอยู่แล้วในระบบ' };
        }

        const updates = {};
        if (subjectCode) updates.subjectCode = subjectCode;
        if (subjectName) updates.subjectName = subjectName;
        if (levelGroup !== undefined) updates.levelGroup = levelGroup;
        if (category !== undefined) updates.category = category;
        if (typeof isActive === 'boolean') updates.isActive = isActive;

        Store.demoUpdate('subject_catalog', catalogId, updates);
        return { success: true };
    },

    demoDeleteSubjectCatalog(params) {
        const user = Store.getUser();
        if (!user || user.role !== 'admin') {
            return { success: false, error: 'ไม่มีสิทธิ์ดำเนินการ', errorCode: 'FORBIDDEN' };
        }

        Store.demoUpdate('subject_catalog', params.catalogId, { isActive: false });
        return { success: true };
    },

    // ===== Admin Class Subjects Management =====
    demoListClassSubjects(params) {
        const user = Store.getUser();
        if (!user || (user.role !== 'admin' && user.role !== 'teacher')) {
            return { success: false, error: 'ไม่มีสิทธิ์ดำเนินการ', errorCode: 'FORBIDDEN' };
        }

        let classSubjects = Store.demoFilter('class_subjects', cs => cs.isActive !== false);

        // Filter by classId
        if (params.classId) {
            classSubjects = classSubjects.filter(cs => cs.classId === params.classId);
        }

        // For teacher, filter by teacherId (ownership)
        if (user.role === 'teacher') {
            classSubjects = classSubjects.filter(cs => cs.teacherId === user.id);
        }

        // Enrich with catalog and class data
        classSubjects = classSubjects.map(cs => {
            const catalog = Store.demoFind('subject_catalog', c => c.id === cs.catalogId);
            const classData = Store.demoFind('classes', c => c.id === cs.classId);
            const teacher = Store.demoFind('users', u => u.id === cs.teacherId);
            return {
                ...cs,
                subjectCode: catalog?.subjectCode || '',
                subjectName: catalog?.subjectName || '',
                category: catalog?.category || '',
                className: classData?.name || '',
                classLevel: classData?.level || '',
                teacherName: teacher?.name || ''
            };
        });

        const paginated = Utils.paginate(classSubjects, params.page || 1, params.pageSize || 50);
        return { success: true, data: paginated };
    },

    demoCreateClassSubject(params) {
        const user = Store.getUser();
        if (!user || user.role !== 'admin') {
            return { success: false, error: 'ไม่มีสิทธิ์ดำเนินการ', errorCode: 'FORBIDDEN' };
        }

        const { classId, catalogId, teacherId } = params;
        if (!classId || !catalogId) {
            return { success: false, error: 'กรุณาเลือกห้องเรียนและวิชา' };
        }

        // Check if this class-subject combination already exists
        const existing = Store.demoFind('class_subjects', cs =>
            cs.classId === classId && cs.catalogId === catalogId && cs.isActive !== false
        );
        if (existing) {
            return { success: false, error: 'วิชานี้ถูกเพิ่มในห้องนี้แล้ว' };
        }

        const newClassSubject = {
            id: Utils.generateId(),
            classId,
            catalogId,
            teacherId: teacherId || '',
            createdAt: new Date().toISOString(),
            isActive: true
        };

        Store.demoAdd('class_subjects', newClassSubject);
        return { success: true, data: newClassSubject };
    },

    demoUpdateClassSubject(params) {
        const user = Store.getUser();
        if (!user || user.role !== 'admin') {
            return { success: false, error: 'ไม่มีสิทธิ์ดำเนินการ', errorCode: 'FORBIDDEN' };
        }

        const { classSubjectId, teacherId, isActive } = params;

        const updates = {};
        if (teacherId !== undefined) updates.teacherId = teacherId;
        if (typeof isActive === 'boolean') updates.isActive = isActive;

        Store.demoUpdate('class_subjects', classSubjectId, updates);
        return { success: true };
    },

    demoDeleteClassSubject(params) {
        const user = Store.getUser();
        if (!user || user.role !== 'admin') {
            return { success: false, error: 'ไม่มีสิทธิ์ดำเนินการ', errorCode: 'FORBIDDEN' };
        }

        Store.demoUpdate('class_subjects', params.classSubjectId, { isActive: false });
        return { success: true };
    },

    demoAssignTeacherToClassSubject(params) {
        const user = Store.getUser();
        if (!user || user.role !== 'admin') {
            return { success: false, error: 'ไม่มีสิทธิ์ดำเนินการ', errorCode: 'FORBIDDEN' };
        }

        const { classSubjectId, teacherId } = params;
        if (!classSubjectId || !teacherId) {
            return { success: false, error: 'กรุณาเลือกวิชาและครูผู้สอน' };
        }

        // Verify teacher exists and is active
        const teacher = Store.demoFind('users', u => u.id === teacherId && u.role === 'teacher' && u.isActive);
        if (!teacher) {
            return { success: false, error: 'ไม่พบครูที่เลือก' };
        }

        Store.demoUpdate('class_subjects', classSubjectId, { teacherId });
        return { success: true };
    },

    // ===== Admin List Classes (for dropdown) =====
    demoAdminListClasses(params) {
        const user = Store.getUser();
        // Allow public access if explicitly requested (for registration), otherwise require admin
        if (!params.public && (!user || user.role !== 'admin')) {
            return { success: false, error: 'ไม่มีสิทธิ์ดำเนินการ', errorCode: 'FORBIDDEN' };
        }

        let classes = Store.demoFilter('classes', c => c.isActive !== false);

        if (params.query) {
            const q = params.query.toLowerCase();
            classes = classes.filter(c => c.name.toLowerCase().includes(q));
        }

        // Enrich with teacher name
        // Enrich with teacher name, term name
        classes = classes.map(c => {
            const teacher = Store.demoFind('users', u => u.id === c.teacherId || u.id === c.homeroomTeacherId);
            const term = Store.demoFind('terms', t => t.id === c.termId);
            return {
                ...c,
                teacherName: teacher?.name || '-',
                termName: term ? `${term.term}/${term.academicYear}` : '-'
            };
        });

        // Sorting Logic
        if (params.sort === 'name') {
            // Use centralized sorting logic
            classes.sort((a, b) => Utils.compareThaiLevels(a.name, b.name));
        } else {
            // Default: Sort by CreatedAt DESC (Newest First) for Admin Table
            classes.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        }

        const paginated = Utils.paginate(classes, params.page || 1, params.pageSize || 50);
        return { success: true, data: classes }; // Return array for simplicity consistent with usage
    },

    // ===== Admin List Teachers (for dropdown) =====
    demoListTeachers(params) {
        const user = Store.getUser();
        if (!user || user.role !== 'admin') {
            return { success: false, error: 'ไม่มีสิทธิ์ดำเนินการ', errorCode: 'FORBIDDEN' };
        }

        let teachers = Store.demoFilter('users', u => u.role === 'teacher' && u.isActive);

        if (params.query) {
            const q = params.query.toLowerCase();
            teachers = teachers.filter(t => t.name.toLowerCase().includes(q) || t.email.toLowerCase().includes(q));
        }

        const safeTeachers = teachers.map(t => ({
            id: t.id,
            name: t.name,
            email: t.email
        }));

        return { success: true, data: safeTeachers };
    },

    // ===== Teacher: List My Class Subjects =====
    demoListMyClassSubjects(params) {
        const user = Store.getUser();
        if (!user || user.role !== 'teacher') {
            return { success: false, error: 'ไม่มีสิทธิ์ดำเนินการ', errorCode: 'FORBIDDEN' };
        }

        // Get class_subjects where teacherId = current user
        let classSubjects = Store.demoFilter('class_subjects', cs =>
            cs.teacherId === user.id && cs.isActive !== false
        );

        // Filter by classId if provided
        if (params.classId) {
            classSubjects = classSubjects.filter(cs => cs.classId === params.classId);
        }

        // Enrich with catalog and class data
        classSubjects = classSubjects.map(cs => {
            const catalog = Store.demoFind('subject_catalog', c => c.id === cs.catalogId);
            const classData = Store.demoFind('classes', c => c.id === cs.classId);

            // Count assignments for this class_subject
            const assignments = Store.demoFilter('assignments', a =>
                a.classSubjectId === cs.id && a.isActive !== false
            );

            // Count students in this class
            const enrollments = Store.demoFilter('enrollments', e =>
                e.classId === cs.classId && e.isActive !== false
            );

            return {
                ...cs,
                subjectCode: catalog?.subjectCode || '',
                subjectName: catalog?.subjectName || '',
                category: catalog?.category || '',
                className: classData?.name || '',
                classLevel: classData?.level || '',
                assignmentCount: assignments.length,
                studentCount: enrollments.length
            };
        });

        // Sort by Class Level (ป.1->ม.6) then Subject Code
        classSubjects.sort((a, b) => {
            // Sort by Class Level first (using centralized logic)
            const levelDiff = Utils.compareThaiLevels(a.className, b.className);
            if (levelDiff !== 0) return levelDiff;

            // Then by Subject Code
            return (a.subjectCode || '').localeCompare(b.subjectCode || '');
        });

        const paginated = Utils.paginate(classSubjects, params.page || 1, params.pageSize || 50);
        return { success: true, data: paginated };
    },

    // ===== Create Assignment with Class Subject =====
    demoCreateAssignmentV2(params) {
        const user = Store.getUser();
        if (!user || user.role !== 'teacher') {
            return { success: false, error: 'ไม่มีสิทธิ์ดำเนินการ', errorCode: 'FORBIDDEN' };
        }

        const { classSubjectId, title, detail, dueDate, maxScore, rubric } = params;

        // Validate ownership
        const classSubject = Store.demoFind('class_subjects', cs =>
            cs.id === classSubjectId && cs.isActive !== false
        );

        if (!classSubject) {
            return { success: false, error: 'ไม่พบวิชา', errorCode: 'NOT_FOUND' };
        }

        if (classSubject.teacherId !== user.id) {
            return { success: false, error: 'ไม่มีสิทธิ์สร้างงานในวิชานี้ (วิชาไม่ใช่ของคุณ)', errorCode: 'FORBIDDEN' };
        }

        const newAssignment = {
            id: Utils.generateId(),
            classSubjectId,
            subjectId: '', // backward compat
            title,
            detail: detail || '',
            dueDate,
            maxScore: maxScore || 10,
            rubricJSON: JSON.stringify(rubric || []),
            filesJSON: '[]',
            createdAt: new Date().toISOString(),
            isActive: true
        };

        Store.demoAdd('assignments', newAssignment);
        return { success: true, data: newAssignment };
    },

    demoGetTeacherDashboardStats(params) {
        const user = Store.getUser();
        if (!user || user.role !== 'teacher') return { success: false, error: 'Access denied' };

        // 1. Get My Subjects (Legacy + New)
        const legacySubjects = Store.demoFilter('subjects', s => s.teacherId === user.id && s.isActive);
        const classSubjects = Store.demoFilter('class_subjects', cs => cs.teacherId === user.id && cs.isActive !== false);

        const subjectIds = legacySubjects.map(s => s.id);
        const classSubjectIds = classSubjects.map(cs => cs.id);
        const allClassIds = [...new Set([...legacySubjects.map(s => s.classId), ...classSubjects.map(cs => cs.classId)])].filter(Boolean);

        // 2. Get Assignments
        const assignments = Store.demoFilter('assignments', a =>
            (a.isActive !== false) && (
                (a.classSubjectId && classSubjectIds.includes(a.classSubjectId)) ||
                (a.subjectId && subjectIds.includes(a.subjectId))
            )
        );
        const assignmentIds = assignments.map(a => a.id);

        // 3. Get Submissions
        const submissions = Store.demoFilter('submissions', s => assignmentIds.includes(s.assignmentId));

        // 4. Calculate Stats
        const stats = {
            classesCount: allClassIds.length,
            assignmentsCount: assignments.length,
            pendingCount: submissions.filter(s => ['SUBMITTED', 'LATE_SUBMISSION'].includes(s.status)).length,
            gradedCount: submissions.filter(s => s.status === 'GRADED').length
        };

        // 5. Recent Pending
        let pending = submissions
            .filter(s => ['SUBMITTED', 'LATE_SUBMISSION'].includes(s.status))
            .map(s => {
                const assign = assignments.find(a => a.id === s.assignmentId);
                const student = Store.demoFind('users', u => u.id === s.studentId);
                let subjectName = '';

                if (assign.classSubjectId) {
                    const cs = classSubjects.find(c => c.id === assign.classSubjectId);
                    if (cs) {
                        const catalog = Store.demoFind('subject_catalog', c => c.id === cs.catalogId);
                        subjectName = catalog ? catalog.subjectName : 'Unknown';
                    }
                } else {
                    const subj = legacySubjects.find(sub => sub.id === assign.subjectId);
                    subjectName = subj ? subj.name : 'Unknown';
                }

                return {
                    id: s.id,
                    studentName: student ? student.name : 'Unknown Student',
                    assignmentTitle: assign ? assign.title : 'Unknown Assignment',
                    subjectName,
                    submittedAt: s.submittedAt
                };
            })
            // Sort by submittedAt desc (newest first)
            .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))
            .slice(0, 10);

        return { success: true, data: { stats, recentPending: pending } };
    },

    demoGetStudentDashboardStats(params) {
        const user = Store.getUser();
        if (!user || user.role !== 'student') return { success: false, error: 'Access denied' };

        // 1. Get Student Classes
        const allClasses = Store.getDemoData().classes || [];
        let myClasses = [];
        if (user.primaryClassId) {
            myClasses = allClasses.filter(c => c.id === user.primaryClassId && c.isActive);
        } else {
            const enrollments = Store.demoFilter('enrollments', e => e.studentId === user.id && e.isActive);
            const classIds = enrollments.map(e => e.classId);
            myClasses = allClasses.filter(c => classIds.includes(c.id) && c.isActive);
        }
        const classIds = myClasses.map(c => c.id);

        // 2. Get Subjects (Legacy + New Class Subjects)
        // Legacy
        const legacySubjects = Store.demoFilter('subjects', s => classIds.includes(s.classId) && s.isActive);
        // New Class Subjects
        const classSubjects = Store.demoFilter('class_subjects', cs => classIds.includes(cs.classId) && cs.isActive !== false);

        // 3. Get Assignments
        // Map assignments to subjects
        const legacySubjectIds = legacySubjects.map(s => s.id);
        const classSubjectIds = classSubjects.map(cs => cs.id);

        const assignments = Store.demoFilter('assignments', a =>
            a.isActive && (
                (a.subjectId && legacySubjectIds.includes(a.subjectId)) ||
                (a.classSubjectId && classSubjectIds.includes(a.classSubjectId))
            )
        );

        // 4. Get Submissions
        const mySubmissions = Store.demoFilter('submissions', s => s.studentId === user.id);

        // 5. Calculate Stats
        const submittedAssignmentIds = mySubmissions.map(s => s.assignmentId);

        const pendingAssignments = assignments.filter(a => !submittedAssignmentIds.includes(a.id));
        const gradedSubmissions = mySubmissions.filter(s => s.status === 'GRADED');

        const stats = {
            classesCount: myClasses.length,
            assignmentsCount: assignments.length,
            pendingCount: pendingAssignments.length,
            gradedCount: gradedSubmissions.length
        };

        // 6. Upcoming: Pending assignments not past due, sorted by due date
        const upcoming = pendingAssignments
            .filter(a => !Utils.isPastDue(a.dueDate))
            .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
            .slice(0, 5)
            .map(a => {
                let subjectName = '';
                if (a.classSubjectId) {
                    const cs = classSubjects.find(c => c.id === a.classSubjectId);
                    const cat = cs ? Store.demoFind('subject_catalog', cat => cat.id === cs.catalogId) : null;
                    subjectName = cat ? cat.subjectName : 'Unknown';
                } else {
                    const s = legacySubjects.find(sub => sub.id === a.subjectId);
                    subjectName = s ? s.name : 'Unknown';
                }
                return {
                    id: a.id,
                    title: a.title,
                    subjectName,
                    dueDate: a.dueDate
                };
            });

        // 7. Recent Grades: Graded submissions sorted by gradedAt
        const recentGrades = gradedSubmissions
            .sort((a, b) => {
                const gradeA = Store.demoFind('grades', g => g.submissionId === a.id);
                const gradeB = Store.demoFind('grades', g => g.submissionId === b.id);
                const dateA = gradeA?.gradedAt || a.submittedAt;
                const dateB = gradeB?.gradedAt || b.submittedAt;
                return new Date(dateB) - new Date(dateA);
            })
            .slice(0, 5)
            .map(s => {
                const assign = assignments.find(a => a.id === s.assignmentId);
                const grade = Store.demoFind('grades', g => g.submissionId === s.id);
                return {
                    id: s.id,
                    assignmentTitle: assign ? assign.title : 'Unknown Assignment',
                    score: grade ? grade.score : '-',
                    maxScore: assign ? assign.maxScore : '-',
                    feedback: grade ? grade.feedback : ''
                };
            });

        return { success: true, data: { stats, upcoming, recentGrades } };
    },

    demoGetGradebookData(params) {
        const user = Store.getUser();
        if (!user || user.role !== 'teacher') return { success: false, error: 'Access denied' };

        // 1. Identify relevant classes and subjects
        const allClasses = Store.getDemoData().classes || [];

        // Homeroom
        const homeroomIds = allClasses.filter(c => c.teacherId === user.id).map(c => c.id);
        // Legacy Subjects
        const legacySubjects = Store.demoFilter('subjects', s => s.teacherId === user.id && s.isActive);
        // Class Subjects
        const classSubjects = Store.demoFilter('class_subjects', cs => cs.teacherId === user.id && cs.isActive !== false);

        // Map classId -> list of subjects (unified structure)
        const classMap = {};

        // Helper to add to map
        const addSubjectToClass = (classId, subject) => {
            if (!classMap[classId]) classMap[classId] = { subjects: [] };
            classMap[classId].subjects.push(subject);
        };

        legacySubjects.forEach(s => addSubjectToClass(s.classId, { id: s.id, name: s.name, type: 'legacy' }));
        classSubjects.forEach(cs => {
            const catalog = Store.demoFind('subject_catalog', c => c.id === cs.catalogId);
            addSubjectToClass(cs.classId, { id: cs.id, name: catalog ? catalog.subjectName : 'Unknown', type: 'class_subject' });
        });

        // Also include Homeroom classes even if no subjects yet (to show empty table)
        homeroomIds.forEach(id => {
            if (!classMap[id]) classMap[id] = { subjects: [] };
        });

        const result = [];

        // 2. Build data for each class
        for (const classId of Object.keys(classMap)) {
            const cls = allClasses.find(c => c.id === classId);
            if (!cls || !cls.isActive) continue;

            // Get Students
            let students = [];
            if (cls.students) {
                // If students are embedded
                students = cls.students;
            } else {
                // Fallback if utilizing enrollments
                const enrollments = Store.demoFilter('enrollments', e => e.classId === classId && e.isActive);
                students = enrollments.map(e => Store.demoFind('users', u => u.id === e.studentId)).filter(Boolean);
            }
            students = students.map(s => ({ id: s.id, name: s.name })); // minimal info

            // Process Subjects
            const subjectsData = [];
            for (const sub of classMap[classId].subjects) {
                // Get Assignments
                let assignments = [];
                if (sub.type === 'legacy') {
                    assignments = Store.demoFilter('assignments', a => a.subjectId === sub.id && a.isActive);
                } else {
                    assignments = Store.demoFilter('assignments', a => a.classSubjectId === sub.id && a.isActive);
                }

                const totalMaxScore = assignments.reduce((sum, a) => sum + (parseInt(a.maxScore) || 0), 0);
                const assignmentIds = assignments.map(a => a.id);

                // Get Submissions for these assignments
                // Optimization: Get ALL submissions for these assignments in one go
                const submissions = Store.demoFilter('submissions', s => assignmentIds.includes(s.assignmentId) && s.status === 'GRADED');

                const studentScores = {};
                submissions.forEach(s => {
                    const grade = Store.demoFind('grades', g => g.submissionId === s.id);
                    if (grade) {
                        studentScores[s.studentId] = (studentScores[s.studentId] || 0) + (parseInt(grade.score) || 0);
                    }
                });

                subjectsData.push({
                    id: sub.id,
                    name: sub.name,
                    totalMaxScore,
                    studentScores
                });
            }

            result.push({
                classId: cls.id,
                className: cls.name,
                students,
                subjects: subjectsData
            });
        }

        return { success: true, data: result };
    },

    // ===== List Assignments by Class Subject (Teacher) =====
    demoListAssignmentsByClassSubject(params) {
        const user = Store.getUser();
        if (!user || user.role !== 'teacher') {
            return { success: false, error: 'ไม่มีสิทธิ์ดำเนินการ', errorCode: 'FORBIDDEN' };
        }

        const { classSubjectId } = params;

        // Validate ownership
        const classSubject = Store.demoFind('class_subjects', cs =>
            cs.id === classSubjectId && cs.isActive !== false
        );

        if (!classSubject) {
            return { success: false, error: 'ไม่พบวิชา', errorCode: 'NOT_FOUND' };
        }

        if (classSubject.teacherId !== user.id) {
            return { success: false, error: 'ไม่มีสิทธิ์ดูงานในวิชานี้ (วิชาไม่ใช่ของคุณ)', errorCode: 'FORBIDDEN' };
        }

        let assignments = Store.demoFilter('assignments', a =>
            a.classSubjectId === classSubjectId && a.isActive !== false
        );

        // Add submission stats
        assignments = assignments.map(a => {
            const submissions = Store.demoFilter('submissions', s => s.assignmentId === a.id);
            const graded = submissions.filter(s => s.status === 'GRADED').length;
            return {
                ...a,
                submissionCount: submissions.length,
                gradedCount: graded
            };
        });

        const sorted = Utils.sortBy(assignments, 'createdAt', 'desc');
        const paginated = Utils.paginate(sorted, params.page || 1, params.pageSize || 20);
        return { success: true, data: paginated };
    },

    // ===== Subject Templates (Mock) =====
    demoListSubjectTemplates(params) {
        // Fetch from Store (Admin Catalog)
        let catalog = Store.demoFilter('subject_catalog', s => s.isActive !== false);

        // Fallback if empty (Initial Demo State)
        if (catalog.length === 0) {
            catalog = [
                { id: 'th', subjectName: 'ภาษาไทย', category: 'ภาษา' },
                { id: 'en', subjectName: 'ภาษาอังกฤษ', category: 'ภาษา' },
                { id: 'ma', subjectName: 'คณิตศาสตร์', category: 'วิทย์-คณิต' },
                { id: 'sci', subjectName: 'วิทยาศาสตร์', category: 'วิทย์-คณิต' },
                { id: 'soc', subjectName: 'สังคมศึกษา', category: 'สังคม' },
                { id: 'his', subjectName: 'ประวัติศาสตร์', category: 'สังคม' },
                { id: 'pe', subjectName: 'สุขศึกษาและพละ', category: 'สุขศึกษา-พละ' },
                { id: 'art', subjectName: 'ศิลปะ/ดนตรี', category: 'ศิลปะ' },
                { id: 'work', subjectName: 'การงานอาชีพ', category: 'การงาน' }
            ].map(s => ({ ...s, name: s.subjectName })); // Map for compatibility if needed
        }

        // Normalize data structure (subjectName -> name) for frontend component
        const allSubjects = catalog.map(s => ({
            id: s.id,
            name: s.subjectName || s.name, // Support both fields
            category: s.category || 'อื่นๆ'
        }));

        const grouped = {};
        allSubjects.forEach(s => {
            if (!grouped[s.category]) grouped[s.category] = [];
            grouped[s.category].push(s);
        });

        // Sort categories to put main ones first
        const categoryOrder = ['ภาษา', 'วิทย์-คณิต', 'สังคม', 'วิทยาศาสตร์', 'คณิตศาสตร์', 'สุขศึกษา-พละ'];
        const sortedGrouped = {};

        // Add ordered keys first
        categoryOrder.forEach(key => {
            if (grouped[key]) {
                sortedGrouped[key] = grouped[key];
                delete grouped[key];
            }
        });

        // Add remaining keys
        Object.keys(grouped).forEach(key => {
            sortedGrouped[key] = grouped[key];
        });

        return {
            success: true,
            data: {
                templates: allSubjects,
                grouped: sortedGrouped
            }
        };
    },

    demoUpdateAssignment(params) {
        const user = Store.getUser();
        if (!user || user.role !== 'teacher') return { success: false, error: 'ไม่มีสิทธิ์' };

        const updates = {};
        if (params.title) updates.title = params.title;
        if (params.detail !== undefined) updates.detail = params.detail;
        if (params.dueDate) updates.dueDate = params.dueDate;
        if (params.maxScore) updates.maxScore = params.maxScore;
        if (typeof params.isActive === 'boolean') updates.isActive = params.isActive;

        const updated = Store.demoUpdate('assignments', params.assignmentId, updates);
        if (!updated) return { success: false, error: 'ไม่พบงาน' };

        return { success: true, data: updated };
    },

    demoDeleteAssignment(params) {
        const user = Store.getUser();
        if (!user || user.role !== 'teacher') return { success: false, error: 'ไม่มีสิทธิ์' };
        Store.demoUpdate('assignments', params.assignmentId, { isActive: false });
        return { success: true };
    },

    // ===== Terms (Mock/DB) =====
    demoListTerms(params) {
        let terms = Store.getDemoData().terms || [];

        // ถ้าไม่มีข้อมูล หรือบังคับใช้ปีปัจจุบันตาม Req
        // เพื่อความชัวร์ สร้าง Dummy Data ปีปัจจุบันให้เลย ถ้าระบบ Mock Data ไม่มีเหมาะสม
        // แต่ถ้ามีใน Store แล้ว ให้ใช้อันนั้น (Admin สร้างเองได้) 
        // แต่ Demo เริ่มต้น ควรเป็นปีปัจจุบัน
        if (terms.length === 0) {
            const today = new Date();
            const thaiYear = today.getFullYear() + 543;

            terms = [
                { id: `term_${thaiYear}_1`, term: '1', academicYear: String(thaiYear), isActive: true },
                { id: `term_${thaiYear}_2`, term: '2', academicYear: String(thaiYear), isActive: true }
            ];
        }

        const activeTerms = terms.filter(t => t.isActive !== false);
        // Sort: Year DESC, Term ASC
        activeTerms.sort((a, b) => {
            if (b.academicYear !== a.academicYear) return b.academicYear - a.academicYear;
            return a.term.localeCompare(b.term);
        });

        return { success: true, data: activeTerms };
    },

    // ===== Admin Room Management Implementation =====
    demoAdminCreateClass(params) {
        const user = Store.getUser();
        if (!user || user.role !== 'admin') return { success: false, error: 'ไม่มีสิทธิ์' };

        // Generate Room Code
        let code;
        do {
            code = 'ROOM' + Math.floor(1000 + Math.random() * 9000);
        } while (Store.demoFind('classes', c => c.roomJoinCode === code));

        const newClass = {
            id: Utils.generateId(),
            level: params.level,
            room: params.room,
            termId: params.termId,
            name: `${params.level}/${params.room}`,
            homeroomTeacherId: params.homeroomTeacherId || '',
            roomJoinCode: code,
            createdAt: new Date().toISOString(),
            isActive: true
        };
        Store.demoAdd('classes', newClass);
        return { success: true, data: newClass };
    },

    demoAdminUpdateClass(params) {
        const user = Store.getUser();
        if (!user || user.role !== 'admin') return { success: false, error: 'ไม่มีสิทธิ์' };

        const updates = {};
        if (params.level) updates.level = params.level;
        if (params.room) updates.room = params.room;
        if (params.level && params.room) updates.name = `${params.level}/${params.room}`;
        if (params.termId) updates.termId = params.termId;
        if (params.homeroomTeacherId !== undefined) updates.homeroomTeacherId = params.homeroomTeacherId;

        const updated = Store.demoUpdate('classes', params.classId, updates);
        if (!updated) return { success: false, error: 'ไม่พบห้องเรียน' };

        return { success: true, data: updated };
    },

    demoAdminDeleteClass(params) {
        const user = Store.getUser();
        if (!user || user.role !== 'admin') return { success: false, error: 'ไม่มีสิทธิ์' };

        Store.demoUpdate('classes', params.classId, { isActive: false });
        return { success: true };
    },

    // ===== DATA SYNC TOOL =====
    async syncDemoToCloud() {
        if (!confirm('คุณต้องการอัปโหลดข้อมูล Demo ทั้งหมดขึ้น Google Sheet หรือไม่? (ข้อมูลซ้ำอาจถูกสร้างเพิ่ม)')) return;

        console.log('Starting Sync...');
        const data = Store.getDemoData() || Store.createInitialDemoData();
        const results = { success: 0, fail: 0 };
        const total = Object.values(data).flat().length;
        let count = 0;

        // Helper to delay (avoid rate limit)
        const delay = ms => new Promise(r => setTimeout(r, ms));

        // 1. Users
        for (const user of data.users) {
            console.log(`Syncing User: ${user.name}`);
            const res = await this.apiRequest('register', { ...user, password: 'password123' }); // Reset password for safety
            if (res.success) results.success++; else results.fail++;
            count++;
            await delay(500);
        }

        // 2. Subject Catalog
        for (const cat of data.subject_catalog) {
            console.log(`Syncing Catalog: ${cat.subjectCode}`);
            const res = await this.apiRequest('createSubjectCatalog', cat);
            if (res.success) results.success++; else results.fail++;
            count++;
            await delay(500);
        }

        // 3. Classes
        for (const cls of data.classes) {
            console.log(`Syncing Class: ${cls.name}`);
            const res = await this.apiRequest('adminCreateClass', cls);
            if (res.success) results.success++; else results.fail++;
            count++;
            await delay(500);
        }

        // 4. Terms
        for (const term of (data.terms || [])) {
            console.log(`Syncing Term: ${term.term}/${term.academicYear}`);
            // Need API endpoint for Create Term if not exists, assuming Admin can do simpler actions
            // OR Just skip terms for now if no API
        }

        // 5. Class Subjects (Assignments)
        for (const cs of data.class_subjects) {
            console.log(`Syncing Assignment: Class ${cs.classId} - Catalog ${cs.catalogId}`);
            const res = await this.apiRequest('createClassSubject', cs);
            if (res.success) results.success++; else results.fail++;
            count++;
            await delay(500);
        }

        alert(`Sync Completed!\nSuccess: ${results.success}\nFailed: ${results.fail}\nตรวจสอบ Google Sheet ของคุณได้เลย`);
        console.log('Sync System Finished', results);
    }
};

window.API = API;
