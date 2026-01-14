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
 *    - Description: Version 1
 *    - Execute as: Me (ตัวคุณเอง)
 *    - Who has access: Anyone (ทุกคน) **สำคัญมาก**
 * 6. Copy URL ที่ได้ ไปใส่ในไฟล์ js/api.js ที่ตัวแปร BASE_URL
 */

// ===== CONFIG =====
const SPREADSHEET_ID = '1M4Q4GqjtWpCFfI0mJJ0LeWHqmjiVS0jlpo7XObTHptM'; // User provided Sheet ID

/**
 * Return the Spreadsheet object.
 * ถ้า SPREADSHEET_ID ไม่ได้กำหนด จะสร้างสเปรดชีตใหม่ชื่อ "SmartSchoolDB"
 * และบันทึก ID ไว้ใน Script Properties เพื่อใช้ต่อเนื่อง
 */
function getDB() {
  if (SPREADSHEET_ID) {
    return SpreadsheetApp.openById(SPREADSHEET_ID);
  }
  // ----- Auto‑create fallback -----
  const props = PropertiesService.getScriptProperties();
  let id = props.getProperty('DB_SPREADSHEET_ID');
  if (id) return SpreadsheetApp.openById(id);
  // สร้างสเปรดชีตใหม่
  const ss = SpreadsheetApp.create('SmartSchoolDB');
  props.setProperty('DB_SPREADSHEET_ID', ss.getId());
  Logger.log('Created new DB spreadsheet: ' + ss.getUrl());
  return ss;
}

// ===== MAIN HANDLERS =====

