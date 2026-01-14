/**
 * Router Module - SPA Navigation
 */
const Router = {
    routes: {},
    currentPath: '',

    // Initialize router
    init() {
        window.addEventListener('popstate', () => this.handleRoute());
        document.addEventListener('click', (e) => {
            const link = e.target.closest('a[data-link]');
            if (link) {
                e.preventDefault();
                this.navigate(link.getAttribute('href'));
            }
        });
        this.handleRoute();
    },

    // Register routes
    register(path, handler, options = {}) {
        this.routes[path] = { handler, ...options };
    },

    // Navigate to path
    navigate(path) {
        if (path !== this.currentPath) {
            history.pushState(null, '', path);
            this.handleRoute();
        }
    },

    // Handle current route
    handleRoute() {
        let path = window.location.pathname || '/';

        // Normalize: decode, trim, remove trailing slash
        try {
            path = decodeURIComponent(path).trim();
        } catch (e) { /* ignore */ }

        if (path.length > 1 && path.endsWith('/')) {
            path = path.slice(0, -1);
        }

        // Debug
        console.log('[Router] Navigating to:', path);

        this.currentPath = path;

        // Find matching route
        let route = this.routes[path];
        let params = {};

        // Try Case-Insensitive Match Fallback
        if (!route) {
            const lowerPath = path.toLowerCase();
            // Try exact lowercase match
            if (this.routes[lowerPath]) {
                route = this.routes[lowerPath];
            }
        }

        if (!route) {
            // Try pattern matching
            for (const [pattern, r] of Object.entries(this.routes)) {
                // Try matching exact first
                let match = this.matchPath(pattern, path);

                // If failed, try matching against lowercase pattern? (Usually patterns are lower)
                if (!match) {
                    match = this.matchPath(pattern, path.toLowerCase());
                }

                if (match) {
                    route = r;
                    params = match;
                    break;
                }
            }
        }

        // Auth check
        if (route?.requireAuth && !Auth.isAuthenticated()) {
            this.navigate('/login');
            return;
        }

        // Role check
        if (route?.roles && !Auth.hasRole(route.roles)) {
            UI.showToast('ไม่มีสิทธิ์เข้าถึงหน้านี้', 'error');
            this.navigateByRole(Auth.getCurrentRole());
            return;
        }

        // Execute handler
        if (route?.handler) {
            route.handler(params);
        } else {
            this.routes['/404']?.handler?.() || this.show404();
        }

        // Update navigation
        this.updateNav();
    },

    // Match path with params
    matchPath(pattern, path) {
        const patternParts = pattern.split('/');
        const pathParts = path.split('/');

        if (patternParts.length !== pathParts.length) return null;

        const params = {};
        for (let i = 0; i < patternParts.length; i++) {
            if (patternParts[i].startsWith(':')) {
                params[patternParts[i].slice(1)] = pathParts[i];
            } else if (patternParts[i] !== pathParts[i]) {
                return null;
            }
        }
        return params;
    },

    // Navigate by role
    navigateByRole(role) {
        const roleRoutes = {
            'teacher': '/teacher',
            'student': '/student',
            'parent': '/parent',
            'admin': '/admin'
        };
        this.navigate(roleRoutes[role] || '/login');
    },

    // Update navigation UI
    updateNav() {
        const role = Auth.getCurrentRole();
        const isAuth = Auth.isAuthenticated();

        // Handle sidebar - remove if not authenticated
        const sidebar = document.querySelector('.sidebar');
        if (!isAuth) {
            if (sidebar) sidebar.remove();
            document.getElementById('bottom-nav').classList.add('hidden');
            return;
        }

        document.getElementById('bottom-nav').classList.remove('hidden');
        this.renderBottomNav(role);
        this.renderSidebar(role);
    },

    // Render bottom nav based on role
    renderBottomNav(role) {
        const navItems = this.getNavItems(role);
        const container = document.getElementById('bottom-nav-items');

        container.innerHTML = navItems.map(item => `
            <a href="${item.path}" data-link class="nav-item ${this.currentPath === item.path ? 'active' : ''}">
                ${item.icon}
                <span class="nav-item-label">${item.label}</span>
            </a>
        `).join('');
    },

    // Toggle sidebar visibility
    toggleSidebar() {
        const sidebar = document.querySelector('.sidebar');
        const overlay = document.querySelector('.sidebar-overlay');
        const toggleBtn = document.querySelector('.sidebar-toggle');

        if (sidebar) {
            const isVisible = sidebar.classList.contains('sidebar-visible');
            if (isVisible) {
                sidebar.classList.remove('sidebar-visible');
                overlay?.classList.add('hidden');
                toggleBtn?.classList.remove('active');
            } else {
                sidebar.classList.add('sidebar-visible');
                overlay?.classList.remove('hidden');
                toggleBtn?.classList.add('active');
            }
        }
    },

    // Render sidebar for desktop
    renderSidebar(role) {
        const existing = document.querySelector('.sidebar');
        if (existing) existing.remove();

        const existingOverlay = document.querySelector('.sidebar-overlay');
        if (existingOverlay) existingOverlay.remove();

        const existingToggle = document.querySelector('.sidebar-toggle');
        if (existingToggle) existingToggle.remove();

        const user = Auth.getCurrentUser();
        const navItems = this.getNavItems(role);

        // Create overlay for mobile
        const overlay = document.createElement('div');
        overlay.className = 'sidebar-overlay hidden';
        overlay.onclick = () => this.toggleSidebar();
        document.body.appendChild(overlay);

        // Create toggle button
        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'sidebar-toggle';
        toggleBtn.onclick = () => this.toggleSidebar();
        toggleBtn.innerHTML = `
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>
            </svg>
        `;
        document.body.appendChild(toggleBtn);

        const sidebar = document.createElement('aside');
        sidebar.className = 'sidebar';
        sidebar.innerHTML = `
            <div class="sidebar-header">
                <div class="flex items-center space-x-3">
                    <div class="avatar">${Utils.getInitials(user?.name)}</div>
                    <div>
                        <p class="font-semibold text-gray-900">${Utils.escapeHtml(user?.name || '')}</p>
                        <p class="text-sm text-gray-500">${Utils.getRoleLabel(role)}</p>
                    </div>
                </div>
                <button class="sidebar-close-btn" onclick="Router.toggleSidebar()">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                </button>
            </div>
            <nav class="p-4 space-y-1">
                ${navItems.map(item => `
                    <a href="${item.path}" data-link class="sidebar-item ${this.currentPath === item.path ? 'active' : ''}" onclick="Router.toggleSidebar()">
                        ${item.icon}
                        <span>${item.label}</span>
                    </a>
                `).join('')}
                <hr class="my-4 border-gray-200">
                <button onclick="Auth.logout()" class="sidebar-item w-full text-red-600 hover:bg-red-50">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
                    </svg>
                    <span>ออกจากระบบ</span>
                </button>
            </nav>
        `;
        document.body.appendChild(sidebar);
    },

    // Get navigation items by role
    getNavItems(role) {
        const icons = {
            home: '<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>',
            class: '<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>',
            assignment: '<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>',
            grade: '<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>',
            user: '<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>',
            child: '<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg>',
            settings: '<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>'
        };

        const items = {
            teacher: [
                { path: '/teacher', label: 'หน้าหลัก', icon: icons.home },
                { path: '/teacher/my-subjects', label: 'วิชาของฉัน', icon: icons.class },
                { path: '/teacher/gradebook', label: 'สมุดคะแนน', icon: icons.grade },
                { path: '/teacher/settings', label: 'ตั้งค่า', icon: icons.settings }
            ],
            student: [
                { path: '/student', label: 'หน้าหลัก', icon: icons.home },
                { path: '/student/classes', label: 'ห้องเรียน', icon: icons.class },
                { path: '/student/assignments', label: 'งาน', icon: icons.assignment },
                { path: '/student/grades', label: 'คะแนน', icon: icons.grade },
                { path: '/student/settings', label: 'ตั้งค่า', icon: icons.settings }
            ],
            parent: [
                { path: '/parent', label: 'หน้าหลัก', icon: icons.home },
                { path: '/parent/children', label: 'ลูก', icon: icons.child },
                { path: '/parent/grades', label: 'คะแนน', icon: icons.grade },
                { path: '/parent/settings', label: 'ตั้งค่า', icon: icons.settings }
            ],
            admin: [
                { path: '/admin', label: 'หน้าหลัก', icon: icons.home },
                { path: '/admin/classes', label: 'ห้องเรียน', icon: icons.class },
                { path: '/admin/subjects', label: 'รายวิชา', icon: icons.class },
                { path: '/admin/class-subjects', label: 'มอบหมายวิชา', icon: icons.assignment },
                { path: '/admin/users', label: 'ผู้ใช้', icon: icons.user },
                { path: '/admin/logs', label: 'บันทึก', icon: icons.grade },
                { path: '/admin/settings', label: 'ตั้งค่า', icon: icons.settings }
            ]
        };

        return items[role] || [];
    },

    show404() {
        const app = document.getElementById('app');
        app.innerHTML = `
            <div class="min-h-screen flex items-center justify-center bg-gray-50 p-4">
                <div class="text-center">
                    <h1 class="text-6xl font-bold text-gray-300">404</h1>
                    <p class="mt-4 text-xl text-gray-600">ไม่พบหน้าที่ต้องการ</p>
                    <a href="/" data-link class="btn btn-primary mt-6 inline-block">กลับหน้าหลัก</a>
                </div>
            </div>
        `;
    }
};

window.Router = Router;
