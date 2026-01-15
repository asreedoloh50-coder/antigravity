/**
 * ==========================================
 * Smart School Backend (Google Apps Script)
 * ==========================================
 * วิธีติดตั้ง:
 * 1. ไปที่ https://script.google.com/
 * 2. สร้างโปรเจกต์ใหม่ หรือใช้โปรเจกต์เดิมที่มี URL แล้ว
 * 3. ลบโค้ดเก่าทั้งหมด แล้ววางโค้ดนี้แทนที่
 * 4. กด Save (Icon แผ่นดิสก์)
 * 5. กด Deploy > New deployment
 *    - Select type: Web app
 *    - Description: Version 3 (Full DB & Fixes)
 *    - Execute as: Me (ตัวคุณเอง)
 *    - Who has access: Anyone (ทุกคน) **สำคัญมาก**
 * 6. Copy URL ที่ได้ ไปใส่ในไฟล์ js/api.js ที่ตัวแปร BASE_URL
 */

// ===== CONFIG =====
// ===== CONFIG =====
const SPREADSHEET_ID = ''; // Leave empty to AUTO-CREATE a new Sheet for this project

/**
 * Return the Spreadsheet object.
 */
function getDB() {
  if (SPREADSHEET_ID) {
    try {
      return SpreadsheetApp.openById(SPREADSHEET_ID);
    } catch (e) {
      console.warn('Cannot open hardcoded ID, falling back to auto-create:', e);
    }
  }
  const props = PropertiesService.getScriptProperties();
  let id = props.getProperty('DB_SPREADSHEET_ID');
  if (id) {
    try {
      return SpreadsheetApp.openById(id);
    } catch(e) {
      // ID invalid or deleted, create new
    }
  }
  const ss = SpreadsheetApp.create('SmartSchoolDB');
  props.setProperty('DB_SPREADSHEET_ID', ss.getId());
  // Setup default sheets immediately
  setupSheets(ss);
  return ss;
}

function setupSheets(ss) {
    const sheets = ['Users', 'Sessions', 'Classes', 'SubjectCatalog', 'ClassSubjects', 'Enrollments', 'Assignments', 'Submissions', 'Grades', 'Parents', 'Notifications', 'Terms', 'AuditLogs'];
    sheets.forEach(s => {
        let sheet = ss.getSheetByName(s);
        if(!sheet) ss.insertSheet(s);
    });
}

// ===== MAIN HANDLERS =====

function doGet(e) {
  if (e && e.parameter && e.parameter.action === 'debugInfo') {
    const ss = getDB();
    const result = { success:true, url: ss.getUrl(), sheets: ss.getSheets().map(s=>s.getName()) };
    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
  }
  if (e && e.parameter && e.parameter.action === 'testPopulate') {
    const result = testPopulateData();
    // Redirect to the sheet for convenience
    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
  }
  if (e && e.parameter && e.parameter.action === 'setupBackup') {
    const result = setupBackupTrigger();
    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
  }
}

// ===== AUTOMATED BACKUP =====
function setupBackupTrigger() {
  try {
    // Check existing triggers to avoid duplicates
    const triggers = ScriptApp.getProjectTriggers();
    for (let i = 0; i < triggers.length; i++) {
      if (triggers[i].getHandlerFunction() === 'autoBackup') {
         return { success: true, message: 'Backup trigger already exists.' };
      }
    }
    // Create new trigger every 5 minutes
    ScriptApp.newTrigger('autoBackup')
      .timeBased()
      .everyMinutes(5)
      .create();
    return { success: true, message: 'Backup trigger set to run every 5 minutes.' };
  } catch (e) {
    return { success: false, error: 'Could not set trigger: ' + e.message };
  }
}

