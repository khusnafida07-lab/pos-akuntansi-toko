/**
 * Role-Based Access Control (RBAC) Matrix
 * Berdasarkan rancangan sistem:
 * 1. Owner: Dasbor kinerja & laporan keuangan
 * 2. Kepala Toko: Otorisasi diskon, void, hapus buku
 * 3. Bagian Keuangan: Likuiditas, AR/AP, arus kas
 * 4. Akunting: Posting, rekonsiliasi, neraca & laba rugi
 * 5. Kepala Gudang: Penerimaan, kartu stok, stok opname
 * 6. Kasir: Pembayaran & cetak struk/invoice
 * 7. Sales: Pencatatan order pelanggan
 */

const ROLES = {
  OWNER: 'Owner',
  KEPALA_TOKO: 'Kepala Toko',
  BAGIAN_KEUANGAN: 'Bagian Keuangan',
  AKUNTING: 'Akunting',
  KEPALA_GUDANG: 'Kepala Gudang',
  KASIR: 'Kasir',
  SALES: 'Sales'
};

const PERMISSIONS = {
  // Owner
  VIEW_OWNER_DASHBOARD: 'view_owner_dashboard',
  VIEW_FINANCIAL_REPORTS: 'view_financial_reports',
  VIEW_AUDIT_LOGS: 'view_audit_logs',
  MANAGE_USERS: 'manage_users',

  // Kepala Toko (Supervisi & Otorisasi)
  AUTHORIZE_DISCOUNT: 'authorize_discount',
  AUTHORIZE_VOID: 'authorize_void',
  AUTHORIZE_WRITE_OFF: 'authorize_write_off',
  VIEW_STORE_MONITORING: 'view_store_monitoring',

  // Bagian Keuangan (Treasury & Cash Management)
  VIEW_LIQUIDITY: 'view_liquidity',
  MANAGE_AR_AP: 'manage_ar_ap',
  PROCESS_PAYMENTS: 'process_payments',
  VIEW_CASH_FLOW: 'view_cash_flow',

  // Akunting (Buku Besar & Pembukuan)
  MANAGE_COA: 'manage_coa',
  MANAGE_JOURNALS: 'manage_journals',
  POST_JOURNALS: 'post_journals',
  VIEW_GENERAL_LEDGER: 'view_general_ledger',
  VIEW_TRIAL_BALANCE: 'view_trial_balance',
  VIEW_INCOME_STATEMENT: 'view_income_statement',
  VIEW_BALANCE_SHEET: 'view_balance_sheet',

  // Kepala Gudang (Logistik & Inventori)
  MANAGE_PRODUCTS: 'manage_products',
  RECEIVE_PURCHASE: 'receive_purchase',
  VIEW_STOCK_CARD: 'view_stock_card',
  MANAGE_STOCK_OPNAME: 'manage_stock_opname',
  REQUEST_WRITE_OFF: 'request_write_off',

  // Kasir (Front Office POS)
  ACCESS_POS: 'access_pos',
  PROCESS_SALE: 'process_sale',
  PRINT_RECEIPT: 'print_receipt',
  REQUEST_DISCOUNT_APPROVAL: 'request_discount_approval',
  REQUEST_VOID_APPROVAL: 'request_void_approval',
  VIEW_SHIFT_SALES: 'view_shift_sales',

  // Sales (Field / Order Taker)
  CREATE_SALES_ORDER: 'create_sales_order',
  VIEW_PRODUCT_CATALOG: 'view_product_catalog',
  MANAGE_CUSTOMERS: 'manage_customers',
  VIEW_OWN_ORDERS: 'view_own_orders'
};

