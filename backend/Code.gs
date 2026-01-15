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

  // Security Whitelist (actions that don't require login)
  const publicActions = ['login', 'register', 'testPopulate', 'setupBackup', 'debugInfo', 'autoRestore', 'listSubjectTemplates'];
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
    case 'adminListClasses': result = handleAdminListClasses(params); break;
    case 'adminCreateClass': result = handleAdminCreateClass(params); break;
    case 'adminUpdateClass': result = handleAdminUpdateClass(params); break;
    case 'adminDeleteClass': result = handleDelete('Classes', { id: params.classId }); break;
    
    // --- Admin: Subject Catalog ---
    case 'listSubjectCatalog': result = handleListPaginated('SubjectCatalog', params, ['sort', 'category']); break;
    case 'createSubjectCatalog': result = handleCreate('SubjectCatalog', params); break;
    case 'updateSubjectCatalog': result = handleUpdate('SubjectCatalog', { ...params, id: params.catalogId }); break;
    case 'deleteSubjectCatalog': result = handleDelete('SubjectCatalog', { id: params.catalogId }); break;
    case 'listSubjectTemplates': result = handleListSubjectTemplates(); break;
    case 'adminGetDashboardStats': result = handleAdminGetDashboardStats(); break;

    // --- Admin: Teachers & Terms ---
    case 'listTeachers': result = handleListTeachers(); break;
    case 'listTerms': result = handleList('Terms', params); break;

    // --- Admin: Logs/Backup ---
    case 'getAuditLogs': result = handleListPaginated('AuditLogs', params); break;
    case 'backupData': result = handleBackupData(user); break;
    case 'restoreData': result = handleRestoreData(params, user); break;

    // --- Class Subjects ---
    case 'listClassSubjects': result = handleListClassSubjects(params); break;
    case 'createClassSubject': result = handleCreate('ClassSubjects', params); break;
    case 'deleteClassSubject': result = handleDelete('ClassSubjects', { id: params.classSubjectId }); break;
    case 'assignTeacherToClassSubject': result = handleUpdate('ClassSubjects', { id: params.classSubjectId, teacherId: params.teacherId }); break;

    // --- Teacher ---
    case 'createClass': result = handleCreate('Classes', params); break; // Force add for teacher
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
    case 'parentGetGrades': result = handleParentGetGrades(params, user); break; // Added this Route

  }

  return result;
}

// ==========================================
// 3. DATABASE ENGINE (BATCH WRITE OPTIMIZED + CACHING)
// ==========================================

// --- Caching System ---
// --- Advanced Caching System (Chunked) ---
const AC_CACHE = CacheService.getScriptCache();
const CACHE_TTL = 21600; // 6 Hours (Increased)

function getCache(key) {
  try {
    // 1. Check for Chunked Metadata
    const metaJson = AC_CACHE.get(key + '_meta');
    if (metaJson) {
      const meta = JSON.parse(metaJson);
      let fullJson = '';
      for (let i = 0; i < meta.chunks; i++) {
        const chunk = AC_CACHE.get(key + '_' + i);
        if (!chunk) return null; // Missing chunk = Cache Miss
        fullJson += chunk;
      }
      return JSON.parse(fullJson);
    }
    
    // 2. Check Legacy (Single Key) - Fallback
    const cached = AC_CACHE.get(key);
    return cached ? JSON.parse(cached) : null;
  } catch (e) { return null; }
}

function setCache(key, data) {
  try {
    const json = JSON.stringify(data);
    const chunkSize = 90000; // Safe limit under 100KB
    
    if (json.length <= chunkSize) {
      // Small data: Store directly
      AC_CACHE.put(key, json, CACHE_TTL);
      // Remove meta if exists (cleanup)
      AC_CACHE.remove(key + '_meta');
    } else {
      // Large data: Chunk it
      const chunkCount = Math.ceil(json.length / chunkSize);
      for (let i = 0; i < chunkCount; i++) {
        const chunk = json.substr(i * chunkSize, chunkSize);
        AC_CACHE.put(key + '_' + i, chunk, CACHE_TTL);
      }
      // Store Metadata
      AC_CACHE.put(key + '_meta', JSON.stringify({ chunks: chunkCount }), CACHE_TTL);
      // Remove singular key if exists
      AC_CACHE.remove(key);
    }
  } catch (e) { 
    console.error('Cache Error:', e);
  }
}

function clearCache(sheetName) {
  try {
    const key = 'SHEET_' + sheetName;
    AC_CACHE.remove(key);
    AC_CACHE.remove(key + '_meta');
    // We can't easily iterate invalid chunks without tracking, 
    // but metadata removal invalidates the set. 
    // Ideally we should track chunks to remove, but TTL will clean them up.
  } catch (e) { /* ignore */ }
}
// ----------------------

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