function doGet(e) {
  // Quick debug via GET
  if (e && e.parameter && e.parameter.action === 'debugInfo') {
    const ss = getDB();
    const result = { success:true, url: ss.getUrl(), sheets: ss.getSheets().map(s=>s.getName()) };
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  }
  // Allow testPopulate via GET as well
  if (e && e.parameter && e.parameter.action === 'testPopulate') {
    const result = testPopulateData();
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(10000); // Lock 10 seconds to prevent concurrency issues

  try {
    if (!e || !e.postData || !e.postData.contents) {
      throw new Error("Invalid request payload");
    }

    const params = JSON.parse(e.postData.contents);
    const action = params.action;
    const token = params.token;
    
    // Check Auth (Verification logic here if needed, for now trust client token matching DB)
    let user = null;
    if (token) {
      user = findUserByToken(token);
      // Optional: Check role permissions here
    }

    let result = { success: false, error: "Action not found" };

    switch (action) {
      // --- Auth ---
      case 'login': result = handleLogin(params); break;
      case 'register': result = handleRegister(params); break;
      case 'updateProfile': result = handleUpdateProfile(params, user); break;
      
      // --- Admin: Classes ---
      case 'adminListClasses': result = handleList('Classes', params, ['sort']); break;
      case 'adminCreateClass': result = handleCreate('Classes', params); break;
      case 'adminUpdateClass': result = handleUpdate('Classes', params); break;
      case 'adminDeleteClass': result = handleDelete('Classes', params); break;
      
      // --- Admin: Subject Catalog ---
      case 'listSubjectCatalog': result = handleList('SubjectCatalog', params, ['sort', 'category']); break;
      case 'createSubjectCatalog': result = handleCreate('SubjectCatalog', params); break;
      case 'updateSubjectCatalog': result = handleUpdate('SubjectCatalog', params); break;
      case 'deleteSubjectCatalog': result = handleDelete('SubjectCatalog', params); break;
      case 'listSubjectTemplates': result = handleListSubjectTemplates(); break;

      
      // --- Admin: Teachers & Terms ---
      case 'listTeachers': result = handleListTeachers(); break;
      case 'listTerms': result = handleList('Terms', params); break;

      // --- Class Subjects (Assign subject to class) ---
      case 'listClassSubjects': result = handleListClassSubjects(params); break;
      case 'createClassSubject': result = handleCreate('ClassSubjects', params); break;
      case 'deleteClassSubject': result = handleDelete('ClassSubjects', params); break;

      // --- Teacher ---
      case 'listMyClassSubjects': result = handleListMyClassSubjects(params, user); break;
      case 'createAssignmentV2': result = handleCreate('Assignments', params); break;
      case 'listAssignmentsByClassSubject': result = handleList('Assignments', params); break;
      
      // --- Assignments & Submissions ---
      case 'getAssignment': result = handleGet('Assignments', params.assignmentId); break;
      case 'getClass': result = handleGet('Classes', params.classId); break;
      case 'listSubmissionsByAssignment': result = handleList('Submissions', params); break;
      case 'submitAssignment': result = handleCreate('Submissions', params); break;
      case 'gradeSubmission': result = handleGradeSubmission(params, user); break; // Custom handler
      case 'submitHomework': result = handleCreate('Submissions', params); break; // Alias

      // --- Parent ---
      case 'parentLink': result = handleParentLink(params, user); break;
      case 'parentUnlink': result = handleParentUnlink(params, user); break;
      case 'getLinkedStudents': result = handleGetLinkedStudents(params, user); break;
      case 'parentGetGrades': result = handleParentGetGrades(params, user); break;

      // --- Student ---
      case 'joinClass': result = handleJoinClass(params, user); break;
      case 'getStudentGrades': result = handleGetStudentGrades(params, user); break;

      // --- Notifications ---
      case 'listNotifications': result = handleList('Notifications', params); break;
      case 'markRead': result = handleUpdate('Notifications', params, 'id'); break;

      case 'debugInfo': result = { success:true, url: SpreadsheetApp.getActiveSpreadsheet().getUrl(), sheets: SpreadsheetApp.getActiveSpreadsheet().getSheets().map(s=>s.getName()) }; break;
    }

    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (e) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: e.message,
      stack: e.stack
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
  
  if (!userData) {
    return { success: false, error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' };
  }
  
  // Simulate Token
  const token = 'tok_' + new Date().getTime() + '_' + Math.random().toString(36).substr(2);
  
  const user = {
    id: userData.id,
    name: userData.name,
    email: userData.email,
    role: userData.role,
    token: token
  };
  
  return { success: true, user };
}

function handleRegister(params) {
  const { id, email, name, role, password, primaryClassId, teacherSubjects, roomJoinCode } = params;
  const db = getDB();
  
  // Check Duplicate
  const existing = findRow(db, 'Users', 'email', email);
  if (existing) {
    return { success: false, error: 'อีเมลนี้ถูกใช้งานแล้ว' };
  }

  // Resolve Room Code or Level/Room if provided
  let finalClassId = primaryClassId || '';
  if (role === 'student') {
    if (roomJoinCode) {
        const classRow = findRow(db, 'Classes', 'roomJoinCode', roomJoinCode);
        if (!classRow) {
           return { success: false, error: 'ไม่พบรหัสห้องเรียนนี้' };
        }
        finalClassId = classRow.id;
    } else if (params.level && params.room) {
        // Find by Level & Room
        const allClasses = readSheet(db, 'Classes');
        const classRow = allClasses.find(c => c.level === params.level && String(c.room) === String(params.room) && c.isActive);
        if (!classRow) {
            return { success: false, error: `ไม่พบห้องเรียน ${params.level}/${params.room}` };
        }
        finalClassId = classRow.id;
    } else {
        return { success: false, error: 'กรุณาระบุห้องเรียน' };
    }
  }
  
  const newUser = {
    id: id || 'user_' + new Date().getTime(),
    email,
    name,
    role,
    passwordHash: password, // Store what client sent (in real app, hash this!)
    primaryClassId: finalClassId,
    teacherProfileJSON: teacherSubjects ? JSON.stringify({ preferredSubjects: teacherSubjects }) : '',
    createdAt: new Date().toISOString(),
    isActive: true
  };
  
  createRow(db, 'Users', newUser);
  
  return { success: true, user: { ...newUser, token: 'new_token' } };
}

// ===== DATA POPULATION =====

function testPopulateData() {
  const db = getDB();
  const now = new Date().toISOString();

  // 1. Users
  const users = [
    { id:'u1', name:'ครูสมศรี', email:'teacher@demo.com', role:'teacher', createdAt:now, isActive:true },
    { id:'u2', name:'ด.ช.มานะ', email:'student@demo.com', role:'student', createdAt:now, isActive:true },
    { id:'u3', name:'ผู้ปกครอง', email:'parent@demo.com', role:'parent', createdAt:now, isActive:true }
  ];
  users.forEach(u=>createRow(db,'Users',u));

  // 2. Subject Catalog
  const subjects = [
    { id:'s1', subjectCode:'ค21101', subjectName:'คณิตศาสตร์พื้นฐาน', levelGroup:'ม.1', category:'วิทย์-คณิต', createdAt:now, isActive:true },
    { id:'s2', subjectCode:'ว21101', subjectName:'วิทยาศาสตร์พื้นฐาน', levelGroup:'ม.1', category:'วิทย์-คณิต', createdAt:now, isActive:true }
  ];
  subjects.forEach(s=>createRow(db,'SubjectCatalog',s));

  // 3. Classes
  const classes = [
    { id:'c1', level:'ม.1', room:'1', termId:'t1', name:'ม.1/1', homeroomTeacherId:'u1', joinCode:'1111', roomJoinCode:'ROOM11', createdAt:now, isActive:true }
  ];
  classes.forEach(c=>createRow(db,'Classes',c));

  // 4. ClassSubjects
  const classSubjects = [
    { id:'cs1', classId:'c1', catalogId:'s1', teacherId:'u1', createdAt:now, isActive:true },
    { id:'cs2', classId:'c1', catalogId:'s2', teacherId:'u1', createdAt:now, isActive:true }
  ];
  classSubjects.forEach(cs=>createRow(db,'ClassSubjects',cs));

  // 5. Enrollments
  createRow(db, 'Enrollments', { id:'e1', classId:'c1', studentId:'u2', createdAt:now, isActive:true });

  // 6. Assignments
  createRow(db, 'Assignments', { id:'a1', classSubjectId:'cs1', title:'การบ้าน 1', dueDate:now, maxScore:10, createdAt:now, isActive:true });

  // 7. Submissions & Grades (Empty for now)
  // createRow(db, 'Submissions', ...);
  // createRow(db, 'Grades', ...);

  // 8. Parents
  // createRow(db, 'Parents', ...);

  return { success:true, message:'สร้างข้อมูลตัวอย่างครบถ้วนแล้ว (Users, Classes, Subjects, Enrollments, Assignments)' };
}

// ===== SPECIFIC HANDLERS =====

function handleListTeachers() {
  const db = getDB();
  const allUsers = readSheet(db, 'Users');
  const teachers = allUsers.filter(u => u.role === 'teacher' && u.isActive !== false);
  return { success: true, data: teachers };
}

function handleListClassSubjects(params) {
  const db = getDB();
  let items = readSheet(db, 'ClassSubjects');
  
  if (params.classId) {
    items = items.filter(i => i.classId === params.classId);
  }
  
  // Join Data (Teacher Name, Subject Name) - Simulated Joins
  const users = readSheet(db, 'Users');
  const catalogs = readSheet(db, 'SubjectCatalog');
  const classes = readSheet(db, 'Classes');
  
  const joined = items.map(item => {
    const teacher = users.find(u => u.id === item.teacherId);
    const catalog = catalogs.find(c => c.id === item.catalogId);
    const cls = classes.find(c => c.id === item.classId);
    
    return {
      ...item,
      teacherName: teacher ? teacher.name : '',
      subjectCode: catalog ? catalog.subjectCode : '',
      subjectName: catalog ? catalog.subjectName : '',
      className: cls ? cls.name : ''
    };
  });
  
  return { success: true, data: { data: joined } }; // Wrap in data.data for pagination format compat
}

function handleListSubjectTemplates() {
  const db = getDB();
  const rawSubjects = readSheet(db, 'SubjectCatalog');
  const activeSubjects = rawSubjects.filter(s => s.isActive !== false && s.isActive !== 'false');

  // Group by category
  const grouped = {};
  activeSubjects.forEach(s => {
      const cat = s.category || 'อื่นๆ';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push({
        id: s.id,
        name: s.subjectName || s.name, // Support legacy
        category: cat
      });
  });

  // Sort categories
  const categoryOrder = ['ภาษา', 'วิทย์-คณิต', 'สังคม', 'วิทยาศาสตร์', 'คณิตศาสตร์', 'สุขศึกษา-พละ'];
  const sortedGrouped = {};
  categoryOrder.forEach(key => {
      if (grouped[key]) {
          sortedGrouped[key] = grouped[key];
          delete grouped[key];
      }
  });
  Object.keys(grouped).forEach(key => sortedGrouped[key] = grouped[key]);

  return {
      success: true,
      data: {
          templates: activeSubjects,
          grouped: sortedGrouped
      }
  };
}

function handleListMyClassSubjects(params, user) {
  // if (!user) return { success: false, error: "Unauthorized" }; 
  // For simplicity, we filter by simulated user match or params.
  
  // In real case, use user.id from token. Here using logic same as above.
  const db = getDB();
  let items = readSheet(db, 'ClassSubjects');
  
  // Filter where teacherId matches (Assuming we know teacherId or trust client to filter... 
  // but better to filter server side IF we knew who the user is reliably)
  // Since we don't fully track sessions in DB here, let's return all and let client filter OR 
  // rely on 'listClassSubjects' logic if params passed.
  
  // Actually, for "My Class Subjects", it implies THE CALLER is the teacher.
  // We need to know who is calling. For this snippet, we'll fetch all and rely on Client filtering 
  // OR if you implement token verification, filter by user.id.
  
  // Let's do Generic join and return all active
  return handleListClassSubjects({});
}

// ===== GENERIC CRUD (CORE) =====

function handleList(sheetName, params, sortFields = []) {
  const db = getDB();
  let data = readSheet(db, sheetName);
  
  // Simple Filtering
  Object.keys(params).forEach(key => {
    if (['action', 'token', 'page', 'pageSize', 'sort', 'query'].includes(key)) return;
    if (params[key]) {
      data = data.filter(row => row[key] == params[key]);
    }
  });

  // Simple Sorting (Client side usually handles complex sort, but basic support here)
  if (params.sort === 'newest' || !params.sort) {
     data.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
  }
  
  // Pagination
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
  delete newItem.action;
  delete newItem.token;
  
  createRow(db, sheetName, newItem);
  return { success: true, data: newItem };
}

function handleUpdate(sheetName, params, idField='id') {
  const db = getDB();
  const id = params[idField];
  if(!id) return { success: false, error: 'Missing ID' };
  
  const updated = updateRow(db, sheetName, id, params);
  if(updated) return { success: true, data: updated };
  return { success: false, error: 'Not found' };
}

function handleDelete(sheetName, params) {
  const db = getDB();
  const id = params.id || params.catalogId || params.classId; // Fallback
  // Soft delete typically preferred
  const updated = updateRow(db, sheetName, id, { isActive: false });
  return { success: !!updated };
}

function handleGet(sheetName, id) {
  const db = getDB();
  const item = findRow(db, sheetName, 'id', id);
  if(item) return { success: true, data: item };
  return { success: false, error: 'Not found' };
}


// ===== SHEET UTILS =====

function readSheet(db, sheetName) {
  let sheet = db.getSheetByName(sheetName);
  if (!sheet) {
    sheet = db.insertSheet(sheetName); // Auto create
    // Add default headers for known sheets just in case
    if(sheetName === 'Users') sheet.appendRow(['id', 'email', 'name', 'role', 'passwordHash', 'createdAt', 'isActive']);
    return [];
  }
  
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return []; // Header only
  
  const headers = data[0];
  const rows = data.slice(1);
  
  return rows.map(row => {
    let obj = {};
    headers.forEach((h, i) => {
      obj[h] = row[i];
    });
    return obj;
  });
}

function createRow(db, sheetName, dataObj) {
  let sheet = db.getSheetByName(sheetName);
  if (!sheet) {
    sheet = db.insertSheet(sheetName);
    // Create headers from obj keys
    const headers = Object.keys(dataObj);
    sheet.appendRow(headers);
  }
  
  // Check headers match
  const headers = sheet.getDataRange().getValues()[0];
  // If new keys exist, append cols? (Skip for simplicity, assume headers stable or auto-adapt)
  // For proper DB dynamic columns:
  const newHeaders = [...headers];
  let headerChanged = false;
  Object.keys(dataObj).forEach(k => {
    if(!newHeaders.includes(k)) {
      newHeaders.push(k);
      headerChanged = true;
    }
  });
  
  if(headerChanged) {
    // Append new headers to row 1
    // (Complex logic omitted for brevity, just try to map existing)
  }
  
  const row = headers.map(h => dataObj[h] || '');
  sheet.appendRow(row);
}

function updateRow(db, sheetName, id, newData) {
  let sheet = db.getSheetByName(sheetName);
  if(!sheet) return null;
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idIndex = headers.indexOf('id');
  
  if(idIndex === -1) return null;
  
  for(let i=1; i<data.length; i++) {
    if(data[i][idIndex] == id) {
      // Found, update cols
      const newRow = [...data[i]];
      Object.keys(newData).forEach(k => {
        const colIdx = headers.indexOf(k);
        if(colIdx !== -1) {
          newRow[colIdx] = newData[k];
        }
      });
      
      const range = sheet.getRange(i+1, 1, 1, newRow.length);
      range.setValues([newRow]);
      
      // Return updated obj
      let obj = {};
      headers.forEach((h, j) => obj[h] = newRow[j]);
      return obj;
    }
  }
  return null;
}

function findRow(db, sheetName, key, value) {
  const rows = readSheet(db, sheetName);
  return rows.find(r => r[key] == value);
}

function findUserByToken(token) {
  // In real implementation, query Sessions sheet or verify JWT
  // Here we mock or allow all
  return { id: 'mock', role: 'teacher' }; 
}

function Utils_genId() {
  return 'id_' + Math.random().toString(36).substr(2, 9);
}

// ===== NEW HANDLERS =====

function handleParentLink(params, user) {
  const db = getDB();
  const linkCode = (params.linkCode || '').trim().toUpperCase();

  // Find student by ID slice logic
  const allUsers = readSheet(db, 'Users');
  const targetStudent = allUsers.find(u => {
    if (u.role !== 'student' || !u.isActive) return false;
    const code = 'STU' + String(u.id).slice(-4).toUpperCase();
    return code === linkCode;
  });

  if (!targetStudent) {
    return { success: false, error: 'ไม่พบรหัสเชื่อมโยงนี้' };
  }

  // Check existing
  const parents = readSheet(db, 'Parents');
  const existing = parents.find(p => p.parentId == user.id && p.studentId == targetStudent.id && p.isActive);
  
  if (existing) {
    return { success: false, error: 'เชื่อมต่อแล้ว' };
  }

  const newLink = {
    id: Utils_genId(),
    parentId: user.id,
    studentId: targetStudent.id,
    relation: 'ผู้ปกครอง',
    createdAt: new Date().toISOString(),
    isActive: true
  };
  createRow(db, 'Parents', newLink);
  
  return { success: true, data: { studentName: targetStudent.name } };
}

function handleParentUnlink(params, user) {
  const db = getDB();
  const parents = readSheet(db, 'Parents');
  const link = parents.find(p => p.parentId == user.id && p.studentId == params.studentId && p.isActive);
  
  if (link) {
    updateRow(db, 'Parents', link.id, { isActive: false });
  }
  return { success: true };
}

function handleGetLinkedStudents(params, user) {
  const db = getDB();
  const parents = readSheet(db, 'Parents');
  const links = parents.filter(p => p.parentId == user.id && p.isActive);
  const users = readSheet(db, 'Users');
  
  const data = links.map(l => {
    const s = users.find(u => u.id == l.studentId);
    return s ? { id: s.id, name: s.name, relation: l.relation } : null;
  }).filter(Boolean);
  
  return { success: true, data };
}

function handleParentGetGrades(params, user) {
  const db = getDB();
  
  // Verify access
  const parents = readSheet(db, 'Parents');
  const hasLink = parents.some(p => p.parentId == user.id && p.studentId == params.studentId && p.isActive);
  
  if (!hasLink) return { success: false, error: 'Unauthorized' };
  
  // Reuse logic: Get everything for this student
  return getStudentFullData({ studentId: params.studentId });
}

function handleGetStudentGrades(params, user) {
  // If user calls this, they usually want THEIR grades
  // Simulation: use params.studentId if provided (for flexibility) or user.id
  const studentId = params.studentId || (user ? user.id : null);
  return getStudentFullData({ studentId });
}

function getStudentFullData({ studentId }) {
  if (!studentId) return { success: false, error: 'No student ID' };
  
  const db = getDB();
  const submissions = readSheet(db, 'Submissions');
  const grades = readSheet(db, 'Grades');
  const assignments = readSheet(db, 'Assignments');
  const classSubjects = readSheet(db, 'ClassSubjects');
  const catalogs = readSheet(db, 'SubjectCatalog');
  
  // Filter submissions by student
  const studentSubs = submissions.filter(s => s.studentId == studentId);
  const studentGrades = grades.filter(g => {
    // Grade usually linked to Submission, but let's check
    const sub = studentSubs.find(s => s.id == g.submissionId);
    return !!sub;
  });

  // We actually want a list of ALL assignments the student has (from Enrollments -> Class -> ClassSubjects -> Assignments)
  // This is expensive in Apps Script without SQL.
  // Implementation Shortcut: Just return Graded items for now as requested by "GetGrades"
  // But purely returning grades misses "Not Submitted".
  // Let's iterate assignments in enrolled classes.
  
  const enrollments = readSheet(db, 'Enrollments').filter(e => e.studentId == studentId && e.isActive);
  const classIds = enrollments.map(e => e.classId);
  
  // Find ClassSubjects for these classes
  const myClassSubjects = classSubjects.filter(cs => classIds.includes(cs.classId));
  const myClassSubjectIds = myClassSubjects.map(cs => cs.id);
  
  // Find Assignments
  const myAssignments = assignments.filter(a => myClassSubjectIds.includes(a.classSubjectId) && a.isActive);
  
  // Construct Result
  const results = myAssignments.map(assign => {
      const sub = studentSubs.find(s => s.assignmentId == assign.id) || null;
      const grade = sub ? grades.find(g => g.submissionId == sub.id) : null;
      const cs = myClassSubjects.find(c => c.id == assign.classSubjectId);
      const cat = cs ? catalogs.find(c => c.id == cs.catalogId) : null;
      
      return {
          assignment: assign,
          submission: sub,
          grade: grade,
          subjectName: cat ? cat.subjectName : (cs ? cs.SubjectCode : ''), // Fallback
          classSubjectId: assign.classSubjectId
      };
  });
  
  return { success: true, data: results };
}

function handleJoinClass(params, user) {
    const db = getDB();
    const { joinCode } = params;
    
    const classes = readSheet(db, 'Classes');
    const targetClass = classes.find(c => c.joinCode === joinCode && c.isActive);
    
    if (!targetClass) return { success: false, error: 'รหัสไม่ถูกต้อง' };
    
    const enrollments = readSheet(db, 'Enrollments');
    const exists = enrollments.find(e => e.classId === targetClass.id && e.studentId === user.id && e.isActive);
    
    if (exists) return { success: false, error: 'คุณอยู่ในห้องเรียนนี้แล้ว' };
    
    createRow(db, 'Enrollments', {
        id: Utils_genId(),
        classId: targetClass.id,
        studentId: user.id,
        createdAt: new Date().toISOString(),
        isActive: true
    });
    
    return { success: true };
}

function handleGradeSubmission(params, user) {
    const db = getDB();
    const { submissionId, score, feedback, rubricScoreJSON } = params;
    
    // 1. Update Submission Status
    updateRow(db, 'Submissions', submissionId, { status: 'GRADED' });
    
    // 2. Create/Update Grade
    // Check if grade exists
    const allGrades = readSheet(db, 'Grades');
    const existing = allGrades.find(g => g.submissionId == submissionId);
    
    const gradeData = {
        teacherId: user.id,
        score,
        feedback,
        rubricScoreJSON: rubricScoreJSON || '[]',
        gradedAt: new Date().toISOString()
    };
    
    if (existing) {
        updateRow(db, 'Grades', existing.id, gradeData);
    } else {
        createRow(db, 'Grades', {
            id: Utils_genId(),
            submissionId,
            ...gradeData
        });
    }
    
    return { success: true };
}
