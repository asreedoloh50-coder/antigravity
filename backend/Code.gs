/**
 * ==========================================
 * Smart School Backend (Enterprise Grade)
 * ==========================================
 * - Multi-device Concurrency Support
 * - Batch Write Architecture (Atomic Updates)
 * - Anti-Preflight (CORS Optimized)
 */

const SPREADSHEET_ID = '1JCwuRiAALB9UE_w4w44hZ88fpOp3OAz0GiIB0y4oypU'; // Exact ID from User URL

// ==========================================
// 1. MAIN HANDLERS (ENTRY POINTS)
// ==========================================

function doGet(e) {
  return handleRequest(e, 'GET');
}

function doPost(e) {
  return handleRequest(e, 'POST');
}

// 🛡️ HANDLE REQUEST & CONCURRENCY LOCKING
function handleRequest(e, method) {
  // 1. Safe Parameter Parsing (Anti-Preflight)
  let params = {};
  try {
    if (e.postData && e.postData.contents) {
      // Try parsing JSON body (Client sends text/plain to avoid OPTIONS)
      try {
        params = JSON.parse(e.postData.contents);
      } catch (jsonErr) {
        console.warn("JSON Parse Error, fallback to generic parse", jsonErr);
        params = {};
      }
    } else if (e.parameter) {
      // Fallback to query parameters
      params = e.parameter;
    }
  } catch (err) {
    return createErrorResponse("Invalid Request Format: " + err.message);
  }

  // Normalize Action
  const action = params.action || e.parameter.action;
  if (!action) {
    return createErrorResponse("No action specified");
  }

  // 2. Identify Write Actions (Require Locking)
  // Actions that modify the database
  const WRITE_ACTIONS = [
    'register', 
    'updateProfile', 
    'autoRestore', 
    'testPopulate',
    // Login writes session, so it needs lock? Yes, strictly speaking.
    // But for speed, fastLogin usually appends. Given Batch Write req, we lock.
    'login', 
    'logout', // If we implemented it backend-side
    // Admin Actions
    'updateUser', 'adminCreateClass', 'adminUpdateClass', 'adminDeleteClass',
    'createSubjectCatalog', 'updateSubjectCatalog', 'deleteSubjectCatalog',
    'createClassSubject', 'assignTeacherToClassSubject', 'deleteClassSubject',
    'backupData', 'restoreData',
    // Teacher/Student Actions
    'createAssignmentV2', 'updateAssignment', 'deleteAssignment',
    'submitAssignment', 'submitHomework', 'gradeSubmission', 'requestRevision'
  ];

  // Also catch generic CREATE/UPDATE/DELETE patterns
  const isWrite = WRITE_ACTIONS.includes(action) || 
                  action.startsWith('create') || 
                  action.startsWith('update') || 
                  action.startsWith('delete') || 
                  action.startsWith('submit') ||
                  action.startsWith('save');

  const lock = LockService.getScriptLock();
  let hasLock = false;

  try {
    // 3. Apply Lock (Only for Write Actions)
    if (isWrite) {
      // Wait up to 20 seconds for lock
      hasLock = lock.tryLock(20000); 
      if (!hasLock) {
        throw new Error("Server is busy (Concurrency Lock Timeout). Please try again.");
      }
    }

    // 4. Execute Core Logic
    const result = handleRequestCore(action, params);
    
    // Return JSON
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    console.error("Handler Error:", error);
    return createErrorResponse(error.message, error.stack);
    
  } finally {
    // 5. Release Lock
    if (hasLock) {
      lock.releaseLock();
    }
  }
}

// ==========================================
// 2. CORE BUSINESS LOGIC (SWITCH-CASE)
// ==========================================