function autoBackup() {
  const db = getDB();
  const folderName = "SmartSchool_Backups";
  
  // Find or Create Backup Folder
  const folders = DriveApp.getFoldersByName(folderName);
  let folder;
  if(folders.hasNext()) {
    folder = folders.next();
  } else {
    folder = DriveApp.createFolder(folderName);
  }
  
  // Create Backup File (JSON Snapshot)
  // To save space, we will only keep the last 50 backups or simplify by just appending time
  const timestamp = new Date().toISOString().replace(/[:.]/g,'-');
  const backupData = handleBackupData('SYSTEM_BACKUP'); // Reuse existing backup logic
  
  if (backupData.success) {
    const fileName = `Backup_${timestamp}.json`;
    folder.createFile(fileName, JSON.stringify(backupData.data), MimeType.PLAIN_TEXT);
    
    // Clean up old backups (Keep last 20)
    const files = folder.getFiles();
    let fileList = [];
    while (files.hasNext()) {
        fileList.push(files.next());
    }
    if (fileList.length > 20) {
        fileList.sort((a,b) => a.getDateCreated() - b.getDateCreated());
        // Delete oldest
        while(fileList.length > 20) {
            fileList[0].setTrashed(true);
            fileList.shift();
        }
    }
  }
}

function restoreFromDrive() {
  const db = getDB();
  // Safety Check: Only auto-restore if Users sheet is effectively empty (except admin/demo?) or non-existent
  // Actually, let's check row count. If < 2 (Header only), it's empty.
  const usersSheet = db.getSheetByName('Users');
  if (usersSheet && usersSheet.getLastRow() > 1) {
       return { success: true, message: 'Data exists. Skipping auto-restore.' };
  }

  const folderName = "SmartSchool_Backups";
  const folders = DriveApp.getFoldersByName(folderName);
  if (!folders.hasNext()) return { success: false, error: 'No backup folder found.' };
  
  const folder = folders.next();
  const files = folder.getFiles();
  let latestFile = null;
  let latestTime = 0;
  
  while (files.hasNext()) {
      const file = files.next();
      const created = file.getDateCreated().getTime();
      if (created > latestTime) {
          latestTime = created;
          latestFile = file;
      }
  }
  
  if (!latestFile) return { success: false, error: 'No backup files found.' };
  
  try {
      const json = latestFile.getBlob().getDataAsString();
      const data = JSON.parse(json);
      return handleRestoreData({ data: data }, 'SYSTEM_RESTORE');
  } catch (e) {
      return { success: false, error: 'Failed to restore: ' + e.message };
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(30000); // Increased lock time for restore operations

  try {
    if (!e || !e.postData || !e.postData.contents) {
      throw new Error("Invalid request payload");
    }

    const params = JSON.parse(e.postData.contents);
    const action = params.action;
    const token = params.token;
    
    // Auth & Permission Check (Simplified)
    let user = null;
    if (token) user = findUserByToken(token);

    // Logging
    if (user && action !== 'getAuditLogs') {
       logAction(user.id, action, params.targetType || 'system', params.targetId || '');
    }

    let result = { success: false, error: "Action not found" };

    switch (action) {
      // --- Auth ---
      case 'login': result = handleLogin(params); break;
      case 'register': result = handleRegister(params); break;
      case 'updateProfile': result = handleUpdateProfile(params, user); break;
      case 'me': result = { success: true, data: { user } }; break;
      case 'autoRestore': result = restoreFromDrive(); break; // New Auto-Restore Endpoint

      // --- Admin: Users ---
      case 'listUsers': result = handleListUsers(params); break;
      case 'updateUser': result = handleUpdateUser(params, user); break;
      
      // --- Admin: Classes ---
      case 'adminListClasses': result = handleList('Classes', params, ['sort']); break;
      case 'adminCreateClass': result = handleCreate('Classes', params); break;
      case 'adminUpdateClass': result = handleUpdate('Classes', { ...params, id: params.classId }); break;
      case 'adminDeleteClass': result = handleDelete('Classes', { id: params.classId }); break;
      
      // --- Admin: Subject Catalog ---
      case 'listSubjectCatalog': result = handleList('SubjectCatalog', params, ['sort', 'category']); break;
      case 'createSubjectCatalog': result = handleCreate('SubjectCatalog', params); break;
      case 'updateSubjectCatalog': result = handleUpdate('SubjectCatalog', { ...params, id: params.catalogId }); break;
      case 'deleteSubjectCatalog': result = handleDelete('SubjectCatalog', { id: params.catalogId }); break;
      case 'listSubjectTemplates': result = handleListSubjectTemplates(); break;

      // --- Admin: Teachers & Terms ---
      case 'listTeachers': result = handleListTeachers(); break;
      case 'listTerms': result = handleList('Terms', params); break;

      // --- Admin: Logs/Backup ---
      case 'getAuditLogs': result = handleList('AuditLogs', params); break;
      case 'backupData': result = handleBackupData(user); break;
      case 'restoreData': result = handleRestoreData(params, user); break;

      // --- Class Subjects (Admin Assign) ---
      case 'listClassSubjects': result = handleListClassSubjects(params); break;
      case 'createClassSubject': result = handleCreate('ClassSubjects', params); break;
      case 'deleteClassSubject': result = handleDelete('ClassSubjects', { id: params.classSubjectId }); break;
      case 'assignTeacherToClassSubject': result = handleUpdate('ClassSubjects', { id: params.classSubjectId, teacherId: params.teacherId }); break;

      // --- Teacher ---
      case 'listMyClassSubjects': result = handleListMyClassSubjects(params, user); break;
      case 'createAssignmentV2': result = handleCreate('Assignments', params); break;
      case 'updateAssignment': result = handleUpdate('Assignments', { ...params, id: params.assignmentId }); break;
      case 'listAssignmentsByClassSubject': result = handleList('Assignments', params); break;
      case 'getTeacherDashboardStats': result = handleGetTeacherDashboardStats(user); break;
      case 'getGradebookData': result = handleGetGradebookData(params, user); break;

      // --- Assignments & Submissions ---
      case 'listAssignments': result = handleList('Assignments', params); break;
      case 'getAssignment': result = handleGet('Assignments', params.assignmentId); break;
      case 'getClass': result = handleGetClassDetail(params.classId); break;
      case 'listSubmissionsByAssignment': result = handleListSubmissionsByAssignment(params); break;
      case 'submitAssignment': result = handleCreate('Submissions', params); break;
      case 'submitHomework': result = handleCreate('Submissions', params); break; // Alias
      case 'gradeSubmission': result = handleGradeSubmission(params, user); break;
      case 'gradeHomework': result = handleGradeSubmission(params, user); break; // Alias
      case 'requestRevision': result = handleRequestRevision(params, user); break;
      case 'getSubmission': result = handleGetSubmission(params.submissionId, user); break;

      // --- Parent ---
      case 'parentLink': result = handleParentLink(params, user); break;
      case 'parentUnlink': result = handleParentUnlink(params, user); break;
      case 'getLinkedStudents': result = handleGetLinkedStudents(params, user); break;
      case 'parentGetGrades': result = handleParentGetGrades(params, user); break;

      // --- Student ---
      case 'joinClass': result = handleJoinClass(params, user); break;
      case 'getStudentGrades': result = handleGetStudentGrades(params, user); break;
      // case 'listClasses': result = handleListClassesForStudent(user); break; // Handled by generic list or specific logic if needed
      // case 'listSubjects': result = handleListSubjectsForStudent(params, user); break; 

      // --- Notifications ---
      case 'listNotifications': result = handleList('Notifications', params); break;
      case 'markRead': result = handleUpdate('Notifications', params, 'id'); break;

      // --- Generic Legacy ---
      case 'createSubject': result = handleCreate('SubjectCatalog', params); break; 
      case 'createClass': result = handleCreate('Classes', params); break; 
      
      case 'debugInfo': result = { success:true, url: SpreadsheetApp.getActiveSpreadsheet().getUrl(), sheets: SpreadsheetApp.getActiveSpreadsheet().getSheets().map(s=>s.getName()) }; break;
    }

    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);

  } catch (e) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false, error: e.message, stack: e.stack
    })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