// 🔥 BATCH READ: Efficiently read table into Objects (With Caching)
function readSheet(db, sheetName) {
  // 1. Try Cache
  const cacheKey = 'SHEET_' + sheetName;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  let sheet = db.getSheetByName(sheetName);
  if (!sheet) return [];
  
  // Read FULL range once
  const range = sheet.getDataRange();
  const values = range.getValues();
  
  if (values.length < 2) return []; // No data (only header or empty)
  
  const headers = values[0];
  const rows = values.slice(1);
  
  // Map rows to objects
  const result = rows.map(row => {
    let obj = {}; 
    headers.forEach((h, i) => obj[h] = row[i]); 
    return obj;
  });

  // 2. Set Cache
  setCache(cacheKey, result);
  return result;
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
  clearCache(sheetName); // Invalidate Cache
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
  
  clearCache(sheetName); // Invalidate Cache
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
    
    clearCache(sheetName); // Invalidate Cache
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
    if(params[k] === '' || params[k] === null || params[k] === undefined) return; // Skip empty filters
    items = items.filter(i => i[k] == params[k]);
  });
  
  // Sorting (Basic)
  if (params.sort === 'newest') items.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
  else if (params.sort === 'oldest') items.sort((a,b) => new Date(a.createdAt) - new Date(b.createdAt));

  return { success: true, data: items };
}

function handleListPaginated(sheetName, params, sortKeys=[]) {
  // 🔥 Optimization for AuditLogs: Reverse Read Strategy
  // If we are listing AuditLogs without complex filters (just pagination),
  // we should read from the BOTTOM of the sheet directly.
  const isAuditLogs = sheetName === 'AuditLogs';
  const hasComplexFilters = Object.keys(params).some(k => 
      !['action', 'token', 'requestId', 'page', 'pageSize', 'sort', 'query'].includes(k)
  );

  if (isAuditLogs && !hasComplexFilters && !params.query) {
      const db = getDB();
      const sheet = db.getSheetByName(sheetName);
      if (!sheet) return { success: true, data: { data: [], total: 0 } };

      const totalRows = Math.max(0, sheet.getLastRow() - 1); // Exclude header
      const page = parseInt(params.page) || 1;
      const pageSize = parseInt(params.pageSize) || 20;
      
      // Calculate Range (Newest first = Bottom rows)
      // Page 1: Read last 20 rows
      // Page 2: Read rows before that
      const endIndex = totalRows - ((page - 1) * pageSize);
      const startIndex = Math.max(1, endIndex - pageSize + 1);
      const rowsToRead = endIndex - startIndex + 1;

      if (rowsToRead <= 0) {
          return { success: true, data: { data: [], total: totalRows, page, pageSize } };
      }

      // Read Header
      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      
      // Read Chunk (StartRow is startIndex + 1 because row 1 is header)
      // Actually row index in Sheet is 1-based.
      // Data area starts at Row 2.
      // If totalRows = 5. Rows are 2,3,4,5,6.
      // Page 1 (size 2): Read 5,6.
      // startRow = 2 + (StartIndex-1)
      const startRow = 2 + (startIndex - 1);
      
      const values = sheet.getRange(startRow, 1, rowsToRead, sheet.getLastColumn()).getValues();
      
      // Map and Reverse (to show newest first)
      const items = values.map(row => {
          let obj = {}; 
          headers.forEach((h, i) => obj[h] = row[i]); 
          return obj;
      }).reverse();

      return { 
          success: true, 
          data: {
              data: items,
              total: totalRows,
              page, 
              pageSize
          }
      };
  }

  // Fallback to standard (Cached) read for other tables or filtered views
  const res = handleList(sheetName, params, sortKeys);
  const items = res.data;
  const page = parseInt(params.page) || 1;
  const pageSize = parseInt(params.pageSize) || 20;
  const start = (page - 1) * pageSize;
  return { 
      success: true, 
      data: {
          data: items.slice(start, start + pageSize),
          total: items.length,
          page, pageSize
      }
  };
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
  
  // 1. Users
  const users = [
    { id:'admin1', email:'admin@demo.com', password:'1234', name:'ผู้ดูแลระบบ', role:'admin' },
    { id:'u_t1', email:'teacher@demo.com', password:'1234', name:'ครูสมศรี ใจดี', role:'teacher' },
    { id:'u_t2', email:'teacher2@demo.com', password:'1234', name:'ครูมานี มีสุข', role:'teacher' },
    { id:'u_s1', email:'student@demo.com', password:'1234', name:'ด.ช.สมชาย เรียนเก่ง', role:'student' },
    { id:'u_p1', email:'parent@demo.com', password:'1234', name:'ผู้ปกครองสมชาย', role:'parent' }
  ];
  
  users.forEach(u => {
    if (!fastFindUser(db, u.email)) {
      handleRegister(u);
    }
  });

  // 2. Terms
  const year = new Date().getFullYear();
  const yearBE = year + 543;
  const terms = [
      { id: 'term_1', academicYear: String(yearBE), term: '1', startDate: `${year}-05-16`, endDate: `${year}-10-10`, isActive: true },
      { id: 'term_2', academicYear: String(yearBE), term: '2', startDate: `${year}-11-01`, endDate: `${year+1}-03-31`, isActive: true }
  ];
  ensureData(db, 'Terms', 'id', terms);

  // 3. Subject Catalog
  const catalog = [
      { id: 'cat_1', subjectCode: 'ท11101', subjectName: 'ภาษาไทย 1', levelGroup: 'ป.1', category: 'ภาษา', createdAt: new Date().toISOString(), isActive: true },
      { id: 'cat_2', subjectCode: 'ค11101', subjectName: 'คณิตศาสตร์ 1', levelGroup: 'ป.1', category: 'วิทย์-คณิต', createdAt: new Date().toISOString(), isActive: true },
      { id: 'cat_3', subjectCode: 'ว11101', subjectName: 'วิทยาศาสตร์ 1', levelGroup: 'ป.1', category: 'วิทย์-คณิต', createdAt: new Date().toISOString(), isActive: true }
  ];
  ensureData(db, 'SubjectCatalog', 'id', catalog);

  // 4. Classes
  const classes = [
      { id: 'class_1', name: 'ป.1/1', level: 'ป.1', room: '1', roomJoinCode: 'ROOM11', teacherId: 'u_t1', termId: 'term_1', createdAt: new Date().toISOString(), isActive: true }
  ];
  ensureData(db, 'Classes', 'id', classes);

  // 5. Class Subjects (Assign Subjects to Class)
  const classSubjects = [
      { id: 'cs_1', classId: 'class_1', catalogId: 'cat_1', teacherId: 'u_t1', createdAt: new Date().toISOString(), isActive: true }, // Thai by T1
      { id: 'cs_2', classId: 'class_1', catalogId: 'cat_2', teacherId: 'u_t2', createdAt: new Date().toISOString(), isActive: true }  // Math by T2
  ];
  ensureData(db, 'ClassSubjects', 'id', classSubjects);

  // 6. Enrollments
  const enrollments = [
      { id: 'en_1', classId: 'class_1', studentId: 'u_s1', createdAt: new Date().toISOString(), isActive: true }
  ];
  ensureData(db, 'Enrollments', 'id', enrollments);

  // 7. Assignments
  const assignments = [
      { id: 'hw_1', subjectId: '', classSubjectId: 'cs_1', title: 'การบ้านภาษาไทย บทที่ 1', detail: 'คัดไทย 1 หน้า', dueDate: new Date(Date.now() + 86400000).toISOString(), maxScore: 10, rubricJSON: '[]', filesJSON: '[]', createdAt: new Date().toISOString(), isActive: true }
  ];
  ensureData(db, 'Assignments', 'id', assignments);

  clearCache('Users');
  
  return { success: true, message: 'Full Database populated successfully', databaseUrl: db.getUrl() };
}

