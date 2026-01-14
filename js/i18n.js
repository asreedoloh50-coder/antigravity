/**
 * Internationalization Module (Future-ready)
 * Currently Thai only
 */
const i18n = {
    currentLocale: 'th',

    translations: {
        th: {
            // Common
            'app.name': 'ระบบตรวจงานพร้อมให้คะแนนออนไลน์',
            'app.shortName': 'ตรวจงาน',

            // Auth
            'auth.login': 'เข้าสู่ระบบ',
            'auth.logout': 'ออกจากระบบ',
            'auth.register': 'สมัครสมาชิก',
            'auth.email': 'อีเมล',
            'auth.password': 'รหัสผ่าน',
            'auth.name': 'ชื่อ-นามสกุล',

            // Roles
            'role.teacher': 'ครู',
            'role.student': 'นักเรียน',
            'role.parent': 'ผู้ปกครอง',
            'role.admin': 'ผู้ดูแลระบบ',

            // Status
            'status.NOT_SUBMITTED': 'ยังไม่ส่ง',
            'status.SUBMITTED': 'ส่งแล้ว',
            'status.PENDING_REVIEW': 'รอตรวจ',
            'status.GRADED': 'ตรวจแล้ว',
            'status.REVISION_REQUESTED': 'ต้องแก้ไข',
            'status.RESUBMITTED': 'ส่งแก้ไขแล้ว',
            'status.LATE_SUBMISSION': 'ส่งช้า',

            // Navigation
            'nav.home': 'หน้าหลัก',
            'nav.classes': 'ห้องเรียน',
            'nav.assignments': 'งาน',
            'nav.grades': 'คะแนน',
            'nav.settings': 'ตั้งค่า',

            // Actions
            'action.submit': 'ส่ง',
            'action.save': 'บันทึก',
            'action.cancel': 'ยกเลิก',
            'action.delete': 'ลบ',
            'action.edit': 'แก้ไข',
            'action.create': 'สร้าง',
            'action.search': 'ค้นหา',
            'action.filter': 'กรอง',
            'action.export': 'ส่งออก',
            'action.import': 'นำเข้า',

            // Messages
            'msg.success': 'สำเร็จ',
            'msg.error': 'เกิดข้อผิดพลาด',
            'msg.loading': 'กำลังโหลด...',
            'msg.noData': 'ไม่มีข้อมูล',
            'msg.confirmDelete': 'ยืนยันการลบ?',

            // Time
            'time.today': 'วันนี้',
            'time.yesterday': 'เมื่อวาน',
            'time.daysAgo': 'วันที่แล้ว',
            'time.hoursAgo': 'ชั่วโมงที่แล้ว',
            'time.minutesAgo': 'นาทีที่แล้ว',
            'time.justNow': 'เมื่อสักครู่'
        }
    },

    t(key, params = {}) {
        let text = this.translations[this.currentLocale]?.[key] || key;
        Object.keys(params).forEach(param => {
            text = text.replace(`{${param}}`, params[param]);
        });
        return text;
    },

    setLocale(locale) {
        if (this.translations[locale]) {
            this.currentLocale = locale;
        }
    }
};

window.i18n = i18n;
window.t = i18n.t.bind(i18n);