const ROLE_PERMISSIONS = {
  [ROLES.OWNER]: [
    PERMISSIONS.VIEW_OWNER_DASHBOARD,
    PERMISSIONS.VIEW_FINANCIAL_REPORTS,
    PERMISSIONS.VIEW_AUDIT_LOGS,
    PERMISSIONS.MANAGE_USERS,
    PERMISSIONS.VIEW_STORE_MONITORING,
    PERMISSIONS.VIEW_LIQUIDITY,
    PERMISSIONS.VIEW_CASH_FLOW,
    PERMISSIONS.VIEW_GENERAL_LEDGER,
    PERMISSIONS.VIEW_TRIAL_BALANCE,
    PERMISSIONS.VIEW_INCOME_STATEMENT,
    PERMISSIONS.VIEW_BALANCE_SHEET,
    PERMISSIONS.VIEW_STOCK_CARD,
    PERMISSIONS.AUTHORIZE_WRITE_OFF
  ],

  [ROLES.KEPALA_TOKO]: [
    PERMISSIONS.VIEW_STORE_MONITORING,
    PERMISSIONS.AUTHORIZE_DISCOUNT,
    PERMISSIONS.AUTHORIZE_VOID,
    PERMISSIONS.AUTHORIZE_WRITE_OFF,
    PERMISSIONS.VIEW_STOCK_CARD,
    PERMISSIONS.VIEW_SHIFT_SALES,
    PERMISSIONS.VIEW_PRODUCT_CATALOG
  ],

  [ROLES.BAGIAN_KEUANGAN]: [
    PERMISSIONS.VIEW_LIQUIDITY,
    PERMISSIONS.MANAGE_AR_AP,
    PERMISSIONS.PROCESS_PAYMENTS,
    PERMISSIONS.VIEW_CASH_FLOW,
    PERMISSIONS.VIEW_FINANCIAL_REPORTS
  ],

  [ROLES.AKUNTING]: [
    PERMISSIONS.MANAGE_COA,
    PERMISSIONS.MANAGE_JOURNALS,
    PERMISSIONS.POST_JOURNALS,
    PERMISSIONS.VIEW_GENERAL_LEDGER,
    PERMISSIONS.VIEW_TRIAL_BALANCE,
    PERMISSIONS.VIEW_INCOME_STATEMENT,
    PERMISSIONS.VIEW_BALANCE_SHEET
  ],

  [ROLES.KEPALA_GUDANG]: [
    PERMISSIONS.MANAGE_PRODUCTS,
    PERMISSIONS.RECEIVE_PURCHASE,
    PERMISSIONS.VIEW_STOCK_CARD,
    PERMISSIONS.MANAGE_STOCK_OPNAME,
    PERMISSIONS.REQUEST_WRITE_OFF
  ],

  [ROLES.KASIR]: [
    PERMISSIONS.ACCESS_POS,
    PERMISSIONS.PROCESS_SALE,
    PERMISSIONS.PRINT_RECEIPT,
    PERMISSIONS.REQUEST_DISCOUNT_APPROVAL,
    PERMISSIONS.REQUEST_VOID_APPROVAL,
    PERMISSIONS.VIEW_SHIFT_SALES
  ],

  [ROLES.SALES]: [
    PERMISSIONS.CREATE_SALES_ORDER,
    PERMISSIONS.VIEW_PRODUCT_CATALOG,
    PERMISSIONS.MANAGE_CUSTOMERS,
    PERMISSIONS.VIEW_OWN_ORDERS
  ]
};

