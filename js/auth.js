/**
 * Auth Module - Authentication & Authorization
 */
const Auth = {
    // Login
    async login(email, password) {
        try {
            UI.showLoading();
            const result = await API.request('login', {
                email,
                password,
                deviceInfo: navigator.userAgent
            });

            if (result.success) {
                Store.setSession({ token: result.data.token, expiresAt: result.data.expiresAt });
                Store.setUser(result.data.user);
                UI.showToast('เข้าสู่ระบบสำเร็จ', 'success');
                Router.navigateByRole(result.data.user.role);
            } else {
                UI.showToast(result.error || 'เข้าสู่ระบบไม่สำเร็จ', 'error');
            }
            return result;
        } finally {
            UI.hideLoading();
        }
    },

    // Register
    async register(role, name, email, password, teacherSubjects = [], roomInfo = null) {
        try {
            UI.showLoading();
            const payload = { role, name, email, password };

            // ครูต้องส่งวิชาที่สอนด้วย
            if (role === 'teacher') {
                payload.teacherSubjects = teacherSubjects;
            }

            // นักเรียนส่งรหัสห้องเรียน หรือ ระดับชั้น/ห้อง
            if (role === 'student' && roomInfo) {
                if (roomInfo.code) {
                    payload.roomJoinCode = roomInfo.code;
                } else if (roomInfo.level && roomInfo.room) {
                    payload.level = roomInfo.level;
                    payload.room = roomInfo.room;
                }
            }

            const result = await API.request('register', payload);

            if (result.success) {
                UI.showToast('สมัครสมาชิกสำเร็จ กรุณาเข้าสู่ระบบ', 'success');
                Router.navigate('/login');
            } else {
                UI.showToast(result.error || 'สมัครสมาชิกไม่สำเร็จ', 'error');
            }
            return result;
        } finally {
            UI.hideLoading();
        }
    },

    // Logout
    async logout() {
        try {
            UI.showLoading();
            await API.request('logout');
            Store.clearSession();

            // Explicitly remove sidebar, overlay, toggle button, and bottom nav
            const sidebar = document.querySelector('.sidebar');
            if (sidebar) sidebar.remove();
            const overlay = document.querySelector('.sidebar-overlay');
            if (overlay) overlay.remove();
            const toggleBtn = document.querySelector('.sidebar-toggle');
            if (toggleBtn) toggleBtn.remove();
            const bottomNav = document.getElementById('bottom-nav');
            if (bottomNav) bottomNav.classList.add('hidden');

            UI.showToast('ออกจากระบบสำเร็จ', 'success');
            Router.navigate('/login');
        } finally {
            UI.hideLoading();
        }
    },

    // Check if user is authenticated
    isAuthenticated() {
        return Store.isLoggedIn();
    },

    // Get current user
    getCurrentUser() {
        return Store.getUser();
    },

    // Get current role
    getCurrentRole() {
        return Store.getRole();
    },

    // Check role permission
    hasRole(requiredRoles) {
        const currentRole = this.getCurrentRole();
        if (Array.isArray(requiredRoles)) {
            return requiredRoles.includes(currentRole);
        }
        return currentRole === requiredRoles;
    },

    // RBAC check
    canAccess(permission) {
        const role = this.getCurrentRole();
        const permissions = {
            'teacher': ['create_class', 'create_subject', 'create_assignment', 'grade', 'view_submissions', 'export'],
            'student': ['join_class', 'submit', 'view_grades', 'view_assignments'],
            'parent': ['view_child_grades', 'link_child'],
            'admin': ['manage_users', 'view_logs', 'backup', 'restore', 'all']
        };

        const rolePerms = permissions[role] || [];
        return rolePerms.includes('all') || rolePerms.includes(permission);
    }
};

window.Auth = Auth;