function ensureData(db, sheetName, keyField, dataArray) {
    const existing = readSheet(db, sheetName);
    const existingIds = new Set(existing.map(e => e[keyField]));
    
    dataArray.forEach(item => {
        if (!existingIds.has(item[keyField])) {
            createRow(db, sheetName, item);
        }
    });
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
      { name: 'AuditLogs', headers: ['id', 'userId', 'action', 'targetType', 'targetId', 'timestamp'] },
      // New Tables for Enhanced System
      { name: 'Terms', headers: ['id', 'academicYear', 'term', 'startDate', 'endDate', 'isActive'] },
      { name: 'SubjectCatalog', headers: ['id', 'subjectCode', 'subjectName', 'levelGroup', 'category', 'createdAt', 'isActive'] },
      { name: 'ClassSubjects', headers: ['id', 'classId', 'catalogId', 'teacherId', 'createdAt', 'isActive'] }
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
function handleListUsers(p) { return handleListPaginated('Users', p); }
function handleUpdateUser(p, u) { return handleUpdate('Users', p); }
function handleRestoreData() { return { success: false, error: 'Not implemented' }; }
function handleBackupData() { return { success: false, error: 'Not implemented' }; }
function handleListSubjectTemplates() {
  const db = getDB();
  // Relaxed filter: Read ALL subjects first to ensure we see data even if isActive is missing/false
  // Also fallback to empty array if sheet read fails
  let catalog = [];
  try {
      catalog = readSheet(db, 'SubjectCatalog');
  } catch (e) {
      // If sheet doesn't exist, return empty (it will trigger fallback in some logic or just show empty)
  }

  // Standard Category Order
  const categoryOrder = [
    'กลุ่มสาระภาษาไทย',
    'กลุ่มสาระคณิตศาสตร์',
    'กลุ่มสาระวิทยาศาสตร์และเทคโนโลยี',
    'กลุ่มสาระสังคมศึกษา ศาสนา และวัฒนธรรม',
    'กลุ่มสาระสุขศึกษาและพลศึกษา',
    'กลุ่มสาระศิลปะ',
    'กลุ่มสาระการงานอาชีพ',
    'กลุ่มสาระภาษาต่างประเทศ',
    'กิจกรรมพัฒนาผู้เรียน',
    'อื่นๆ'
  ];

  // Group by Category
  const grouped = {};
  catalog.forEach(item => {
    // Robust name/code getter
    const name = item.subjectName || item.name || 'วิชาไม่ระบุชื่อ';
    const code = item.subjectCode || item.code || '';
    const cat = item.category || 'อื่นๆ';
    
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push({
       id: item.id,
       name: name,
       code: code
    });
  });

  // Sort Groups
  const sortedGrouped = {};
  // 1. Add known categories in order
  categoryOrder.forEach(cat => {
    if (grouped[cat]) {
      sortedGrouped[cat] = grouped[cat];
      delete grouped[cat];
    }
  });
  // 2. Add remaining categories (custom ones)
  Object.keys(grouped).sort().forEach(cat => {
    sortedGrouped[cat] = grouped[cat];
  });

  return { 
    success: true, 
    data: {
      templates: catalog.map(c => ({ 
          id: c.id, 
          name: c.subjectName || c.name || 'Unknown', 
          code: c.subjectCode || c.code || '' 
      })),
      grouped: sortedGrouped
    } 
  };
}

function handleAdminGetDashboardStats() {
    const db = getDB();
    const users = readSheet(db, 'Users').filter(u => u.isActive);
    
    // Optimize AuditLogs Read: Read only last 50 rows instead of full sheet
    let recentLogs = [];
    const sheet = db.getSheetByName('AuditLogs');
    if (sheet) {
        const lastRow = sheet.getLastRow();
        if (lastRow > 1) {
             const limit = 50; // Read last 50 rows
             const startRow = Math.max(2, lastRow - limit + 1); // Start after header (row 1)
             const numRows = lastRow - startRow + 1;
             
             if (numRows > 0) {
                 // Get Headers
                 const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
                 // Get Data
                 const values = sheet.getRange(startRow, 1, numRows, sheet.getLastColumn()).getValues();
                 
                 recentLogs = values.map(row => {
                      let obj = {};
                      headers.forEach((h, i) => obj[h] = row[i]);
                      return obj;
                 });
             }
        }
    }
    
    // Simple Counts
    const stats = {
        totalUsers: users.length,
        teachers: users.filter(u => u.role === 'teacher').length,
        students: users.filter(u => u.role === 'student').length,
        parents: users.filter(u => u.role === 'parent').length
    };
    
    // Sort & Slice
    // Logs are usually chronological, but just in case
    recentLogs = recentLogs.sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 5);

    return { success: true, data: { stats, recentLogs } };
}