// Navigasi menu yang terlihat di frontend per role
const ROLE_MENUS = {
  [ROLES.OWNER]: [
    { key: 'dashboard_owner', label: 'Dasbor Eksekutif', icon: 'fa-chart-pie', path: '/dashboard-owner' },
    { key: 'reports_finance', label: 'Laporan Keuangan', icon: 'fa-file-invoice-dollar', path: '/reports/financial' },
    { key: 'reports_inventory', label: 'Rekap Persediaan', icon: 'fa-boxes-stacked', path: '/reports/inventory' },
    { key: 'reports_sales', label: 'Laporan Penjualan', icon: 'fa-chart-line', path: '/reports/sales' },
    { key: 'users_management', label: 'Manajemen Pengguna & Hak Akses', icon: 'fa-users-gear', path: '/users' }
  ],

  [ROLES.KEPALA_TOKO]: [
    { key: 'dashboard_store', label: 'Dasbor Kepala Toko', icon: 'fa-store', path: '/dashboard-store' },
    { key: 'approvals', label: 'Pusat Otorisasi (Diskon, Void, Hapus Buku)', icon: 'fa-stamp', path: '/approvals' },
    { key: 'pos_monitoring', label: 'Monitoring Kasir & Transaksi', icon: 'fa-cash-register', path: '/monitoring/pos' },
    { key: 'stock_monitoring', label: 'Monitoring Stok Toko', icon: 'fa-warehouse', path: '/monitoring/stock' },
    { key: 'reports_sales', label: 'Laporan Penjualan', icon: 'fa-chart-line', path: '/reports/sales' }
  ],

  [ROLES.BAGIAN_KEUANGAN]: [
    { key: 'dashboard_finance', label: 'Dasbor Keuangan & Likuiditas', icon: 'fa-wallet', path: '/dashboard-finance' },
    { key: 'ar_ap', label: 'Piutang & Utang (AR / AP)', icon: 'fa-hand-holding-dollar', path: '/finance/ar-ap' },
    { key: 'payments', label: 'Pelunasan & Pengeluaran Kas', icon: 'fa-receipt', path: '/finance/payments' },
    { key: 'cash_flow', label: 'Laporan Arus Kas', icon: 'fa-money-bill-trend-up', path: '/reports/cash-flow' }
  ],

  [ROLES.AKUNTING]: [
    { key: 'dashboard_accounting', label: 'Dasbor Akuntansi', icon: 'fa-calculator', path: '/dashboard-accounting' },
    { key: 'coa', label: 'Bagan Akun (Chart of Accounts)', icon: 'fa-list-check', path: '/accounting/coa' },
    { key: 'journals', label: 'Jurnal Umum (Journal Entries)', icon: 'fa-book-journal-whills', path: '/accounting/journals' },
    { key: 'general_ledger', label: 'Buku Besar (General Ledger)', icon: 'fa-book', path: '/accounting/ledger' },
    { key: 'trial_balance', label: 'Neraca Saldo', icon: 'fa-scale-balanced', path: '/accounting/trial-balance' },
    { key: 'financial_statements', label: 'Laba Rugi & Neraca', icon: 'fa-file-lines', path: '/accounting/statements' }
  ],

  [ROLES.KEPALA_GUDANG]: [
    { key: 'dashboard_warehouse', label: 'Dasbor Gudang', icon: 'fa-warehouse', path: '/dashboard-warehouse' },
    { key: 'products', label: 'Katalog Produk & Stok', icon: 'fa-boxes-stacked', path: '/inventory/products' },
    { key: 'purchases', label: 'Penerimaan Pembelian Supplier', icon: 'fa-truck-ramp-box', path: '/inventory/purchases' },
    { key: 'stock_cards', label: 'Kartu Stok & Riwayat Mutasi', icon: 'fa-address-card', path: '/inventory/stock-cards' },
    { key: 'stock_opname', label: 'Stok Opname (Fisik vs Sistem)', icon: 'fa-clipboard-check', path: '/inventory/opname' },
    { key: 'write_off_req', label: 'Pengajuan Hapus Buku', icon: 'fa-trash-can', path: '/inventory/write-off' }
  ],

  [ROLES.KASIR]: [
    { key: 'pos_cashier', label: 'POS Kasir (Kasir Register)', icon: 'fa-cash-register', path: '/pos' },
    { key: 'shift_sales', label: 'Riwayat Transaksi & Struk', icon: 'fa-clock-rotate-left', path: '/pos/transactions' },
    { key: 'approval_requests', label: 'Permohonan Otorisasi (Diskon/Void)', icon: 'fa-hand-paper', path: '/pos/requests' }
  ],

  [ROLES.SALES]: [
    { key: 'sales_orders', label: 'Pencatatan Order Pelanggan', icon: 'fa-cart-plus', path: '/sales/orders' },
    { key: 'sales_catalog', label: 'Katalog Produk & Ketersediaan', icon: 'fa-bag-shopping', path: '/sales/catalog' },
    { key: 'customers', label: 'Buku Kontak Pelanggan', icon: 'fa-address-book', path: '/sales/customers' },
    { key: 'my_orders', label: 'Riwayat Order Saya', icon: 'fa-receipt', path: '/sales/history' }
  ]
};

function hasPermission(userRole, permission) {
  const permissions = ROLE_PERMISSIONS[userRole] || [];
  return permissions.includes(permission);
}

function getMenusForRole(userRole) {
  return ROLE_MENUS[userRole] || [];
}

module.exports = {
  ROLES,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  ROLE_MENUS,
  hasPermission,
  getMenusForRole
};