// ===== AUTH HANDLERS =====

function handleLogin(params) {
  const { email, password } = params;
  const db = getDB();
  const userData = findRow(db, 'Users', 'email', email);
  if (!userData || userData.passwordHash !== password) { 
    return { success: false, error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' };
  }
  const token = 'tok_' + new Date().getTime() + '_' + Math.random().toString(36).substr(2);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  
  // Create Session
  createRow(db, 'Sessions', {
      id: Utils_genId(),
      userId: userData.id,
      token: token,
      expiresAt: expiresAt,
      createdAt: new Date().toISOString(),
      isActive: true
  });
  
  return { success: true, data: { user: userData, token, expiresAt } };
}

function handleRegister(params) {
  const { id, email, name, role, password, primaryClassId, teacherSubjects, roomJoinCode } = params;
  const db = getDB();
  if (findRow(db, 'Users', 'email', email)) {
    return { success: false, error: 'อีเมลนี้ถูกใช้งานแล้ว' };
  }

  let finalClassId = primaryClassId || '';
  if (role === 'student') {
    if (roomJoinCode) {
        const classRow = findRow(db, 'Classes', 'roomJoinCode', roomJoinCode);
        if (!classRow) return { success: false, error: 'ไม่พบรหัสห้องเรียนนี้' };
        finalClassId = classRow.id;
    } else if (params.level && params.room) {
        const allClasses = readSheet(db, 'Classes');
        const classRow = allClasses.find(c => c.level === params.level && String(c.room) === String(params.room) && c.isActive);
        if (!classRow) return { success: false, error: `ไม่พบห้องเรียน ${params.level}/${params.room}` };
        finalClassId = classRow.id;
    }
  }
  
  const newUser = {
    id: id || 'user_' + new Date().getTime(),
    email, name, role,
    passwordHash: password,
    primaryClassId: finalClassId,
    teacherProfileJSON: teacherSubjects ? JSON.stringify({ preferredSubjects: teacherSubjects }) : '',
    createdAt: new Date().toISOString(),
    isActive: true
  };
  
  createRow(db, 'Users', newUser);
  if(finalClassId && role === 'student') {
     createRow(db, 'Enrollments', { id: Utils_genId(), classId: finalClassId, studentId: newUser.id, createdAt: newUser.createdAt, isActive: true });
  }

  return { success: true, data: { user: newUser } };
}

function handleUpdateProfile(params, user) {
    if (!user) return { success: false, error: 'Unauthorized' };
    return handleUpdate('Users', { id: user.id, ...params });
}

// ===== DATA POPULATION =====

function testPopulateData() {
  const db = getDB();
  const now = new Date().toISOString();

  // Create Sheets if not exist
  const sheets = ['Users', 'Sessions', 'Classes', 'SubjectCatalog', 'ClassSubjects', 'Enrollments', 'Assignments', 'Submissions', 'Grades', 'Parents', 'Notifications', 'Terms', 'AuditLogs'];
  sheets.forEach(s => {
      let sheet = db.getSheetByName(s);
      if(!sheet) db.insertSheet(s);
  });

  // 1. Users
  const users = [
    { id:'u1', name:'ครูสมศรี', email:'teacher@demo.com', role:'teacher', createdAt:now, isActive:true, passwordHash: '1234' },
    { id:'u2', name:'ด.ช.มานะ', email:'student@demo.com', role:'student', createdAt:now, isActive:true, passwordHash: '1234' },
    { id:'u3', name:'ผู้ปกครอง', email:'parent@demo.com', role:'parent', createdAt:now, isActive:true, passwordHash: '1234' },
    { id:'admin1', name:'Admin', email:'admin@demo.com', role:'admin', createdAt:now, isActive:true, passwordHash: '1234' }
  ];
  users.forEach(u=> { if(!findRow(db, 'Users', 'email', u.email)) createRow(db,'Users',u); });

  // 2. Terms
  const terms = [
      { id: 't1', term: '1', academicYear: '2567', startDate: now, endDate: now, isActive: true }
  ];
  terms.forEach(t => { if(!findRow(db,'Terms','id',t.id)) createRow(db,'Terms',t); });

  // 3. Subject Catalog
  const subjects = [
    { id:'s1', subjectCode:'ค21101', subjectName:'คณิตศาสตร์พื้นฐาน', levelGroup:'ม.1', category:'วิทย์-คณิต', createdAt:now, isActive:true },
    { id:'s2', subjectCode:'ว21101', subjectName:'วิทยาศาสตร์พื้นฐาน', levelGroup:'ม.1', category:'วิทย์-คณิต', createdAt:now, isActive:true }
  ];
  subjects.forEach(s=> { if(!findRow(db,'SubjectCatalog','id',s.id)) createRow(db,'SubjectCatalog',s); });

  // 4. Classes
  const classes = [
    { id:'c1', level:'ม.1', room:'1', termId:'t1', name:'ม.1/1', homeroomTeacherId:'u1', joinCode:'1111', roomJoinCode:'ROOM11', createdAt:now, isActive:true }
  ];
  classes.forEach(c=> { if(!findRow(db,'Classes','id',c.id)) createRow(db,'Classes',c); });

  // 5. ClassSubjects
  const classSubjects = [
    { id:'cs1', classId:'c1', catalogId:'s1', teacherId:'u1', createdAt:now, isActive:true },
    { id:'cs2', classId:'c1', catalogId:'s2', teacherId:'u1', createdAt:now, isActive:true }
  ];
  classSubjects.forEach(cs=> { if(!findRow(db,'ClassSubjects','id',cs.id)) createRow(db,'ClassSubjects',cs); });

  // 6. Enrollments
  if(!findRow(db,'Enrollments','studentId','u2'))
     createRow(db, 'Enrollments', { id:'e1', classId:'c1', studentId:'u2', createdAt:now, isActive:true });

  // 7. Assignments
  if(!findRow(db,'Assignments','id','a1'))
     createRow(db, 'Assignments', { id:'a1', classSubjectId:'cs1', title:'การบ้าน 1', dueDate:now, maxScore:10, createdAt:now, isActive:true });

  return { success:true, message:'Database populated with full structure.', databaseUrl: db.getUrl() };
}

// ===== API HANDLERS =====

function handleListUsers(params) {
    const db = getDB();
    let users = readSheet(db, 'Users');
    
    if (params.roleFilter) users = users.filter(u => u.role === params.roleFilter);
    if (params.query) {
        const q = params.query.toLowerCase();
        users = users.filter(u => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
    }
    
    // Pagination
    const page = parseInt(params.page) || 1;
    const pageSize = parseInt(params.pageSize) || 20;
    const start = (page - 1) * pageSize;
    return { success: true, data: { data: users.slice(start, start + pageSize), total: users.length } };
}

function handleUpdateUser(params, actor) {
    if (!actor || actor.role !== 'admin') return { success: false, error: 'Unauthorized' };
    return handleUpdate('Users', { id: params.userId, ...params });
}

function handleGetTeacherDashboardStats(user) {
    // Count objects relevant to teacher
    const db = getDB();
    const classSubjects = readSheet(db, 'ClassSubjects').filter(cs => cs.teacherId === user.id && cs.isActive);
    const myCsIds = classSubjects.map(cs => cs.id);
    const assignments = readSheet(db, 'Assignments').filter(a => myCsIds.includes(a.classSubjectId) && a.isActive);
    const submissions = readSheet(db, 'Submissions').filter(s => myCsIds.includes(assignments.find(a=>a.id === s.assignmentId)?.classSubjectId));
    
    const pending = submissions.filter(s => s.status === 'SUBMITTED');
    const graded = submissions.filter(s => s.status === 'GRADED');
    
    const recent = pending.slice(0, 5).map(s => {
        const a = assignments.find(x => x.id === s.assignmentId);
        const cs = classSubjects.find(x => x.id === a.classSubjectId);
        const st = findRow(db, 'Users', 'id', s.studentId);
        const cat = findRow(db, 'SubjectCatalog', 'id', cs.catalogId);
        return {
            id: s.id,
            studentName: st ? st.name : 'Unknown',
            assignmentTitle: a ? a.title : '',
            subjectName: cat ? cat.subjectName : '',
            submittedAt: s.submittedAt
        };
    });

    return {
        success: true,
        data: {
            stats: {
                classesCount: classSubjects.length,
                assignmentsCount: assignments.length,
                pendingCount: pending.length,
                gradedCount: graded.length
            },
            recentPending: recent
        }
    };
}

function handleGetGradebookData(params, user) {
    const db = getDB();
    return { success: true, data: { message: "Not implemented perfectly due to complexity, please use individual lists." } };
}

function handleGetClassDetail(classId) {
    const db = getDB();
    const cls = findRow(db, 'Classes', 'id', classId);
    if(!cls) return { success: false, error: 'Not found' };
    
    const enrollments = readSheet(db, 'Enrollments').filter(e => e.classId === classId && e.isActive);
    const users = readSheet(db, 'Users');
    const students = enrollments.map(e => {
        const u = users.find(user => user.id === e.studentId);
        return u ? { id: u.id, name: u.name, email: u.email } : null;
    }).filter(Boolean);
    
    return { success: true, data: { ...cls, students, studentCount: students.length } }; 
}

function handleListSubmissionsByAssignment(params) {
    const db = getDB();
    let subs = readSheet(db, 'Submissions').filter(s => s.assignmentId === params.assignmentId);
    
    if (params.statusFilter) subs = subs.filter(s => s.status === params.statusFilter);
    
    const users = readSheet(db, 'Users');
    const grades = readSheet(db, 'Grades');
    
    const joined = subs.map(s => {
        const st = users.find(u => u.id === s.studentId);
        const g = grades.find(GD => GD.submissionId === s.id);
        return {
            ...s,
            studentName: st ? st.name : 'Unknown',
            grade: g
        };
    });
    
    const page = parseInt(params.page) || 1;
    const pageSize = parseInt(params.pageSize) || 20;
    const start = (page - 1) * pageSize;

    return { success: true, data: { data: joined.slice(start, start + pageSize), total: joined.length } };
}

function handleGetSubmission(sid, user) {
     const db = getDB();
     const sub = findRow(db, 'Submissions', 'id', sid);
     if(!sub) return { success: false, error: 'Not found' };
     
     const assignment = findRow(db, 'Assignments', 'id', sub.assignmentId);
     const grade = findRow(db, 'Grades', 'submissionId', sub.id);
     
     return { success: true, data: { ...sub, assignment, grade } };
}

function handleRequestRevision(params, user) {
     const db = getDB();
     updateRow(db, 'Submissions', params.submissionId, { status: 'REVISION_REQUESTED', revisionReason: params.reason });
     return { success: true };
}

function handleBackupData(user) {
    if ((!user || user.role !== 'admin') && user !== 'SYSTEM_BACKUP') return { success: false, error: 'Unauthorized' };
    const db = getDB();
    const sheets = db.getSheets();
    const backup = {};
    sheets.forEach(s => {
        const rows = s.getDataRange().getValues();
        if (rows.length > 0) {
            const headers = rows[0];
            const data = rows.slice(1).map(r => {
                let obj = {};
                headers.forEach((h, i) => obj[h] = r[i]);
                return obj;
            });
            backup[s.getName()] = data;
        }
    });
    return { success: true, data: backup };
}

function handleRestoreData(params, user) {
    if ((!user || user.role !== 'admin') && user !== 'SYSTEM_RESTORE') return { success: false, error: 'Unauthorized' };
    const data = params.data;
    const db = getDB();
    
    Object.keys(data).forEach(sheetName => {
        const rows = data[sheetName];
        if (rows && rows.length > 0) {
            let sheet = db.getSheetByName(sheetName);
            if(sheet) sheet.clear();
            else sheet = db.insertSheet(sheetName);
            
            const headers = Object.keys(rows[0]);
            sheet.appendRow(headers);
            
            rows.forEach(r => {
                const row = headers.map(h => r[h]);
                sheet.appendRow(row);
            });
        }
    });
    return { success: true };
}

// ... (Existing standard handlers like handleList, handleCreate, handleUpdate, handleDelete kept generic) ...

function handleList(sheetName, params, sortFields = []) {
  const db = getDB();
  let data = readSheet(db, sheetName);
  Object.keys(params).forEach(key => {
    if (!['action', 'token', 'page', 'pageSize', 'sort', 'query'].includes(key) && params[key]) data = data.filter(r => r[key] == params[key]);
  });
  if (params.sort === 'newest') data.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  const page = parseInt(params.page) || 1;
  const pageSize = parseInt(params.pageSize) || 50;
  const start = (page - 1) * pageSize;
  const paginated = data.slice(start, start + pageSize);
  return { success: true, data: paginated, total: data.length };
}

function handleCreate(sheetName, params) {
  const db = getDB();
  const id = params.id || Utils_genId();
  const newItem = { ...params, id, createdAt: new Date().toISOString(), isActive: true };
  delete newItem.action; delete newItem.token;
  createRow(db, sheetName, newItem);
  return { success: true, data: newItem };
}

function handleUpdate(sheetName, params, idField='id') {
  const db = getDB();
  // Map value to 'id' field only
  const id = params[idField] || params.id;
  const updated = updateRow(db, sheetName, id, params);
  if(updated) return { success: true, data: updated };
  return { success: false, error: 'Not found' };
}

function handleDelete(sheetName, params) {
  const db = getDB();
  const updated = updateRow(db, sheetName, params.id, { isActive: false });
  return { success: !!updated };
}

function handleGet(sheetName, id) {
  const db = getDB();
  const item = findRow(db, sheetName, 'id', id);
  return item ? { success: true, data: item } : { success: false, error: 'Not found' };
}

// ===== SHEET UTILS =====
function readSheet(db, sheetName) {
  let sheet = db.getSheetByName(sheetName);
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0];
  return data.slice(1).map(row => {
    let obj = {}; headers.forEach((h, i) => obj[h] = row[i]); return obj;
  });
}

function createRow(db, sheetName, dataObj) {
  let sheet = db.getSheetByName(sheetName);
  if (!sheet) { 
      sheet = db.insertSheet(sheetName); 
      sheet.appendRow(Object.keys(dataObj)); 
  } else if (sheet.getLastRow() === 0) {
      sheet.appendRow(Object.keys(dataObj));
  }
  const headers = sheet.getDataRange().getValues()[0];
  const newHeaders = [...headers];
  let changed = false;
  Object.keys(dataObj).forEach(k => { if(!newHeaders.includes(k)) { newHeaders.push(k); changed = true; }});
  if(changed) {
     sheet.getRange(1, 1, 1, newHeaders.length).setValues([newHeaders]);
  }
  const row = newHeaders.map(h => dataObj[h] || '');
  sheet.appendRow(row);
}

function updateRow(db, sheetName, id, newData) {
  let sheet = db.getSheetByName(sheetName);
  if(!sheet) return null;
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idIdx = headers.indexOf('id');
  if(idIdx === -1) return null;
  for(let i=1; i<data.length; i++) {
    if(data[i][idIdx] == id) {
       const newRow = [...data[i]];
       Object.keys(newData).forEach(k => {
           const colIdx = headers.indexOf(k);
           if(colIdx > -1) newRow[colIdx] = newData[k];
       });
       sheet.getRange(i+1, 1, 1, newRow.length).setValues([newRow]);
       let obj = {}; headers.forEach((h, j) => obj[h] = newRow[j]);
       return obj;
    }
  }
  return null;
}

function findRow(db, sheetName, key, value) {
  const rows = readSheet(db, sheetName);
  return rows.find(r => r[key] == value);
}

function logAction(userId, action, targetType, targetId) {
    const db = getDB();
    createRow(db, 'AuditLogs', {
        id: Utils_genId(),
        actorUserId: userId,
        action, targetType, targetId,
        createdAt: new Date().toISOString()
    });
}

function findUserByToken(token) {
    const db = getDB();
    const session = findRow(db, 'Sessions', 'token', token);
    if (!session || !session.isActive) return null;
    const expires = new Date(session.expiresAt);
    if (expires < new Date()) {
        updateRow(db, 'Sessions', session.id, { isActive: false });
        return null;
    }
    const user = findRow(db, 'Users', 'id', session.userId);
    return user && user.isActive ? user : null;
}

function Utils_genId() { return 'id_' + Math.random().toString(36).substr(2, 9); }

function handleListClassSubjects(params) {
  const db = getDB();
  let items = readSheet(db, 'ClassSubjects').filter(i => i.isActive !== false);
  if (params.classId) items = items.filter(i => i.classId === params.classId);
  const users = readSheet(db, 'Users');
  const catalogs = readSheet(db, 'SubjectCatalog');
  const classes = readSheet(db, 'Classes');
  const joined = items.map(item => ({
      ...item,
      teacherName: users.find(u => u.id === item.teacherId)?.name || '',
      subjectCode: catalogs.find(c => c.id === item.catalogId)?.subjectCode || '',
      subjectName: catalogs.find(c => c.id === item.catalogId)?.subjectName || '',
      className: classes.find(c => c.id === item.classId)?.name || ''
  }));
  return { success: true, data: { data: joined } };
}

function handleListTeachers() {
  const db = getDB();
  const teachers = readSheet(db, 'Users').filter(u => u.role === 'teacher' && u.isActive !== false);
  return { success: true, data: teachers };
}

function handleListSubjectTemplates() {
  const db = getDB();
  const active = readSheet(db, 'SubjectCatalog').filter(s => s.isActive !== false);
  const grouped = {};
  active.forEach(s => {
      const cat = s.category || 'อื่นๆ';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push({ id: s.id, name: s.subjectName, category: cat });
  });
  return { success: true, data: { templates: active, grouped } };
}

function handleListMyClassSubjects(params, user) {
    return handleListClassSubjects({ ...params, teacherId: user.id });
}

function handleJoinClass(params, user) {
    const db = getDB();
    const cls = findRow(db, 'Classes', 'joinCode', params.joinCode);
    if (!cls) return { success: false, error: 'Invalid Code' };
    createRow(db, 'Enrollments', { id: Utils_genId(), classId: cls.id, studentId: user.id, createdAt: new Date().toISOString(), isActive: true });
    return { success: true };
}

function handleParentLink(params, user) {
   const db = getDB();
   const student = readSheet(db,'Users').find(u => u.role === 'student' && ('STU'+u.id.slice(-4)).toUpperCase() === params.linkCode.toUpperCase());
   if(!student) return { success: false, error: 'Student not found' };
   createRow(db, 'Parents', { id: Utils_genId(), parentId: user.id, studentId: student.id, relation: 'ผู้ปกครอง', createdAt: new Date().toISOString(), isActive: true });
   return { success: true, data: { studentName: student.name } };
}

function handleParentUnlink(params, user) {
    const db = getDB();
    const link = readSheet(db,'Parents').find(p => p.parentId === user.id && p.studentId === params.studentId && p.isActive);
    if(link) updateRow(db, 'Parents', link.id, { isActive: false });
    return { success: true };
}

function handleGetLinkedStudents(params, user) {
    const db = getDB();
    const links = readSheet(db, 'Parents').filter(p => p.parentId === user.id && p.isActive);
    const users = readSheet(db, 'Users');
    return { success: true, data: links.map(l => {
        const s = users.find(u => u.id === l.studentId);
        return s ? { id: s.id, name: s.name, relation: l.relation } : null;
    }).filter(Boolean) };
}

function handleParentGetGrades(params, user) {
    return handleGetStudentGrades({ studentId: params.studentId }, user);
}

function handleGetStudentGrades(params, user) {
    const studentId = params.studentId || user.id;
    const db = getDB();
    const subs = readSheet(db, 'Submissions').filter(s => s.studentId === studentId);
    const grades = readSheet(db, 'Grades');
    const myGrades = subs.map(s => {
        const g = grades.find(GD => GD.submissionId === s.id);
        const a = findRow(db, 'Assignments', 'id', s.assignmentId);
        return { assignment: a, submission: s, grade: g };
    });
    return { success: true, data: myGrades };
}

function handleGradeSubmission(params, user) {
    const db = getDB();
    updateRow(db, 'Submissions', params.submissionId, { status: 'GRADED' });
    const existing = findRow(db, 'Grades', 'submissionId', params.submissionId);
    const gData = { teacherId: user.id, score: params.score, feedback: params.feedback, gradedAt: new Date().toISOString() };
    if(existing) updateRow(db, 'Grades', existing.id, gData);
    else createRow(db, 'Grades', { id: Utils_genId(), submissionId: params.submissionId, ...gData });
    return { success: true };
}