function handleListTeachers() { return handleList('Users', { role: 'teacher' }); }

// ===== Subject Templates for Teacher Registration =====
function handleListSubjectTemplates() {
    const db = getDB();
    
    // Get all active subjects from SubjectCatalog
    let subjects = readSheet(db, 'SubjectCatalog').filter(s => s.isActive !== false);
    
    // If no subjects in catalog, return default Thai school subjects
    if (!subjects || subjects.length === 0) {
        const defaultSubjects = [
            { id: 'default_th', subjectCode: 'TH', subjectName: 'ภาษาไทย', category: 'กลุ่มสาระภาษาไทย' },
            { id: 'default_en', subjectCode: 'EN', subjectName: 'ภาษาอังกฤษ', category: 'กลุ่มสาระภาษาต่างประเทศ' },
            { id: 'default_ma', subjectCode: 'MA', subjectName: 'คณิตศาสตร์', category: 'กลุ่มสาระคณิตศาสตร์' },
            { id: 'default_sc', subjectCode: 'SC', subjectName: 'วิทยาศาสตร์', category: 'กลุ่มสาระวิทยาศาสตร์' },
            { id: 'default_so', subjectCode: 'SO', subjectName: 'สังคมศึกษา', category: 'กลุ่มสาระสังคมศึกษา' },
            { id: 'default_he', subjectCode: 'HE', subjectName: 'สุขศึกษาและพลศึกษา', category: 'กลุ่มสาระสุขศึกษา' },
            { id: 'default_ar', subjectCode: 'AR', subjectName: 'ศิลปะ', category: 'กลุ่มสาระศิลปะ' },
            { id: 'default_ca', subjectCode: 'CA', subjectName: 'การงานอาชีพ', category: 'กลุ่มสาระการงานอาชีพ' },
            { id: 'default_co', subjectCode: 'CO', subjectName: 'คอมพิวเตอร์', category: 'กลุ่มสาระเทคโนโลยี' }
        ];
        return { success: true, data: defaultSubjects };
    }
    
    // Group by category for better organization
    const grouped = {};
    subjects.forEach(s => {
        const cat = s.category || 'ไม่ระบุหมวดหมู่';
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push({
            id: s.id,
            subjectCode: s.subjectCode || '',
            subjectName: s.subjectName || '',
            category: cat
        });
    });
    
    // Flatten back to array but maintain order
    const result = [];
    Object.keys(grouped).sort().forEach(cat => {
        result.push(...grouped[cat]);
    });
    
    return { success: true, data: result };
}

// ===== Admin Classes Management (with Join) =====
function handleAdminListClasses(params) {
    const db = getDB();
    let classes = readSheet(db, 'Classes').filter(c => c.isActive !== false);
    
    // Get Terms and Users for joining
    const terms = readSheet(db, 'Terms');
    const users = readSheet(db, 'Users').filter(u => u.role === 'teacher');
    
    // Join Term and Teacher data
    const enrichedClasses = classes.map(c => {
        // Find term
        const term = terms.find(t => t.id === c.termId);
        // Find teacher
        const teacher = users.find(u => u.id === c.teacherId || u.id === c.homeroomTeacherId);
        
        // Generate name if missing
        let displayName = c.name;
        if (!displayName && c.level && c.room) {
            displayName = c.level + '/' + c.room;
        }
        
        return {
            ...c,
            name: displayName || '-',
            termName: term ? (term.term + '/' + term.academicYear) : '-',
            teacherName: teacher ? teacher.name : '-'
        };
    });
    
    // Sorting
    if (params.sort === 'name') {
        // Sort by level/room (Thai school order)
        enrichedClasses.sort((a, b) => {
            const aName = a.name || '';
            const bName = b.name || '';
            return aName.localeCompare(bName, 'th');
        });
    } else {
        // Default: Sort by createdAt DESC
        enrichedClasses.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    }
    
    // Pagination
    const page = parseInt(params.page) || 1;
    const pageSize = parseInt(params.pageSize) || 50;
    const start = (page - 1) * pageSize;
    const pagedData = enrichedClasses.slice(start, start + pageSize);
    
    return { 
        success: true, 
        data: pagedData,
        total: enrichedClasses.length,
        page,
        pageSize
    };
}