function handleRequestCore(action, params) {
  // --- Auth & Permission Check ---
  let user = null;
  if (params.token) {
    user = findUserByToken(params.token);
  }

  // Logging (Skip for heavy logs)
  if (user && action !== 'getAuditLogs') {
     logAction(user.id, action, params.targetType || 'system', params.targetId || '');
  }

  // Security Whitelist
  const publicActions = ['login', 'register', 'testPopulate', 'setupBackup', 'debugInfo', 'autoRestore'];
  if (!publicActions.includes(action) && !user) {
     return { success: false, error: 'Unauthorized: Please login first' };
  }

  let result = { success: false, error: "Action not found: " + action };

  // --- ROUTING ---
  switch (action) {
    // --- Auth ---
    case 'login': result = handleLogin(params); break;
    case 'register': result = handleRegister(params); break;
    case 'updateProfile': result = handleUpdateProfile(params, user); break;
    case 'me': result = { success: true, data: { user: utils_sanitizeUser(user) } }; break;
    case 'autoRestore': result = restoreFromDrive(); break;
    case 'testPopulate': result = testPopulateData(); break;

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

    // --- Class Subjects ---
    case 'listClassSubjects': result = handleListClassSubjects(params); break;
    case 'createClassSubject': result = handleCreate('ClassSubjects', params); break;
    case 'deleteClassSubject': result = handleDelete('ClassSubjects', { id: params.classSubjectId }); break;
    case 'assignTeacherToClassSubject': result = handleUpdate('ClassSubjects', { id: params.classSubjectId, teacherId: params.teacherId }); break;

    // --- Teacher ---
    case 'listMyClassSubjects': result = handleListMyClassSubjects(params, user); break;
    case 'createAssignmentV2': result = handleCreate('Assignments', params); break;
    case 'updateAssignment': result = handleUpdate('Assignments', { ...params, id: params.assignmentId }); break;
    case 'deleteAssignment': result = handleDelete('Assignments', { id: params.assignmentId }); break;
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
    case 'requestRevision': result = handleUpdate('Submissions', { id: params.submissionId, status: 'REVISION_REQUESTED', revisionReason: params.reason }); break;

    // --- Student ---
    case 'listSubmissionsByStudent': result = handleList('Submissions', { ...params, studentId: user ? user.id : null }); break;
    case 'getStudentDashboardStats': result = handleGetStudentDashboardStats(user); break;

    // --- Parent ---
    case 'parentLink': result = handleParentLink(params, user); break;
    case 'parentUnlink': result = handleParentUnlink(params, user); break;
    case 'getLinkedStudents': result = handleGetLinkedStudents(params, user); break;
  }

  return result;
}

// ==========================================
// 3. DATABASE ENGINE (BATCH WRITE OPTIMIZED)
// ==========================================

function getDB() {
  if (SPREADSHEET_ID) {
    try { return SpreadsheetApp.openById(SPREADSHEET_ID); } catch (e) { console.warn('ID Error', e); }
  }
  const props = PropertiesService.getScriptProperties();
  let id = props.getProperty('DB_SPREADSHEET_ID');
  if (id) {
    try { return SpreadsheetApp.openById(id); } catch(e) {}
  }
  const ss = SpreadsheetApp.create('SmartSchoolDB_V3');
  props.setProperty('DB_SPREADSHEET_ID', ss.getId());
  setupSheets(ss);
  return ss;
}

// 🔥 BATCH READ: Efficiently read table into Objects
function readSheet(db, sheetName) {
  let sheet = db.getSheetByName(sheetName);
  if (!sheet) return [];
  
  // Read FULL range once
  const range = sheet.getDataRange();
  const values = range.getValues();
  
  if (values.length < 2) return []; // No data (only header or empty)
  
  const headers = values[0];
  const rows = values.slice(1);
  
  // Map rows to objects
  return rows.map(row => {
    let obj = {}; 
    headers.forEach((h, i) => obj[h] = row[i]); 
    return obj;
  });
}

// 🔥 BATCH WRITE: Create (Upsert-like logic available via update)
// For simple create, we still support appending BUT we use a smarter way if needed.
// Given the requirement for "Data Consistency", we will stick to Append for Creates (Atomic enough)
// BUT for UPDATES/DELETES we MUST use Batch Rewrite.
function createRow(db, sheetName, dataObj) {
  let sheet = db.getSheetByName(sheetName);
  if (!sheet) { 
      sheet = db.insertSheet(sheetName); 
      sheet.appendRow(Object.keys(dataObj)); 
  } else if (sheet.getLastRow() === 0) {
      sheet.appendRow(Object.keys(dataObj));
  }

  // Ensure headers match
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  // Align data to headers
  const row = headers.map(h => {
     // Handle Date/Boolean conversion if needed
     return dataObj[h] === undefined ? '' : dataObj[h];
  });
  
  // Append is safe-ish for inserts, but for ultimate safety inside a Lock
  // we can append.
  sheet.appendRow(row);
  return dataObj;
}

