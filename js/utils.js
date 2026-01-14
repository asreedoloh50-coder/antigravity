/**
 * ===================================
 * Utility Functions
 * ระบบตรวจงานพร้อมให้คะแนนออนไลน์
 * ===================================
 */

const Utils = {
    // Generate unique ID
    generateId() {
        return 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);
    },

    // Generate random code (for joinCode, linkCode)
    generateCode(length = 6) {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    },

    // Generate session token
    generateToken(length = 64) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    },

    // Generate salt for password hashing
    generateSalt(length = 16) {
        return this.generateToken(length);
    },

    // Simple hash function (for demo mode - in production use SHA-256 via crypto API)
    async hashPassword(password, salt) {
        const encoder = new TextEncoder();
        const data = encoder.encode(password + salt);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    },

    // Format date to Thai locale
    formatDate(dateString, options = {}) {
        if (!dateString) return '-';
        const date = new Date(dateString);
        const defaultOptions = {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            ...options
        };
        return date.toLocaleDateString('th-TH', defaultOptions);
    },

    // Format datetime to Thai locale
    formatDateTime(dateString) {
        if (!dateString) return '-';
        const date = new Date(dateString);
        return date.toLocaleString('th-TH', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    },

    // Format relative time
    formatRelativeTime(dateString) {
        if (!dateString) return '-';
        const date = new Date(dateString);
        const now = new Date();
        const diff = now - date;
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 7) return this.formatDate(dateString);
        if (days > 0) return `${days} วันที่แล้ว`;
        if (hours > 0) return `${hours} ชั่วโมงที่แล้ว`;
        if (minutes > 0) return `${minutes} นาทีที่แล้ว`;
        return 'เมื่อสักครู่';
    },

    // Check if date is past due
    isPastDue(dueDate) {
        if (!dueDate) return false;
        return new Date() > new Date(dueDate);
    },

    // Get days until due
    getDaysUntilDue(dueDate) {
        if (!dueDate) return null;
        const due = new Date(dueDate);
        const now = new Date();
        const diff = due - now;
        return Math.ceil(diff / (1000 * 60 * 60 * 24));
    },

    // Status labels and styles
    getStatusInfo(status) {
        const statusMap = {
            'NOT_SUBMITTED': { label: 'ยังไม่ส่ง', class: 'badge-not-submitted', icon: 'clock' },
            'SUBMITTED': { label: 'ส่งแล้ว', class: 'badge-submitted', icon: 'check' },
            'PENDING_REVIEW': { label: 'รอตรวจ', class: 'badge-pending-review', icon: 'hourglass' },
            'GRADED': { label: 'ตรวจแล้ว', class: 'badge-graded', icon: 'check-circle' },
            'REVISION_REQUESTED': { label: 'ต้องแก้ไข', class: 'badge-revision-requested', icon: 'exclamation' },
            'RESUBMITTED': { label: 'ส่งแก้ไขแล้ว', class: 'badge-resubmitted', icon: 'refresh' },
            'LATE_SUBMISSION': { label: 'ส่งช้า', class: 'badge-late-submission', icon: 'clock-late' }
        };
        return statusMap[status] || { label: status, class: 'badge-not-submitted', icon: 'question' };
    },

    // Role labels
    getRoleLabel(role) {
        const roles = {
            'teacher': 'ครู',
            'student': 'นักเรียน',
            'parent': 'ผู้ปกครอง',
            'admin': 'ผู้ดูแลระบบ'
        };
        return roles[role] || role;
    },

    // Validate email
    isValidEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    },

    // Normalize email
    normalizeEmail(email) {
        return email.toLowerCase().trim();
    },

    // Validate file type
    isValidFileType(file, allowedTypes = null) {
        const defaultTypes = [
            'image/jpeg',
            'image/png',
            'application/pdf',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ];
        const types = allowedTypes || defaultTypes;
        return types.includes(file.type);
    },

    // Validate file size (default 10MB)
    isValidFileSize(file, maxSize = 10 * 1024 * 1024) {
        return file.size <= maxSize;
    },

    // Format file size
    formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    },

    // File to Base64
    fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
        });
    },

    // Debounce function
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    // Throttle function
    throttle(func, limit) {
        let inThrottle;
        return function (...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },

    // Deep clone object
    deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    },

    // Escape HTML
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    // Parse safe JSON
    safeJsonParse(jsonString, defaultValue = null) {
        try {
            return JSON.parse(jsonString);
        } catch (e) {
            return defaultValue;
        }
    },

    // Get initials from name
    getInitials(name) {
        if (!name) return '?';
        const parts = name.trim().split(' ');
        if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
        return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    },

    // Sort array by property
    sortBy(array, property, direction = 'asc') {
        return [...array].sort((a, b) => {
            const aVal = a[property];
            const bVal = b[property];
            if (aVal < bVal) return direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return direction === 'asc' ? 1 : -1;
            return 0;
        });
    },

    // Filter array by search query
    filterBySearch(array, searchQuery, fields) {
        if (!searchQuery) return array;
        const query = searchQuery.toLowerCase();
        return array.filter(item => {
            return fields.some(field => {
                const value = item[field];
                if (typeof value === 'string') {
                    return value.toLowerCase().includes(query);
                }
                return false;
            });
        });
    },

    // Paginate array
    paginate(array, page = 1, pageSize = 10) {
        const start = (page - 1) * pageSize;
        const end = start + pageSize;
        return {
            data: array.slice(start, end),
            total: array.length,
            page,
            pageSize,
            totalPages: Math.ceil(array.length / pageSize)
        };
    },

    // Calculate score percentage
    getScorePercentage(score, maxScore) {
        if (!maxScore || maxScore === 0) return 0;
        return Math.round((score / maxScore) * 100);
    },

    // Get score color class
    getScoreColorClass(percentage) {
        if (percentage >= 80) return 'text-green-600';
        if (percentage >= 60) return 'text-yellow-600';
        if (percentage >= 40) return 'text-orange-600';
        return 'text-red-600';
    },

    // Convert array to CSV
    arrayToCSV(data, headers) {
        const csvRows = [];

        // Add headers
        csvRows.push(headers.map(h => `"${h.label}"`).join(','));

        // Add data rows
        data.forEach(row => {
            const values = headers.map(h => {
                const value = row[h.key] ?? '';
                const escaped = String(value).replace(/"/g, '""');
                return `"${escaped}"`;
            });
            csvRows.push(values.join(','));
        });

        return csvRows.join('\n');
    },

    // Download CSV
    downloadCSV(csvContent, filename) {
        // Add BOM for Thai character support
        const BOM = '\uFEFF';
        const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    },

    // Get Grade Level Score (ป.1 -> 10, ม.1 -> 20)
    getLevelScore(name) {
        if (!name) return 100;
        const n = String(name);
        if (n.startsWith('อ.')) return 0 + parseInt(n.replace('อ.', '') || 0); // อนุบาล
        if (n.startsWith('ป.')) return 10 + parseInt(n.replace('ป.', '') || 0); // ประถม 1-6
        if (n.startsWith('ม.')) return 20 + parseInt(n.replace('ม.', '') || 0); // มัธยม 1-6
        return 100; // Others
    },

    // Compare Thai Levels (for sorting)
    compareThaiLevels(nameA, nameB) {
        const scoreA = this.getLevelScore(nameA);
        const scoreB = this.getLevelScore(nameB);

        if (scoreA !== scoreB) {
            return scoreA - scoreB;
        }
        // Same level, sort by room number/rest of string
        return (nameA || '').localeCompare(nameB || '', 'th', { numeric: true });
    },

    // Download JSON
    downloadJSON(data, filename) {
        const jsonStr = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
};

// Make globally available
window.Utils = Utils;