function handleAdminCreateClass(params) {
    const db = getDB();
    
    // Auto-generate name from level + room
    const name = (params.level && params.room) ? (params.level + '/' + params.room) : '';
    
    // Generate unique roomJoinCode
    let roomJoinCode = 'ROOM' + Math.floor(1000 + Math.random() * 9000);
    
    // Check for duplicates
    const existingClasses = readSheet(db, 'Classes');
    const existingCodes = existingClasses.map(c => c.roomJoinCode);
    while (existingCodes.includes(roomJoinCode)) {
        roomJoinCode = 'ROOM' + Math.floor(1000 + Math.random() * 9000);
    }
    
    // Build new class object
    const newClass = {
        id: generateId(),
        name: name,
        level: params.level || '',
        room: params.room || '',
        termId: params.termId || '',
        teacherId: params.homeroomTeacherId || params.teacherId || '',
        roomJoinCode: roomJoinCode,
        createdAt: new Date().toISOString(),
        isActive: true
    };
    
    // Insert to sheet
    const sheet = db.getSheetByName('Classes');
    if (!sheet) {
        return { success: false, error: 'ไม่พบ Sheet Classes' };
    }
    
    // Get headers
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    if (headers.length === 0 || !headers[0]) {
        // Create headers
        const defaultHeaders = ['id', 'name', 'level', 'room', 'termId', 'teacherId', 'roomJoinCode', 'createdAt', 'isActive'];
        sheet.getRange(1, 1, 1, defaultHeaders.length).setValues([defaultHeaders]);
        headers.push(...defaultHeaders);
    }
    
    // Build row
    const row = headers.map(h => newClass[h] !== undefined ? newClass[h] : '');
    sheet.appendRow(row);
    
    // Clear cache
    clearCache('Classes');
    
    return { success: true, data: newClass };
}

function handleAdminUpdateClass(params) {
    const db = getDB();
    const classId = params.classId || params.id;
    
    if (!classId) {
        return { success: false, error: 'ไม่ได้ระบุ classId' };
    }
    
    // Build updates
    const updates = {};
    if (params.level !== undefined) updates.level = params.level;
    if (params.room !== undefined) updates.room = params.room;
    if (params.termId !== undefined) updates.termId = params.termId;
    if (params.homeroomTeacherId !== undefined) updates.teacherId = params.homeroomTeacherId;
    if (params.teacherId !== undefined) updates.teacherId = params.teacherId;
    
    // Auto-update name if level/room changed
    if (params.level && params.room) {
        updates.name = params.level + '/' + params.room;
    }
    
    return handleUpdate('Classes', { ...updates, id: classId });
}

function handleListClassSubjects(params) {
  const db = getDB();
  let items = readSheet(db, 'ClassSubjects');
  
  // Filter by classId if provided
  if (params.classId) {
      items = items.filter(i => i.classId === params.classId);
  }

  // Joins
  const classes = readSheet(db, 'Classes');
  const catalog = readSheet(db, 'SubjectCatalog');
  const teachers = readSheet(db, 'Users').filter(u => u.role === 'teacher');
  
  const joined = items.map(item => {
      const classObj = classes.find(c => c.id === item.classId) || {};
      const subject = catalog.find(s => s.id === item.catalogId) || {};
      const teacher = teachers.find(t => t.id === item.teacherId) || {};
      
      // Generate className from level/room if name is empty
      let className = classObj.name;
      if (!className && classObj.level && classObj.room) {
          className = classObj.level + '/' + classObj.room;
      }
      
      return {
          ...item,
          className: className || '-',
          subjectCode: subject.subjectCode || '',
          subjectName: subject.subjectName || '',
          teacherName: teacher.name || ''
      };
  });
  
  const page = parseInt(params.page) || 1;
  const pageSize = parseInt(params.pageSize) || 20;
  const start = (page - 1) * pageSize;
  const pagedData = joined.slice(start, start + pageSize);

  return { 
      success: true, 
      data: {
          data: pagedData,
          total: joined.length,
          page,
          pageSize
      }
  };
}
function handleListSubmissionsByAssignment(p) { return handleList('Submissions', p); }
function handleGradeSubmission(p, u) { return handleUpdate('Submissions', { ...p, id: p.submissionId, teacherId: u.id, gradedAt: new Date().toISOString(), status: 'GRADED' }); }