// 🔥 BATCH UPDATE: The "Rewrite World" Strategy
// Reads all -> Finds Index -> Updates Memory -> Writes ALL back
// This prevents "stock skew" or partial updates.
function updateRow(db, sheetName, id, updates) {
  let sheet = db.getSheetByName(sheetName);
  if (!sheet) return false;
  
  const range = sheet.getDataRange();
  const values = range.getValues();
  if (values.length < 2) return false;
  
  const headers = values[0];
  const rows = values.slice(1); // Data rows
  
  // Find ID Column
  const idIndex = headers.indexOf('id');
  if (idIndex === -1) return false;
  
  // Find Row in Memory
  const rowIndex = rows.findIndex(r => r[idIndex] == id);
  if (rowIndex === -1) return false;
  
  // Update Data in Memory
  Object.keys(updates).forEach(key => {
    const colIndex = headers.indexOf(key);
    if (colIndex !== -1) {
      rows[rowIndex][colIndex] = updates[key];
    }
  });
  
  // 🔥 BATCH WRITE BACK
  // Write only the data area (excluding header)
  // Logic: rows array is now updated. Write it back to sheet.
  if (rows.length > 0) {
      sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }
  
  return true;
}

// 🔥 BATCH DELETE: Rewrite table without the deleted row
function deleteRow(db, sheetName, params) {
    let sheet = db.getSheetByName(sheetName);
    if (!sheet) return false;

    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();
    if (values.length < 2) return false; // Only header

    const headers = values[0];
    const rows = values.slice(1);
    
    // Determine key to delete by
    const key = params.id ? 'id' : Object.keys(params)[0];
    const val = params[key];
    const keyIndex = headers.indexOf(key);
    
    if (keyIndex === -1) return false;
    
    // Filter out the row
    const newRows = rows.filter(r => r[keyIndex] != val);
    
    if (newRows.length === rows.length) return false; // Nothing deleted

    // Clear old content explicitly to remove bottom rows that might remain
    // (Optimization: Clear only if new length < old length)
    if (rows.length > newRows.length) {
        // Clear everything from row 2 downwards
        sheet.getRange(2, 1, sheet.getLastRow(), sheet.getLastColumn()).clearContent();
    }
    
    // Write back new set
    if (newRows.length > 0) {
        sheet.getRange(2, 1, newRows.length, headers.length).setValues(newRows);
    }
    
    return true;
}

function findRow(db, sheetName, key, value) {
  // Use Optimized Fast Search if searching by ID or Email
  if (key === 'email' && sheetName === 'Users') return fastFindUser(db, value);

  // Fallback to standard read (cached in request context theoretically, but here plain)
  const rows = readSheet(db, sheetName);
  return rows.find(r => r[key] == value);
}

// ==========================================
// 4. ACTION SPECIFIC HANDLERS
// ==========================================