// Optimized Teacher Dashboard Stats
function handleGetTeacherDashboardStats(user) { 
    const db = getDB();
    
    // Get teacher's class subjects
    const classSubjects = readSheet(db, 'ClassSubjects').filter(cs => cs.teacherId === user.id && cs.isActive !== false);
    const classSubjectIds = classSubjects.map(cs => cs.id);
    const classIds = [...new Set(classSubjects.map(cs => cs.classId))];
    
    // Get assignments for these class subjects
    const assignments = readSheet(db, 'Assignments').filter(a => 
        a.isActive !== false && classSubjectIds.includes(a.classSubjectId)
    );
    const assignmentIds = assignments.map(a => a.id);
    
    // Get submissions for these assignments
    const submissions = readSheet(db, 'Submissions').filter(s => 
        assignmentIds.includes(s.assignmentId)
    );
    
    // Calculate stats
    const stats = {
        classesCount: classIds.length,
        assignmentsCount: assignments.length,
        pendingCount: submissions.filter(s => ['SUBMITTED', 'LATE_SUBMISSION'].includes(s.status)).length,
        gradedCount: submissions.filter(s => s.status === 'GRADED').length
    };
    
    // Get recent pending submissions (last 5)
    const users = readSheet(db, 'Users');
    const catalog = readSheet(db, 'SubjectCatalog');
    
    const recentPending = submissions
        .filter(s => ['SUBMITTED', 'LATE_SUBMISSION'].includes(s.status))
        .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))
        .slice(0, 5)
        .map(s => {
            const assign = assignments.find(a => a.id === s.assignmentId);
            const student = users.find(u => u.id === s.studentId);
            const cs = classSubjects.find(c => c.id === assign?.classSubjectId);
            const cat = catalog.find(c => c.id === cs?.catalogId);
            return {
                id: s.id,
                studentName: student?.name || 'Unknown',
                assignmentTitle: assign?.title || 'Unknown',
                subjectName: cat?.subjectName || 'Unknown',
                submittedAt: s.submittedAt
            };
        });
    
    return { success: true, data: { stats, recentPending } }; 
}

// Optimized Student Dashboard Stats
function handleGetStudentDashboardStats(user) { 
    const db = getDB();
    
    // Get student's primary class
    const classes = readSheet(db, 'Classes');
    let myClassIds = [];
    
    if (user.primaryClassId) {
        myClassIds = [user.primaryClassId];
    } else {
        // Fallback to enrollments
        const enrollments = readSheet(db, 'Enrollments').filter(e => 
            e.studentId === user.id && e.isActive !== false
        );
        myClassIds = enrollments.map(e => e.classId);
    }
    
    // Get class subjects for my classes
    const classSubjects = readSheet(db, 'ClassSubjects').filter(cs => 
        myClassIds.includes(cs.classId) && cs.isActive !== false
    );
    const classSubjectIds = classSubjects.map(cs => cs.id);
    
    // Get assignments for these class subjects
    const assignments = readSheet(db, 'Assignments').filter(a => 
        a.isActive !== false && classSubjectIds.includes(a.classSubjectId)
    );
    const assignmentIds = assignments.map(a => a.id);
    
    // Get my submissions
    const allSubmissions = readSheet(db, 'Submissions');
    const mySubmissions = allSubmissions.filter(s => s.studentId === user.id);
    const submittedAssignmentIds = mySubmissions.map(s => s.assignmentId);
    
    // Calculate stats
    const pendingAssignments = assignments.filter(a => !submittedAssignmentIds.includes(a.id));
    const gradedSubmissions = mySubmissions.filter(s => s.status === 'GRADED');
    
    const stats = {
        classesCount: myClassIds.length,
        assignmentsCount: assignments.length,
        pendingCount: pendingAssignments.length,
        gradedCount: gradedSubmissions.length
    };
    
    // Get upcoming (non-overdue) assignments
    const now = new Date();
    const upcoming = pendingAssignments
        .filter(a => new Date(a.dueDate) > now)
        .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
        .slice(0, 5);
    
    return { success: true, data: { stats, upcoming } }; 
}

function handleGet(sheet, id) { 
    const db = getDB(); 
    const item = findRow(db, sheet, 'id', id); 
    return item ? { success: true, data: item } : { success: false, error: 'Not found' };
}
function handleGetClassDetail(id) { return handleGet('Classes', id); }