function handleLogin(params) {
  const { email, password } = params;
  const db = getDB();
  
  // Fast Search
  const userData = fastFindUser(db, email);
  
  // Verify
  if (!userData || userData.passwordHash !== utils_hashPassword(password)) { 
    return { success: false, error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' };
  }
  
  const token = 'tok_' + new Date().getTime() + '_' + Math.random().toString(36).substr(2);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  
  // Log Session (Write)
  createRow(db, 'Sessions', {
      id: Utils_genId(),
      userId: userData.id,
      token: token,
      expiresAt: expiresAt,
      createdAt: new Date().toISOString(),
      isActive: true
  });
  
  return { success: true, data: { user: utils_sanitizeUser(userData), token, expiresAt } };
}

function handleRegister(params) {
  const { id, email, name, role, password, primaryClassId, teacherSubjects, roomJoinCode } = params;
  const db = getDB();
  
  if (fastFindUser(db, email)) {
    return { success: false, error: 'อีเมลนี้ถูกใช้งานแล้ว' };
  }

  let finalClassId = primaryClassId || '';
  if (role === 'student' && roomJoinCode) {
      const classRow = findRow(db, 'Classes', 'roomJoinCode', roomJoinCode);
      if (!classRow) return { success: false, error: 'ไม่พบรหัสห้องเรียนนี้' };
      finalClassId = classRow.id;
  }
  
  const newUser = {
    id: id || 'user_' + new Date().getTime(),
    email, name, role,
    passwordHash: utils_hashPassword(password),
    primaryClassId: finalClassId,
    teacherProfileJSON: teacherSubjects ? JSON.stringify({ preferredSubjects: teacherSubjects }) : '',
    createdAt: new Date().toISOString(),
    isActive: true
  };
  
  createRow(db, 'Users', newUser);
  if(finalClassId && role === 'student') {
     createRow(db, 'Enrollments', { id: Utils_genId(), classId: finalClassId, studentId: newUser.id, createdAt: newUser.createdAt, isActive: true });
  }

  return { success: true, data: { user: utils_sanitizeUser(newUser) } };
}

// Generic CRUD Handlers using Batch Utils
function handleList(sheetName, params, sortKeys=[]) {
  const db = getDB();
  let items = readSheet(db, sheetName);
  
  // Filtering
  Object.keys(params).forEach(k => {
    if(['action', 'token', 'requestId', 'page', 'pageSize', 'sort', 'query'].includes(k)) return;
    items = items.filter(i => i[k] == params[k]);
  });
  
  // Sorting (Basic)
  if (params.sort === 'newest') items.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
  else if (params.sort === 'oldest') items.sort((a,b) => new Date(a.createdAt) - new Date(b.createdAt));

  return { success: true, data: items };
}

function handleCreate(sheetName, params) {
  const db = getDB();
  const id = params.id || Utils_genId();
  const newItem = { ...params, id, createdAt: new Date().toISOString(), isActive: true };
  
  // Clean special props
  delete newItem.action; delete newItem.token; delete newItem.requestId;
  
  createRow(db, sheetName, newItem);
  return { success: true, data: newItem };
}

function handleUpdate(sheetName, params) {
    const db = getDB();
    const success = updateRow(db, sheetName, params.id, params);
    return success ? { success: true } : { success: false, error: 'Update failed or ID not found' };
}

function handleDelete(sheetName, params) {
    const db = getDB();
    const success = deleteRow(db, sheetName, params); // Uses Batch Rewrite
    return success ? { success: true } : { success: false, error: 'Delete failed' };
}

// ==========================================
// 5. UTILS & SPECIAL LOGIC
// ==========================================

function fastFindUser(db, email) {
    const sheet = db.getSheetByName('Users');
    if (!sheet) return null;
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const emailColIndex = headers.indexOf('email');
    if (emailColIndex === -1) return null;

    const finder = sheet.getRange(2, emailColIndex + 1, sheet.getLastRow(), 1).createTextFinder(email).matchEntireCell(true);
    const result = finder.findNext();
    if (!result) return null;

    const rowNum = result.getRow();
    const rowValues = sheet.getRange(rowNum, 1, 1, headers.length).getValues()[0];
    let user = {};
    headers.forEach((h, i) => user[h] = rowValues[i]);
    return user;
}

function utils_hashPassword(password) {
  if (!password) return '';
  const rawHash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password);
  let txtHash = '';
  for (let i = 0; i < rawHash.length; i++) {
    let hashVal = rawHash[i];
    if (hashVal < 0) hashVal += 256;
    if (hashVal.toString(16).length == 1) txtHash += '0';
    txtHash += hashVal.toString(16);
  }
  return txtHash;
}

function utils_sanitizeUser(user) {
    if (!user) return null;
    const safeUser = { ...user };
    delete safeUser.passwordHash;
    return safeUser;
}

function Utils_genId() { return 'id_' + Math.random().toString(36).substr(2, 9); }
function createErrorResponse(msg, stack=null) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: msg, stack: stack }))
        .setMimeType(ContentService.MimeType.JSON);
}

function logAction(userId, action, targetType, targetId) {
    const db = getDB();
    createRow(db, 'AuditLogs', {
        id: Utils_genId(),
        userId, action, targetType, targetId,
        timestamp: new Date().toISOString()
    });
}