// Gradebook Data for Teachers
function handleGetGradebookData(params, user) {
    if (!user || user.role !== 'teacher') {
        return { success: false, error: 'ไม่มีสิทธิ์ดำเนินการ' };
    }
    
    const db = getDB();
    
    // Get teacher's class subjects
    const classSubjects = readSheet(db, 'ClassSubjects').filter(cs => 
        cs.teacherId === user.id && cs.isActive !== false
    );
    
    if (!classSubjects.length) {
        return { success: true, data: { classSubjects: [], gradebook: [] } };
    }
    
    const classSubjectIds = classSubjects.map(cs => cs.id);
    const classIds = [...new Set(classSubjects.map(cs => cs.classId))];
    
    // Get class info
    const classes = readSheet(db, 'Classes').filter(c => classIds.includes(c.id));
    const catalog = readSheet(db, 'SubjectCatalog');
    
    // Enrich class subjects
    const enrichedClassSubjects = classSubjects.map(cs => {
        const classObj = classes.find(c => c.id === cs.classId);
        const cat = catalog.find(c => c.id === cs.catalogId);
        return {
            id: cs.id,
            className: classObj?.name || 'Unknown',
            subjectName: cat?.subjectName || 'Unknown',
            subjectCode: cat?.subjectCode || ''
        };
    });
    
    // Get assignments for these class subjects
    const assignments = readSheet(db, 'Assignments').filter(a => 
        a.isActive !== false && classSubjectIds.includes(a.classSubjectId)
    );
    
    // Get all submissions for these assignments
    const assignmentIds = assignments.map(a => a.id);
    const submissions = readSheet(db, 'Submissions').filter(s => 
        assignmentIds.includes(s.assignmentId)
    );
    
    // Get students from enrollments
    const enrollments = readSheet(db, 'Enrollments').filter(e => 
        classIds.includes(e.classId) && e.isActive !== false
    );
    const studentIds = [...new Set(enrollments.map(e => e.studentId))];
    const users = readSheet(db, 'Users');
    const students = users.filter(u => studentIds.includes(u.id));
    
    return { 
        success: true, 
        data: { 
            classSubjects: enrichedClassSubjects,
            assignments: assignments.length,
            students: students.length
        } 
    };
}

function restoreFromDrive() { return { success: false, error: "Auto-restore not configured" }; }

// ===== Teacher: My Class Subjects =====
function handleListMyClassSubjects(params, user) {
    if (!user || user.role !== 'teacher') {
        return { success: false, error: 'ไม่มีสิทธิ์ดำเนินการ' };
    }
    
    const db = getDB();
    
    // Get class subjects where this teacher is assigned
    let classSubjects = readSheet(db, 'ClassSubjects').filter(cs => 
        cs.teacherId === user.id && cs.isActive !== false
    );
    
    // Quick Optimization: If no class subjects, return early
    if (classSubjects.length === 0) return { success: true, data: [] };

    // Get all necessary data ONCE
    const classes = readSheet(db, 'Classes');
    const catalog = readSheet(db, 'SubjectCatalog');
    const allAssignments = readSheet(db, 'Assignments'); // Read once!
    
    // Enrich with class and subject info
    const enriched = classSubjects.map(cs => {
        const classObj = classes.find(c => c.id === cs.classId) || {};
        const subject = catalog.find(c => c.id === cs.catalogId) || {};
        
        // Generate className from level/room if name is empty
        let className = classObj.name;
        if (!className && classObj.level && classObj.room) {
            className = classObj.level + '/' + classObj.room;
        }
        
        // Count assignments from pre-loaded list
        const assignmentCount = allAssignments.filter(a => 
            a.classSubjectId === cs.id && a.isActive !== false
        ).length;
        
        return {
            ...cs,
            className: className || '-',
            classLevel: classObj.level || '',
            classRoom: classObj.room || '',
            subjectCode: subject.subjectCode || '',
            subjectName: subject.subjectName || '',
            category: subject.category || '',
            assignmentCount: assignmentCount
        };
    });
    
    return { success: true, data: enriched };
}

// ===== Parent: Link to Student =====
function handleParentLink(params, user) {
    if (!user || user.role !== 'parent') {
        return { success: false, error: 'ไม่มีสิทธิ์ดำเนินการ' };
    }
    
    const db = getDB();
    const { linkCode, studentId } = params;
    
    // Find student by linkCode or studentId
    let student = null;
    if (linkCode) {
        student = readSheet(db, 'Users').find(u => 
            u.linkCode === linkCode && u.role === 'student' && u.isActive !== false
        );
    } else if (studentId) {
        student = findRow(db, 'Users', 'id', studentId);
    }
    
    if (!student) {
        return { success: false, error: 'ไม่พบนักเรียน กรุณาตรวจสอบรหัสเชื่อมต่อ' };
    }
    
    // Check if already linked
    const existingLinks = readSheet(db, 'ParentStudentLinks').filter(l => 
        l.parentId === user.id && l.studentId === student.id && l.isActive !== false
    );
    if (existingLinks.length > 0) {
        return { success: false, error: 'คุณเชื่อมต่อกับนักเรียนคนนี้แล้ว' };
    }
    
    // Create link
    const newLink = {
        id: generateId(),
        parentId: user.id,
        studentId: student.id,
        createdAt: new Date().toISOString(),
        isActive: true
    };
    
    const result = handleCreate('ParentStudentLinks', newLink);
    if (result.success) {
        return { success: true, data: { studentName: student.name, studentId: student.id } };
    }
    return result;
}

// ===== Parent: Unlink from Student =====
function handleParentUnlink(params, user) {
    if (!user || user.role !== 'parent') {
        return { success: false, error: 'ไม่มีสิทธิ์ดำเนินการ' };
    }
    
    const db = getDB();
    const { studentId, linkId } = params;
    
    // Find the link
    const links = readSheet(db, 'ParentStudentLinks').filter(l => 
        l.parentId === user.id && 
        (l.studentId === studentId || l.id === linkId) && 
        l.isActive !== false
    );
    
    if (links.length === 0) {
        return { success: false, error: 'ไม่พบการเชื่อมต่อนี้' };
    }
    
    // Soft delete the link
    return handleUpdate('ParentStudentLinks', { id: links[0].id, isActive: false });
}

// ===== Parent: Get Linked Students =====
function handleGetLinkedStudents(params, user) {
    if (!user || user.role !== 'parent') {
        return { success: false, error: 'ไม่มีสิทธิ์ดำเนินการ' };
    }
    
    const db = getDB();
    
    // Get all active links for this parent
    const links = readSheet(db, 'ParentStudentLinks').filter(l => 
        l.parentId === user.id && l.isActive !== false
    );
    
    // Get student info
    const users = readSheet(db, 'Users');
    const classes = readSheet(db, 'Classes');
    
    const linkedStudents = links.map(link => {
        const student = users.find(u => u.id === link.studentId);
        if (!student) return null;
        
        // Get student's class
        const classObj = classes.find(c => c.id === student.primaryClassId);
        let className = classObj?.name;
        if (!className && classObj?.level && classObj?.room) {
            className = classObj.level + '/' + classObj.room;
        }
        
        return {
            linkId: link.id,
            studentId: student.id,
            studentName: student.name,
            studentEmail: student.email,
            className: className || '-',
            linkedAt: link.createdAt
        };
    }).filter(Boolean);
    
    return { success: true, data: linkedStudents };
}

// ===== Parent: Get Student Grades =====
function handleParentGetGrades(params, user) {
    if (!user || user.role !== 'parent') {
        return { success: false, error: 'Unauthorized' };
    }

    const db = getDB();
    const studentId = params.studentId;

    // 1. Security Check: Is Parent Linked to Student?
    const isLinked = readSheet(db, 'ParentStudentLinks').some(l => 
        l.parentId === user.id && l.studentId === studentId && l.isActive !== false
    );

    if (!isLinked) {
        return { success: false, error: 'Student not linked to this parent' };
    }

    // 2. Get Submissions, Assignments, Subjects (Optimized: Read All Once)
    const submissions = readSheet(db, 'Submissions').filter(s => 
        s.studentId === studentId && s.isActive !== false
    );
    
    // Get Assignments relevant to these submissions OR pending assignments
    // Ideally we should get student's class -> class subjects -> assignments
    
    // Step 2.1: Get Student's Class Assignments
    // We need to know which class/subjects the student is in to show "Missing" assignments too
    const student = readSheet(db, 'Users').find(u => u.id === studentId);
    if (!student) return { success: false, data: [] };

    // Find assignments assigned to student's class-subjects
    // This is complex because assignments are linked to ClassSubjects
    // And student is in a Class (primaryClassId) or enrolled in ClassSubjects
    
    // Simplified Logic: 
    // 1. Get all assignments where classSubject match student's enrolled subjects 
    // BUT we don't have enrollment table fully utilized yet.
    // Let's rely on: Assignments linked to student's primary class subjects?
    // OR just list submissions and populate assignment details?
    // Parent Dashboard shows "Pending Work" so we need assignments that are NOT submitted too.
    
    // For now, let's fetch ALL active assignments and filter by student's context
    // NOTE: This assumes we can identify relevant assignments. 
    // If difficult, let's just return submissions + assignments that have submissions first.
    // To support "Pending", we really need enrollment logic.
    
    // Let's try to get ClassSubjects for the student's class
    const classSubjects = readSheet(db, 'ClassSubjects').filter(cs => cs.classId === student.primaryClassId);
    const classSubjectIds = classSubjects.map(cs => cs.id);
    
    const allAssignments = readSheet(db, 'Assignments').filter(a => 
        classSubjectIds.includes(a.classSubjectId) && a.isActive !== false
    );

    const catalog = readSheet(db, 'SubjectCatalog');

    // 3. Merge Data
    const results = allAssignments.map(assign => {
        const submission = submissions.find(s => s.assignmentId === assign.id);
        const cs = classSubjects.find(c => c.id === assign.classSubjectId);
        const subject = catalog.find(c => c.id === cs?.catalogId);

        // Grade info
        let grade = null;
        if (submission && submission.grade) {
             try { grade = JSON.parse(submission.grade); } catch(e) {}
        }
        
        return {
            assignment: {
                id: assign.id,
                title: assign.title,
                maxScore: assign.maxScore,
                dueDate: assign.dueDate
            },
            submission: submission ? {
                id: submission.id,
                status: submission.status,
                submittedAt: submission.submittedAt,
                version: submission.version
            } : null,
            grade: grade, // { score, feedback, gradedAt }
            subjectName: subject ? subject.subjectName : (cs?.className || 'Unknown Subject'),
            classSubjectId: assign.classSubjectId
        };
    });

    // Sort by due date desc
    results.sort((a, b) => new Date(b.assignment.dueDate) - new Date(a.assignment.dueDate));

    return { success: true, data: results };
}

// ===== Create Term (Admin) =====
function handleCreateTerm(params, user) {
    if (!user || user.role !== 'admin') {
        return { success: false, error: 'ไม่มีสิทธิ์ดำเนินการ' };
    }
    
    const newTerm = {
        id: generateId(),
        term: params.term || '1',
        academicYear: params.academicYear || (new Date().getFullYear() + 543).toString(),
        startDate: params.startDate || '',
        endDate: params.endDate || '',
        isCurrent: params.isCurrent || false,
        createdAt: new Date().toISOString(),
        isActive: true
    };
    
    return handleCreate('Terms', newTerm);
}