function findUserByToken(token) {
    const db = getDB();
    const session = findRow(db, 'Sessions', 'token', token);
    if (!session || !session.isActive) return null;
    if (new Date(session.expiresAt) < new Date()) {
        updateRow(db, 'Sessions', session.id, { isActive: false });
        return null;
    }
    return findRow(db, 'Users', 'id', session.userId);
}

// ==========================================
// 6. INITIALIZATION & TEST DATA
// ==========================================

function testPopulateData() {
  const db = getDB();
  setupSheets(db);
  
  // Create Default Admin/Teacher if not exist
  if (!fastFindUser(db, 'admin@demo.com')) {
      handleRegister({ id:'admin1', email:'admin@demo.com', password:'1234', name:'Admin', role:'admin' });
  }
  if (!fastFindUser(db, 'student@demo.com')) {
      handleRegister({ id:'u2', email:'student@demo.com', password:'1234', name:'ด.ช.มานะ', role:'student', level:'ม.1', room:'1' });
  }

  return { success: true, message: 'Database populated successfully', databaseUrl: db.getUrl() };
}

function setupSheets(ss) {
  const tables = [
      { name: 'Users', headers: ['id', 'email', 'name', 'role', 'passwordHash', 'createdAt', 'isActive', 'primaryClassId', 'teacherProfileJSON'] },
      { name: 'Sessions', headers: ['id', 'userId', 'token', 'expiresAt', 'createdAt', 'isActive'] },
      { name: 'Classes', headers: ['id', 'name', 'level', 'room', 'roomJoinCode', 'teacherId', 'termId', 'createdAt', 'isActive'] },
      { name: 'Enrollments', headers: ['id', 'classId', 'studentId', 'createdAt', 'isActive'] },
      { name: 'Subjects', headers: ['id', 'name', 'classId', 'teacherId', 'createdAt', 'isActive'] }, // Legacy
      { name: 'Assignments', headers: ['id', 'subjectId', 'classSubjectId', 'title', 'detail', 'dueDate', 'maxScore', 'rubricJSON', 'filesJSON', 'createdAt', 'isActive'] },
      { name: 'Submissions', headers: ['id', 'assignmentId', 'studentId', 'submittedAt', 'text', 'link', 'filesJSON', 'status', 'score', 'feedback', 'gradedAt', 'teacherId', 'version', 'parentSubmissionId'] },
      { name: 'AuditLogs', headers: ['id', 'userId', 'action', 'targetType', 'targetId', 'timestamp'] }
  ];
  
  tables.forEach(t => {
      let sheet = ss.getSheetByName(t.name);
      if (!sheet) { 
          sheet = ss.insertSheet(t.name); 
          sheet.appendRow(t.headers); 
      }
  });
}

// Placeholder functions for missing handlers to prevent switch errors
function handleUpdateProfile(p, u) { return handleUpdate('Users', { ...p, id: u.id }); }
function handleListUsers(p) { return handleList('Users', p); }
function handleUpdateUser(p, u) { return handleUpdate('Users', p); }
function handleRestoreData() { return { success: false, error: 'Not implemented' }; }
function handleBackupData() { return { success: false, error: 'Not implemented' }; }
function handleListSubjectTemplates() { return { success: true, data: [] }; }
function handleListTeachers() { return handleList('Users', { role: 'teacher' }); }
function handleListClassSubjects() { return handleList('ClassSubjects', {}); }
function handleListMyClassSubjects() { return { success: true, data: [] }; }
function handleListSubmissionsByAssignment(p) { return handleList('Submissions', p); }
function handleGradeSubmission(p, u) { return handleUpdate('Submissions', { ...p, id: p.submissionId, teacherId: u.id, gradedAt: new Date().toISOString(), status: 'GRADED' }); }
function handleGetTeacherDashboardStats() { return { success: true, data: {} }; }
function handleGetStudentDashboardStats() { return { success: true, data: {} }; }
function handleGetGradebookData() { return { success: true, data: [] }; }
function handleGet(sheet, id) { 
    const db = getDB(); 
    const item = findRow(db, sheet, 'id', id); 
    return item ? { success: true, data: item } : { success: false, error: 'Not found' };
}
function handleGetClassDetail(id) { return handleGet('Classes', id); }

function restoreFromDrive() { return { success: false, error: "Auto-restore not configured" }; }

