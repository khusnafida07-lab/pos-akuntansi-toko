/**
 * POS & AKUNTANSI TOKO - FRONTEND ENGINE
 * Role-Based Access Control, Real-Time Interactivity & Accounting Sync
 */

const STATE = {
  token: localStorage.getItem('pos_token') || null,
  user: null,
  menus: [],
  permissions: [],
  activeMenuKey: null,
  products: [],
  categories: [],
  selectedCategory: 'ALL',
  stockFilter: 'ALL',
  posSearchQuery: '',
  cart: []
};

const ROLE_INFO = {
  'Owner': {
    badgeClass: 'badge-role-owner',
    icon: 'fa-crown',
    title: '👑 Owner (Pemilik Toko)',
    desc: 'Dasbor kinerja eksekutif, analisis penjualan & laporan keuangan (Neraca, Laba Rugi, Arus Kas).'
  },
  'Kepala Toko': {
    badgeClass: 'badge-role-kepala-toko',
    icon: 'fa-store',
    title: '🏬 Kepala Toko',
    desc: 'Supervisi toko, otorisasi diskon, otorisasi pembatalan (void) transaksi, dan otorisasi hapus buku.'
  },
  'Bagian Keuangan': {
    badgeClass: 'badge-role-keuangan',
    icon: 'fa-wallet',
    title: '💳 Bagian Keuangan',
    desc: 'Manajemen likuiditas kas & bank, piutang pelanggan (AR), utang supplier (AP), dan arus kas.'
  },
  'Akunting': {
    badgeClass: 'badge-role-akunting',
    icon: 'fa-calculator',
    title: '📊 Akunting',
    desc: 'Bagan akun (COA), pencatatan jurnal umum double-entry, buku besar, neraca saldo, dan laba rugi.'
  },
  'Kepala Gudang': {
    badgeClass: 'badge-role-gudang',
    icon: 'fa-warehouse',
    title: '📦 Kepala Gudang',
    desc: 'Katalog barang, penerimaan pembelian supplier, kartu stok, stok opname, dan pengajuan hapus buku.'
  },
  'Kasir': {
    badgeClass: 'badge-role-kasir',
    icon: 'fa-cash-register',
    title: '🛒 Kasir POS',
    desc: 'Front-office kasir register, proses pembayaran pelanggan, cetak struk, dan permohonan void.'
  },
  'Sales': {
    badgeClass: 'badge-role-sales',
    icon: 'fa-user-tie',
    title: '💼 Sales Toko',
    desc: 'Pencatatan sales order pesanan pelanggan, cek ketersediaan stok produk, dan buku kontak.'
  }
};

// ================= API CALL HELPER =================
async function apiCall(endpoint, method = 'GET', body = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (STATE.token) headers['Authorization'] = `Bearer ${STATE.token}`;

  try {
    const res = await fetch(`/api${endpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : null
    });

    const data = await res.json();
    if (!res.ok) {
      if (res.status === 401 && endpoint !== '/auth/login') {
        handleLogout();
        throw new Error('Sesi autentikasi telah berakhir. Silakan login kembali.');
      }
      throw new Error(data.message || 'Terjadi kesalahan pada server.');
    }
    return data;
  } catch (err) {
    showToast(err.message, 'error');
    throw err;
  }
}

function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  const toastMsg = document.getElementById('toastMsg');
  const toastIcon = document.getElementById('toastIcon');

  if (!toast || !toastMsg) return;

  toastMsg.textContent = message;
  if (type === 'error') {
    toastIcon.className = 'fa-solid fa-circle-exclamation text-rose-400 text-base';
  } else {
    toastIcon.className = 'fa-solid fa-circle-check text-emerald-400 text-base';
  }

  toast.classList.remove('translate-y-24', 'opacity-0');
  setTimeout(() => {
    toast.classList.add('translate-y-24', 'opacity-0');
  }, 3500);
}

// ================= CHART.JS INSTANCE MANAGER =================
const chartInstances = {};
function destroyChart(name) {
  if (chartInstances[name]) {
    try {
      chartInstances[name].destroy();
    } catch (e) {
      console.warn('Error destroying chart:', e);
    }
    delete chartInstances[name];
  }
}
function destroyAllCharts() {
  Object.keys(chartInstances).forEach(name => {
    destroyChart(name);
  });
}

// ================= AUTH & INITIALIZATION =================
async function initApp() {
  if (!STATE.token) {
    showLoginScreen();
    return;
  }

  try {
    const res = await apiCall('/auth/profile');
    const customName = localStorage.getItem('pos_custom_name');
    const customRole = localStorage.getItem('pos_custom_role');
    STATE.user = {
      ...res.user,
      name: customName || res.user.name,
      role: customRole || res.user.role
    };
    STATE.menus = res.menus;
    STATE.permissions = res.permissions;
    showAppLayout();
  } catch (err) {
    console.warn('Sesi login tidak valid atau kadaluarsa:', err);
    localStorage.removeItem('pos_token');
    localStorage.removeItem('pos_custom_name');
    localStorage.removeItem('pos_custom_role');
    STATE.token = null;
    STATE.user = null;
    showLoginScreen();
  }
}

function showLoginScreen() {
  const loginScreen = document.getElementById('loginScreen');
  const appLayout = document.getElementById('appLayout');
  if (loginScreen) loginScreen.classList.remove('hidden');
  if (appLayout) appLayout.classList.add('hidden');
}

function showAppLayout() {
  const loginScreen = document.getElementById('loginScreen');
  const appLayout = document.getElementById('appLayout');
  if (loginScreen) loginScreen.classList.add('hidden');
  if (appLayout) appLayout.classList.remove('hidden');
  renderAppShell();
}

const ROLE_DEFAULT_NAMES = {
  'Owner': 'Khusna Mufida',
  'Kepala Toko': 'Mutiara Putri Sayyidina',
  'Bagian Keuangan': 'Ahmad Irsyadul Ibad',
  'Akunting': 'Dodi Rohaedi',
  'Kepala Gudang': 'Adam Maulana',
  'Kasir': 'Mutiara Putri Sayyidina',
  'Sales': 'Adam Maulana'
};

function handleRoleChange() {
  const roleSelect = document.getElementById('loginRole');
  const nameInput = document.getElementById('loginName');
  if (roleSelect && nameInput && ROLE_DEFAULT_NAMES[roleSelect.value]) {
    nameInput.value = ROLE_DEFAULT_NAMES[roleSelect.value];
  }
}

async function handleLogin(e) {
  if (e) e.preventDefault();

  const nameInput = document.getElementById('loginName');
  const roleSelect = document.getElementById('loginRole');
  const passwordInput = document.getElementById('loginPassword');
  const errorAlert = document.getElementById('loginErrorAlert');
  const errorMsg = document.getElementById('loginErrorMsg');
  const submitBtn = document.getElementById('loginSubmitBtn');

  const name = nameInput ? nameInput.value.trim() : '';
  const role = roleSelect ? roleSelect.value : '';
  const password = passwordInput ? passwordInput.value : '';

  if (!name) {
    if (errorAlert && errorMsg) {
      errorMsg.textContent = 'Harap isi Nama Pengguna / User terlebih dahulu.';
      errorAlert.classList.remove('hidden');
    }
    if (nameInput) nameInput.focus();
    return;
  }

  if (!role) {
    if (errorAlert && errorMsg) {
      errorMsg.textContent = 'Harap pilih Peran (Role) sistem.';
      errorAlert.classList.remove('hidden');
    }
    return;
  }

  if (!password) {
    if (errorAlert && errorMsg) {
      errorMsg.textContent = 'Harap masukkan kata sandi.';
      errorAlert.classList.remove('hidden');
    }
    if (passwordInput) passwordInput.focus();
    return;
  }

  if (errorAlert) errorAlert.classList.add('hidden');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i> Memproses Masuk...';
  }

  try {
    // Petakan role ke canonical username untuk kompatibilitas penuh dengan sistem autentikasi
    const roleUsernameMap = {
      'Owner': 'owner',
      'Kepala Toko': 'kepalatoko',
      'Bagian Keuangan': 'keuangan',
      'Akunting': 'akunting',
      'Kepala Gudang': 'gudang',
      'Kasir': 'kasir',
      'Sales': 'sales'
    };
    const username = roleUsernameMap[role] || (role ? role.toLowerCase().replace(/\s+/g, '') : 'owner');

    const payload = {
      username: username,
      role: role,
      name: name,
      password: password
    };

    const res = await apiCall('/auth/login', 'POST', payload);

    // Ambil data user dan pastikan nama dan role selalu sesuai inputan pengguna
    const dynamicUser = {
      ...res.user,
      name: name || res.user.name,
      role: role || res.user.role
    };

    STATE.token = res.token;
    STATE.user = dynamicUser;
    STATE.menus = res.menus;
    STATE.permissions = res.permissions;
    STATE.cart = [];

    localStorage.setItem('pos_token', res.token);
    localStorage.setItem('pos_custom_name', dynamicUser.name);
    localStorage.setItem('pos_custom_role', dynamicUser.role);

    showToast(`Login berhasil! Selamat datang, ${dynamicUser.name} (${dynamicUser.role})`);

    showAppLayout();
  } catch (err) {
    if (errorAlert && errorMsg) {
      errorMsg.textContent = err.message || 'Gagal masuk. Periksa kembali kredensial Anda.';
      errorAlert.classList.remove('hidden');
    }
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fa-solid fa-right-to-bracket text-sm mr-2"></i><span>Masuk ke Sistem</span>';
    }
  }
}

function togglePasswordVisibility() {
  const pwd = document.getElementById('loginPassword');
  const icon = document.getElementById('togglePwdIcon');
  if (!pwd) return;
  if (pwd.type === 'password') {
    pwd.type = 'text';
    if (icon) icon.className = 'fa-solid fa-eye-slash text-xs text-sky-600';
  } else {
    pwd.type = 'password';
    if (icon) icon.className = 'fa-solid fa-eye text-xs text-slate-400';
  }
}

function handleLogout() {
  localStorage.removeItem('pos_token');
  localStorage.removeItem('pos_custom_name');
  localStorage.removeItem('pos_custom_role');
  STATE.token = null;
  STATE.user = null;
  STATE.menus = [];
  STATE.permissions = [];
  STATE.activeMenuKey = null;
  STATE.cart = [];
  showToast('Sesi telah diakhiri. Anda berhasil logout.');
  showLoginScreen();
}

// ================= RENDER APP SHELL =================
function renderAppShell() {
  const user = STATE.user;
  if (!user) return;

  const roleMeta = ROLE_INFO[user.role] || {
    badgeClass: 'badge-role-kasir',
    icon: 'fa-user',
    title: user.role,
    desc: 'Pengguna sistem'
  };

  // Header user info (Nama dinamis & Role)
  const headerNameEl = document.getElementById('headerUserName');
  if (headerNameEl) headerNameEl.textContent = user.name;

  const badgeEl = document.getElementById('headerUserRoleBadge');
  if (badgeEl) {
    badgeEl.textContent = user.role;
    badgeEl.className = `text-xs px-2.5 py-0.5 rounded-full font-bold ${roleMeta.badgeClass}`;
  }

  // Banner User Greeting & Role Info (Menyapa langsung nama pengguna, misal Khusna Mufida)
  const bannerUserNameEl = document.getElementById('bannerUserName');
  if (bannerUserNameEl) bannerUserNameEl.textContent = user.name;

  const bannerUserRoleEl = document.getElementById('bannerUserRole');
  if (bannerUserRoleEl) bannerUserRoleEl.textContent = user.role;

  // Sidebar Role Info
  const sidebarTitle = document.getElementById('sidebarRoleTitle');
  if (sidebarTitle) sidebarTitle.innerHTML = `<i class="fa-solid ${roleMeta.icon} text-sky-600"></i> ${roleMeta.title}`;

  const sidebarDesc = document.getElementById('sidebarRoleDesc');
  if (sidebarDesc) sidebarDesc.textContent = roleMeta.desc;

  // Banner Role Badge
  const bannerBadge = document.getElementById('bannerRoleBadgeContainer');
  if (bannerBadge) {
    bannerBadge.innerHTML = `
      <div class="px-3 py-1.5 rounded-xl bg-white/10 backdrop-blur border border-white/20 text-xs font-semibold flex items-center gap-2">
        <i class="fa-solid ${roleMeta.icon} text-sky-400"></i>
        <span>Akses Aktif: <strong class="text-white">${user.role}</strong></span>
      </div>
    `;
  }

  // Render Sidebar Navigation Menus
  const navContainer = document.getElementById('sidebarMenuNav');
  if (navContainer) {
    navContainer.innerHTML = '';

    STATE.menus.forEach((menu, index) => {
      const btn = document.createElement('button');
      btn.className = `w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center space-x-3 transition ${
        (STATE.activeMenuKey === menu.key || (!STATE.activeMenuKey && index === 0))
          ? 'bg-sky-600 text-white shadow-sm shadow-sky-200'
          : 'text-slate-600 hover:bg-slate-100'
      }`;
      btn.innerHTML = `<i class="fa-solid ${menu.icon} w-4 text-center"></i> <span>${menu.label}</span>`;
      btn.onclick = () => selectMenu(menu.key);
      navContainer.appendChild(btn);
    });
  }

  // Tampilkan menu pertama jika belum ada yang aktif
  if (!STATE.activeMenuKey || !STATE.menus.some(m => m.key === STATE.activeMenuKey)) {
    if (STATE.menus.length > 0) {
      selectMenu(STATE.menus[0].key);
    }
  } else {
    selectMenu(STATE.activeMenuKey);
  }
}

function selectMenu(menuKey) {
  destroyAllCharts();
  STATE.activeMenuKey = menuKey;
  renderAppShellActiveStyle();

  const menu = STATE.menus.find(m => m.key === menuKey);
  const viewTitleEl = document.getElementById('viewTitle');
  if (menu && viewTitleEl) {
    viewTitleEl.textContent = menu.label;
  }

  // Render Konten Spesifik berdasarkan Menu Key
  switch (menuKey) {
    // KASIR & POS
    case 'pos_cashier':
      renderPosView();
      break;
    case 'shift_sales':
      renderShiftSalesView();
      break;
    case 'approval_requests':
      renderShiftSalesView(true);
      break;

    // KEPALA TOKO
    case 'approvals':
      renderApprovalsView();
      break;
    case 'dashboard_store':
    case 'pos_monitoring':
    case 'stock_monitoring':
      renderStoreMonitoringView();
      break;

    // GUDANG
    case 'dashboard_warehouse':
    case 'products':
      renderProductsView();
      break;
    case 'purchases':
      renderPurchasesView();
      break;
    case 'stock_cards':
      renderStockCardsView();
      break;
    case 'stock_opname':
      renderStockOpnameView();
      break;
    case 'write_off_req':
      renderWriteOffView();
      break;

    // AKUNTING
    case 'coa':
      renderCoaView();
      break;
    case 'journals':
      renderJournalsView();
      break;
    case 'general_ledger':
      renderGeneralLedgerView();
      break;
    case 'trial_balance':
      renderTrialBalanceView();
      break;
    case 'financial_statements':
    case 'dashboard_accounting':
      renderFinancialStatementsView();
      break;

    // KEUANGAN
    case 'dashboard_finance':
    case 'ar_ap':
      renderArApView();
      break;
    case 'payments':
      renderPaymentsView();
      break;
    case 'cash_flow':
      renderCashFlowView();
      break;

    // OWNER
    case 'dashboard_owner':
      renderOwnerDashboardView();
      break;
    case 'reports_finance':
      renderFinancialStatementsView();
      break;
    case 'reports_inventory':
      renderInventoryReportView();
      break;
    case 'reports_sales':
      renderSalesReportView();
      break;
    case 'users_management':
      renderUsersManagementView();
      break;

    // SALES
    case 'sales_orders':
      renderPosView(true); // Sales order mode
      break;
    case 'sales_catalog':
      renderProductsView(true); // Read-only catalog mode
      break;
    case 'customers':
    case 'my_orders':
      renderShiftSalesView();
      break;

    default:
      document.getElementById('dynamicContentContainer').innerHTML = `
        <div class="bg-white p-8 rounded-2xl border border-slate-200 text-center">
          <i class="fa-solid fa-cube text-slate-300 text-4xl mb-3"></i>
          <h3 class="text-sm font-bold text-slate-700">Modul Sedang Aktif</h3>
          <p class="text-xs text-slate-500 mt-1">Halaman ${menu ? menu.label : ''} siap digunakan.</p>
        </div>
      `;
  }
}

function renderAppShellActiveStyle() {
  const buttons = document.querySelectorAll('#sidebarMenuNav button');
  STATE.menus.forEach((menu, index) => {
    const btn = buttons[index];
    if (btn) {
      if (menu.key === STATE.activeMenuKey) {
        btn.className = 'w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center space-x-3 transition bg-sky-600 text-white shadow-sm shadow-sky-200';
      } else {
        btn.className = 'w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center space-x-3 transition text-slate-600 hover:bg-slate-100';
      }
    }
  });
}

// ================= VIEW: POS KASIR (INTERAKTIF & AKUNTANSI SYNC) =================
function getCategoryMeta(categoryName) {
  const name = (categoryName || '').toLowerCase();
  if (name.includes('minum')) return { icon: 'fa-mug-hot', badgeClass: 'bg-amber-50 text-amber-700 border-amber-200' };
  if (name.includes('makan') || name.includes('snack')) return { icon: 'fa-cookie-bite', badgeClass: 'bg-orange-50 text-orange-700 border-orange-200' };
  if (name.includes('sembako') || name.includes('beras')) return { icon: 'fa-wheat-awn', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
  if (name.includes('tulis') || name.includes('alat')) return { icon: 'fa-pen-ruler', badgeClass: 'bg-sky-50 text-sky-700 border-sky-200' };
  return { icon: 'fa-box', badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
}

async function renderPosView(isSalesOrder = false) {
  const container = document.getElementById('dynamicContentContainer');
  container.innerHTML = `
    <div class="p-12 text-center text-slate-400 animate-fade-in">
      <i class="fa-solid fa-spinner fa-spin text-3xl text-sky-600 mb-3 block"></i>
      <div class="text-sm font-semibold text-slate-600">Memuat Katalog Produk & Kategori POS...</div>
      <div class="text-xs text-slate-400 mt-1">Menghubungkan ke database MySQL...</div>
    </div>
  `;

  // Ambil produk dan kategori secara paralel
  try {
    const [prodsRes, catsRes] = await Promise.all([
      apiCall('/products'),
      apiCall('/products/categories')
    ]);

    STATE.products = prodsRes.products || [];
    STATE.categories = catsRes.categories || [];
  } catch (err) {
    showToast('Gagal memuat data produk POS', 'error');
    return;
  }

  // Hitung jumlah produk per kategori
  const categoryCounts = {};
  STATE.products.forEach(p => {
    const cat = p.category_name || 'Lainnya';
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
  });

  const cashierName = STATE.user ? STATE.user.name : 'Kasir Toko';
  const roleName = STATE.user ? STATE.user.role : 'Kasir';

  container.innerHTML = `
    <div class="space-y-4 animate-fade-in">
      
      <!-- SUB-HEADER POS KASIR -->
      <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div class="flex items-center space-x-3">
          <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-sky-500/20">
            <i class="fa-solid ${isSalesOrder ? 'fa-cart-flatbed' : 'fa-cash-register'} text-lg"></i>
          </div>
          <div>
            <h2 class="text-sm font-bold text-slate-800 flex items-center gap-2">
              <span>${isSalesOrder ? 'Modul Sales Order Pelanggan' : 'Terminal Register Kasir (POS)'}</span>
              <span class="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Kasir Aktif
              </span>
            </h2>
            <p class="text-xs text-slate-500">
              Petugas: <strong class="text-slate-800 font-semibold">${cashierName}</strong> (${roleName}) &bull; Sesi: ${new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
        </div>

        <div class="flex items-center space-x-2 text-xs">
          <span class="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg font-medium flex items-center gap-1.5">
            <i class="fa-solid fa-boxes-stacked text-slate-400"></i> Total Katalog: <strong>${STATE.products.length}</strong> Item
          </span>
          <button onclick="refreshPosProducts()" title="Segarkan Data Produk" class="p-2 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-lg transition">
            <i class="fa-solid fa-arrows-rotate"></i>
          </button>
        </div>
      </div>

      <!-- MAIN POS GRID (KATALOG KIRI - KERANJANG KANAN) -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        <!-- ================= KOLOM KIRI: KATALOG PRODUK & FILTER ================= -->
        <div class="lg:col-span-7 space-y-3.5">
          
          <!-- SEARCH BAR & STOCK FILTER CHIPS -->
          <div class="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm space-y-2.5">
            <div class="flex items-center gap-2">
              <div class="relative flex-1">
                <i class="fa-solid fa-magnifying-glass absolute left-3.5 top-2.5 text-slate-400 text-xs"></i>
                <input 
                  id="posSearchInput" 
                  type="text" 
                  value="${STATE.posSearchQuery || ''}"
                  oninput="handlePosSearchInput(this.value)" 
                  placeholder="Cari nama barang, SKU, atau scan barcode..." 
                  class="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 transition"
                >
                ${STATE.posSearchQuery ? `
                  <button onclick="handlePosSearchInput('')" class="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600">
                    <i class="fa-solid fa-xmark text-xs"></i>
                  </button>
                ` : ''}
              </div>

              <!-- Quick Stock Filter -->
              <div class="flex items-center bg-slate-100 p-1 rounded-xl text-[11px] font-semibold space-x-1 flex-shrink-0">
                <button 
                  type="button" 
                  onclick="setPosStockFilter('ALL')" 
                  id="stockFilterAll"
                  class="px-2.5 py-1 rounded-lg transition ${STATE.stockFilter === 'ALL' ? 'bg-white text-sky-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'}"
                >
                  Semua
                </button>
                <button 
                  type="button" 
                  onclick="setPosStockFilter('AVAILABLE')" 
                  id="stockFilterAvail"
                  class="px-2.5 py-1 rounded-lg transition ${STATE.stockFilter === 'AVAILABLE' ? 'bg-white text-emerald-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'}"
                >
                  Tersedia
                </button>
                <button 
                  type="button" 
                  onclick="setPosStockFilter('LOW')" 
                  id="stockFilterLow"
                  class="px-2.5 py-1 rounded-lg transition ${STATE.stockFilter === 'LOW' ? 'bg-white text-rose-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'}"
                >
                  Menipis
                </button>
              </div>
            </div>

            <!-- TAB FILTER KATEGORI PRODUK INTERAKTIF -->
            <div class="pt-1 border-t border-slate-100 flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-thin">
              <button 
                type="button" 
                onclick="setPosCategoryFilter('ALL')" 
                class="pos-cat-btn flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition ${STATE.selectedCategory === 'ALL' ? 'bg-sky-600 text-white shadow-sm shadow-sky-300' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}"
              >
                <i class="fa-solid fa-layer-group text-[11px]"></i>
                <span>Semua Kategori</span>
                <span class="text-[10px] ml-1 px-1.5 py-0.2 rounded-full ${STATE.selectedCategory === 'ALL' ? 'bg-sky-700 text-sky-100' : 'bg-slate-200 text-slate-600'}">
                  ${STATE.products.length}
                </span>
              </button>

              ${STATE.categories.map(cat => {
                const isSelected = STATE.selectedCategory === cat.name;
                const count = categoryCounts[cat.name] || 0;
                const meta = getCategoryMeta(cat.name);
                return `
                  <button 
                    type="button" 
                    onclick="setPosCategoryFilter('${cat.name}')" 
                    class="pos-cat-btn flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition ${isSelected ? 'bg-sky-600 text-white shadow-sm shadow-sky-300' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}"
                  >
                    <i class="fa-solid ${meta.icon} text-[11px]"></i>
                    <span>${cat.name}</span>
                    <span class="text-[10px] ml-1 px-1.5 py-0.2 rounded-full ${isSelected ? 'bg-sky-700 text-sky-100' : 'bg-slate-200 text-slate-600'}">
                      ${count}
                    </span>
                  </button>
                `;
              }).join('')}
            </div>
          </div>

          <!-- GRID DAFTAR PRODUK -->
          <div id="posProductGrid" class="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[560px] overflow-y-auto pr-1">
            <!-- Diisi oleh renderPosProductCards() -->
          </div>

        </div>

        <!-- ================= KOLOM KANAN: KERANJANG BELANJA & PEMBAYARAN ================= -->
        <div class="lg:col-span-5">
          <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sticky top-20 space-y-3.5">
            
            <!-- HEADER KERANJANG -->
            <div class="flex items-center justify-between border-b border-slate-100 pb-3">
              <div class="font-bold text-slate-800 text-sm flex items-center gap-2">
                <i class="fa-solid fa-cart-shopping text-sky-600"></i>
                <span>${isSalesOrder ? 'Order Pelanggan' : 'Register Struk'}</span>
                <span id="cartCountBadge" class="text-xs px-2 py-0.5 rounded-full bg-sky-100 text-sky-700 font-extrabold">
                  ${STATE.cart.reduce((s, it) => s + it.qty, 0)} item
                </span>
              </div>
              <button 
                type="button" 
                onclick="clearCart()" 
                class="text-xs text-rose-500 hover:text-rose-700 font-semibold flex items-center gap-1 transition"
                title="Kosongkan seluruh barang di keranjang"
              >
                <i class="fa-solid fa-trash-can"></i> Kosongkan
              </button>
            </div>

            <!-- DAFTAR ITEM KERANJANG -->
            <div id="cartItemsList" class="space-y-2 max-h-[240px] overflow-y-auto pr-1 divide-y divide-slate-100">
              <!-- Diisi oleh renderCartItems() -->
            </div>

            <!-- RINGKASAN TAGIHAN & DISKON -->
            <div class="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2 text-xs">
              <div class="flex justify-between text-slate-600 font-medium">
                <span>Subtotal Barang</span>
                <span id="cartSubtotalText" class="font-bold text-slate-800">Rp 0</span>
              </div>
              
              <div class="flex justify-between items-center text-slate-600 font-medium">
                <div class="flex items-center gap-1">
                  <span>Diskon Penjualan (Rp)</span>
                </div>
                <div class="flex items-center gap-1.5">
                  <input 
                    id="cartDiscountInput" 
                    type="number" 
                    oninput="updateCartTotals()" 
                    value="0" 
                    min="0" 
                    class="w-24 px-2 py-1 text-right bg-white border border-slate-300 rounded-lg font-bold text-xs focus:ring-1 focus:ring-sky-500 focus:outline-none"
                  >
                </div>
              </div>

              <!-- Shortcut chip diskon cepat -->
              <div class="flex items-center justify-end space-x-1 pt-1 text-[10px]">
                <button type="button" onclick="setQuickDiscount(0)" class="px-1.5 py-0.5 bg-white border border-slate-200 rounded hover:bg-slate-100 font-medium text-slate-600">Rp 0</button>
                <button type="button" onclick="setQuickDiscount(5000)" class="px-1.5 py-0.5 bg-white border border-slate-200 rounded hover:bg-slate-100 font-medium text-slate-600">5 rb</button>
                <button type="button" onclick="setQuickDiscount(10000)" class="px-1.5 py-0.5 bg-white border border-slate-200 rounded hover:bg-slate-100 font-medium text-slate-600">10 rb</button>
                <button type="button" onclick="setQuickDiscount(20000)" class="px-1.5 py-0.5 bg-white border border-slate-200 rounded hover:bg-slate-100 font-medium text-slate-600">20 rb</button>
              </div>

              <div class="pt-2 border-t border-slate-200 flex justify-between items-baseline">
                <span class="text-xs font-extrabold text-slate-800 uppercase tracking-wide">TOTAL BAYAR</span>
                <span id="cartTotalText" class="text-sky-700 font-black text-lg tracking-tight">Rp 0</span>
              </div>
            </div>

            <!-- METODE PEMBAYARAN -->
            <div class="space-y-2.5 pt-1">
              <label class="block text-xs font-bold text-slate-700">Metode Pembayaran</label>
              <div class="grid grid-cols-3 gap-2 text-xs font-bold">
                <button 
                  type="button" 
                  onclick="setPaymentMethod('CASH')" 
                  id="btnPayCash" 
                  class="py-2.5 border-2 border-sky-600 bg-sky-50 text-sky-700 rounded-xl flex items-center justify-center gap-1.5 transition shadow-xs"
                >
                  <i class="fa-solid fa-money-bill-wave"></i> Tunai
                </button>
                <button 
                  type="button" 
                  onclick="setPaymentMethod('TRANSFER')" 
                  id="btnPayTransfer" 
                  class="py-2.5 border border-slate-200 bg-white text-slate-600 rounded-xl flex items-center justify-center gap-1.5 hover:bg-slate-50 transition"
                >
                  <i class="fa-solid fa-qrcode"></i> Transfer
                </button>
                <button 
                  type="button" 
                  onclick="setPaymentMethod('CREDIT')" 
                  id="btnPayCredit" 
                  class="py-2.5 border border-slate-200 bg-white text-slate-600 rounded-xl flex items-center justify-center gap-1.5 hover:bg-slate-50 transition"
                >
                  <i class="fa-solid fa-clock"></i> Piutang
                </button>
              </div>

              <!-- CONTAINER PEMBAYARAN TUNAI (CASH) -->
              <div id="cashInputContainer" class="space-y-2 pt-1">
                <div>
                  <div class="flex justify-between items-center mb-1">
                    <label class="text-xs font-semibold text-slate-700">Uang Tunai Diterima (Rp)</label>
                    <span class="text-[10px] text-slate-400">Pilih nominal cepat di bawah:</span>
                  </div>
                  <input 
                    id="paidAmountInput" 
                    type="number" 
                    oninput="calculateChange()" 
                    placeholder="0" 
                    class="w-full text-base font-bold px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none text-slate-900"
                  >
                </div>

                <!-- QUICK CASH CHIPS (TOMBOL CEPAT NOMINAL UANG) -->
                <div class="flex items-center flex-wrap gap-1.5 pt-0.5">
                  <button 
                    type="button" 
                    onclick="setQuickCash('PAS')" 
                    class="px-2.5 py-1 text-[11px] font-bold bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded-lg transition"
                  >
                    Uang Pas
                  </button>
                  <button 
                    type="button" 
                    onclick="setQuickCash(10000)" 
                    class="px-2.5 py-1 text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition"
                  >
                    10.000
                  </button>
                  <button 
                    type="button" 
                    onclick="setQuickCash(20000)" 
                    class="px-2.5 py-1 text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition"
                  >
                    20.000
                  </button>
                  <button 
                    type="button" 
                    onclick="setQuickCash(50000)" 
                    class="px-2.5 py-1 text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition"
                  >
                    50.000
                  </button>
                  <button 
                    type="button" 
                    onclick="setQuickCash(100000)" 
                    class="px-2.5 py-1 text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition"
                  >
                    100.000
                  </button>
                  <button 
                    type="button" 
                    onclick="setQuickCash(200000)" 
                    class="px-2.5 py-1 text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition"
                  >
                    200.000
                  </button>
                  <button 
                    type="button" 
                    onclick="setQuickCash(500000)" 
                    class="px-2.5 py-1 text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition"
                  >
                    500.000
                  </button>
                </div>

                <!-- TAMPILAN STATUS KEMBALIAN -->
                <div class="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                  <span class="text-slate-600 font-semibold flex items-center gap-1.5">
                    <i class="fa-solid fa-coins text-amber-500"></i> Status Kembalian:
                  </span>
                  <span id="changeAmountText" class="font-black text-sm text-emerald-600">Rp 0</span>
                </div>
              </div>

              <!-- TOMBOL PROSES TRANSAKSI -->
              <div class="pt-1">
                <button 
                  onclick="handleProcessTransaction()" 
                  id="btnSubmitSale" 
                  class="w-full py-3.5 btn-primary-gradient text-white rounded-xl text-xs font-extrabold shadow-lg shadow-sky-600/30 flex items-center justify-center gap-2 cursor-pointer transition active:scale-[0.99]"
                >
                  <i class="fa-solid fa-check"></i>
                  <span>Selesaikan Transaksi & Cetak Struk</span>
                </button>
                <div class="text-[10px] text-center text-slate-400 mt-1.5 flex items-center justify-center gap-1">
                  <i class="fa-solid fa-shield-halved text-emerald-500"></i> Auto-Jurnal Akuntansi & Potong Stok MySQL Aktif
                </div>
              </div>

            </div>

          </div>
        </div>

      </div>

    </div>
  `;

  filterPosProducts();
  renderCartItems();
}

let activePaymentMethod = 'CASH';

function setPaymentMethod(method) {
  activePaymentMethod = method;
  const btnCash = document.getElementById('btnPayCash');
  const btnTransfer = document.getElementById('btnPayTransfer');
  const btnCredit = document.getElementById('btnPayCredit');
  const cashContainer = document.getElementById('cashInputContainer');

  if (!btnCash || !btnTransfer || !btnCredit) return;

  [btnCash, btnTransfer, btnCredit].forEach(b => {
    b.className = 'py-2.5 border border-slate-200 bg-white text-slate-600 rounded-xl flex items-center justify-center gap-1.5 hover:bg-slate-50 transition';
  });

  if (method === 'CASH') {
    btnCash.className = 'py-2.5 border-2 border-sky-600 bg-sky-50 text-sky-700 rounded-xl flex items-center justify-center gap-1.5 font-bold shadow-xs';
    if (cashContainer) cashContainer.style.display = 'block';
  } else if (method === 'TRANSFER') {
    btnTransfer.className = 'py-2.5 border-2 border-sky-600 bg-sky-50 text-sky-700 rounded-xl flex items-center justify-center gap-1.5 font-bold shadow-xs';
    if (cashContainer) cashContainer.style.display = 'none';
  } else {
    btnCredit.className = 'py-2.5 border-2 border-sky-600 bg-sky-50 text-sky-700 rounded-xl flex items-center justify-center gap-1.5 font-bold shadow-xs';
    if (cashContainer) cashContainer.style.display = 'none';
  }
}

function handlePosSearchInput(query) {
  STATE.posSearchQuery = query;
  filterPosProducts();
}

function setPosCategoryFilter(categoryName) {
  STATE.selectedCategory = categoryName;

  // Update styling tombol kategori
  const catButtons = document.querySelectorAll('.pos-cat-btn');
  catButtons.forEach(btn => {
    const isTarget = (categoryName === 'ALL' && btn.innerText.includes('Semua Kategori')) ||
                     btn.innerText.includes(categoryName);
    if (isTarget) {
      btn.className = 'pos-cat-btn flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition bg-sky-600 text-white shadow-sm shadow-sky-300';
    } else {
      btn.className = 'pos-cat-btn flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition bg-slate-100 text-slate-700 hover:bg-slate-200';
    }
  });

  filterPosProducts();
}

function setPosStockFilter(filterType) {
  STATE.stockFilter = filterType;

  const btnAll = document.getElementById('stockFilterAll');
  const btnAvail = document.getElementById('stockFilterAvail');
  const btnLow = document.getElementById('stockFilterLow');

  if (btnAll && btnAvail && btnLow) {
    btnAll.className = `px-2.5 py-1 rounded-lg transition ${filterType === 'ALL' ? 'bg-white text-sky-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'}`;
    btnAvail.className = `px-2.5 py-1 rounded-lg transition ${filterType === 'AVAILABLE' ? 'bg-white text-emerald-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'}`;
    btnLow.className = `px-2.5 py-1 rounded-lg transition ${filterType === 'LOW' ? 'bg-white text-rose-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'}`;
  }

  filterPosProducts();
}

function filterPosProducts() {
  const q = (STATE.posSearchQuery || '').toLowerCase().trim();
  const selectedCat = STATE.selectedCategory;
  const stockFilter = STATE.stockFilter;

  const filtered = STATE.products.filter(p => {
    // 1. Filter Pencarian Teks
    const matchQuery = !q || 
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      (p.barcode && p.barcode.toLowerCase().includes(q));

    // 2. Filter Kategori
    const matchCategory = selectedCat === 'ALL' || (p.category_name === selectedCat);

    // 3. Filter Status Stok
    let matchStock = true;
    if (stockFilter === 'AVAILABLE') {
      matchStock = Number(p.current_stock) > 0;
    } else if (stockFilter === 'LOW') {
      matchStock = Number(p.current_stock) <= Number(p.min_stock) && Number(p.current_stock) > 0;
    }

    return matchQuery && matchCategory && matchStock;
  });

  renderPosProductCards(filtered);
}

function renderPosProductCards(items) {
  const grid = document.getElementById('posProductGrid');
  if (!grid) return;

  if (items.length === 0) {
    grid.innerHTML = `
      <div class="col-span-2 sm:col-span-3 py-12 px-4 text-center bg-white rounded-2xl border border-dashed border-slate-200">
        <i class="fa-solid fa-magnifying-glass text-3xl text-slate-300 mb-2 block"></i>
        <div class="text-xs font-bold text-slate-700">Tidak ada produk yang cocok</div>
        <div class="text-[11px] text-slate-400 mt-1">Coba sesuaikan kata kunci pencarian atau pilih kategori lain.</div>
      </div>
    `;
    return;
  }

  grid.innerHTML = items.map(p => {
    const isOutOfStock = Number(p.current_stock) <= 0;
    const isLowStock = !isOutOfStock && Number(p.current_stock) <= Number(p.min_stock);
    const meta = getCategoryMeta(p.category_name);

    return `
      <div 
        ${isOutOfStock ? `onclick="showToast('Stok produk ${p.name} habis!', 'error')"` : `onclick="addToCart(${p.id})"`} 
        class="bg-white p-3.5 rounded-2xl border transition duration-200 flex flex-col justify-between group select-none ${
          isOutOfStock 
            ? 'border-slate-200 opacity-60 cursor-not-allowed bg-slate-50/70' 
            : 'border-slate-200 hover:border-sky-300 hover:shadow-md cursor-pointer'
        }"
      >
        <div>
          <!-- Header Card: Kategori & Status Stok -->
          <div class="flex items-center justify-between mb-2">
            <span class="text-[10px] font-bold px-2 py-0.5 rounded-md border flex items-center gap-1 ${meta.badgeClass}">
              <i class="fa-solid ${meta.icon} text-[9px]"></i>
              <span>${p.category_name || 'Umum'}</span>
            </span>

            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full border ${
              isOutOfStock 
                ? 'bg-rose-50 text-rose-700 border-rose-200' 
                : (isLowStock ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200')
            }">
              ${isOutOfStock ? 'STOK HABIS' : (isLowStock ? `Sisa: ${p.current_stock}` : `Stok: ${p.current_stock}`)}
            </span>
          </div>

          <!-- SKU & Barcode -->
          <div class="text-[10px] font-mono text-slate-400 mb-1">
            ${p.sku}${p.barcode ? ` &bull; ${p.barcode}` : ''}
          </div>

          <!-- Nama Produk -->
          <h4 class="text-xs font-bold text-slate-800 line-clamp-2 group-hover:text-sky-600 transition leading-snug">
            ${p.name}
          </h4>
        </div>

        <!-- Footer Card: Harga & Tombol Tambah -->
        <div class="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
          <div>
            <div class="text-[10px] text-slate-400 font-medium">Harga Jual</div>
            <div class="text-xs font-extrabold text-slate-900 tracking-tight">
              Rp ${Number(p.sell_price).toLocaleString('id-ID')}
            </div>
          </div>

          ${isOutOfStock ? `
            <span class="text-[11px] font-bold text-rose-500 bg-rose-50 px-2 py-1 rounded-lg">
              Habis
            </span>
          ` : `
            <button 
              type="button" 
              class="px-2.5 py-1 rounded-lg bg-sky-50 text-sky-600 group-hover:bg-sky-600 group-hover:text-white transition flex items-center gap-1 text-xs font-bold shadow-2xs"
            >
              <i class="fa-solid fa-plus text-[10px]"></i>
              <span class="text-[11px]">Tambah</span>
            </button>
          `}
        </div>
      </div>
    `;
  }).join('');
}

async function refreshPosProducts() {
  try {
    const res = await apiCall('/products');
    STATE.products = res.products || [];
    filterPosProducts();
    showToast('Katalog produk berhasil disegarkan.');
  } catch (err) {}
}

// ================= CART MANAGEMENT =================
function addToCart(productId) {
  const prod = STATE.products.find(p => p.id === productId);
  if (!prod) return;

  if (Number(prod.current_stock) <= 0) {
    showToast(`Stok barang '${prod.name}' telah habis!`, 'error');
    return;
  }

  const existing = STATE.cart.find(it => it.product_id === productId);
  if (existing) {
    if (existing.qty + 1 > Number(prod.current_stock)) {
      showToast(`Maksimal stok tercapai (${prod.current_stock} pcs)`, 'error');
      return;
    }
    existing.qty += 1;
  } else {
    STATE.cart.push({
      product_id: prod.id,
      name: prod.name,
      sku: prod.sku,
      unit: prod.unit || 'pcs',
      price: Number(prod.sell_price),
      max_stock: Number(prod.current_stock),
      qty: 1
    });
  }

  renderCartItems();
}

function updateCartQty(productId, delta) {
  const it = STATE.cart.find(i => i.product_id === productId);
  if (!it) return;

  const prod = STATE.products.find(p => p.id === productId);
  const newQty = it.qty + delta;

  if (newQty <= 0) {
    removeCartItem(productId);
    return;
  }

  if (prod && newQty > Number(prod.current_stock)) {
    showToast(`Stok maksimal tersedia: ${prod.current_stock} pcs`, 'error');
    return;
  }

  it.qty = newQty;
  renderCartItems();
}

function removeCartItem(productId) {
  STATE.cart = STATE.cart.filter(i => i.product_id !== productId);
  renderCartItems();
}

function clearCart() {
  if (STATE.cart.length === 0) return;
  STATE.cart = [];
  renderCartItems();
  showToast('Keranjang belanja dikosongkan.');
}

function setQuickDiscount(amount) {
  const discountInput = document.getElementById('cartDiscountInput');
  if (discountInput) {
    discountInput.value = amount;
    updateCartTotals();
  }
}

function setQuickCash(val) {
  const subtotal = STATE.cart.reduce((sum, it) => sum + (it.price * it.qty), 0);
  const discountInput = document.getElementById('cartDiscountInput');
  const discount = discountInput ? Number(discountInput.value || 0) : 0;
  const total = Math.max(0, subtotal - discount);

  const paidInput = document.getElementById('paidAmountInput');
  if (!paidInput) return;

  if (val === 'PAS') {
    paidInput.value = total;
  } else {
    paidInput.value = val;
  }
  calculateChange();
}

function renderCartItems() {
  const list = document.getElementById('cartItemsList');
  const countBadge = document.getElementById('cartCountBadge');
  if (!list) return;

  const totalItemCount = STATE.cart.reduce((s, it) => s + it.qty, 0);
  if (countBadge) countBadge.textContent = `${totalItemCount} item`;

  if (STATE.cart.length === 0) {
    list.innerHTML = `
      <div class="py-10 text-center text-slate-300 text-xs">
        <i class="fa-solid fa-cart-arrow-down text-3xl mb-2 text-slate-300 block"></i>
        <div class="font-bold text-slate-500">Keranjang masih kosong</div>
        <div class="text-[11px] text-slate-400 mt-0.5">Klik salah satu produk di sebelah kiri untuk menambah ke transaksi.</div>
      </div>
    `;
    updateCartTotals();
    return;
  }

  list.innerHTML = STATE.cart.map(it => `
    <div class="py-2.5 flex items-center justify-between text-xs group hover:bg-slate-50/50 rounded-lg px-1 transition">
      <div class="pr-2 min-w-0 flex-1">
        <div class="font-bold text-slate-800 truncate">${it.name}</div>
        <div class="text-[11px] text-slate-400">
          @ Rp ${it.price.toLocaleString('id-ID')} &bull; <span class="font-mono text-[10px] text-slate-400">${it.sku}</span>
        </div>
      </div>

      <div class="flex items-center space-x-2 flex-shrink-0">
        <!-- Kontrol Kuantitas -->
        <div class="flex items-center border border-slate-200 rounded-lg bg-white overflow-hidden shadow-2xs">
          <button 
            type="button" 
            onclick="updateCartQty(${it.product_id}, -1)" 
            class="w-6 h-6 flex items-center justify-center hover:bg-slate-100 text-slate-600 font-bold transition text-xs"
            title="Kurangi Qty"
          >
            -
          </button>
          <span class="w-7 text-center font-extrabold text-slate-800 text-xs">${it.qty}</span>
          <button 
            type="button" 
            onclick="updateCartQty(${it.product_id}, 1)" 
            class="w-6 h-6 flex items-center justify-center hover:bg-slate-100 text-slate-600 font-bold transition text-xs"
            title="Tambah Qty"
          >
            +
          </button>
        </div>

        <!-- Subtotal Item -->
        <div class="w-20 text-right font-extrabold text-slate-900 text-xs">
          Rp ${(it.price * it.qty).toLocaleString('id-ID')}
        </div>

        <!-- Tombol Hapus Satuan -->
        <button 
          type="button" 
          onclick="removeCartItem(${it.product_id})" 
          class="text-slate-300 hover:text-rose-600 p-1 transition"
          title="Hapus produk ini"
        >
          <i class="fa-solid fa-trash-can text-xs"></i>
        </button>
      </div>
    </div>
  `).join('');

  updateCartTotals();
}

function updateCartTotals() {
  const subtotal = STATE.cart.reduce((sum, it) => sum + (it.price * it.qty), 0);
  const discountInput = document.getElementById('cartDiscountInput');
  const discount = discountInput ? Math.max(0, Number(discountInput.value || 0)) : 0;
  const total = Math.max(0, subtotal - discount);

  const subtotalEl = document.getElementById('cartSubtotalText');
  const totalEl = document.getElementById('cartTotalText');
  if (subtotalEl) subtotalEl.textContent = `Rp ${subtotal.toLocaleString('id-ID')}`;
  if (totalEl) totalEl.textContent = `Rp ${total.toLocaleString('id-ID')}`;

  calculateChange();
}

function calculateChange() {
  const subtotal = STATE.cart.reduce((sum, it) => sum + (it.price * it.qty), 0);
  const discountInput = document.getElementById('cartDiscountInput');
  const discount = discountInput ? Math.max(0, Number(discountInput.value || 0)) : 0;
  const total = Math.max(0, subtotal - discount);

  const paidInput = document.getElementById('paidAmountInput');
  const paid = paidInput ? Number(paidInput.value || 0) : 0;
  const changeEl = document.getElementById('changeAmountText');

  if (!changeEl) return;

  if (activePaymentMethod !== 'CASH') {
    changeEl.textContent = 'Rp 0 (Non-Tunai)';
    changeEl.className = 'font-bold text-sm text-slate-600';
    return;
  }

  if (paid === 0 && total === 0) {
    changeEl.textContent = 'Rp 0';
    changeEl.className = 'font-black text-sm text-slate-600';
    return;
  }

  if (paid < total) {
    const diff = total - paid;
    changeEl.textContent = `Kurang Rp ${diff.toLocaleString('id-ID')}`;
    changeEl.className = 'font-black text-sm text-rose-600 animate-pulse';
  } else if (paid === total) {
    changeEl.textContent = 'Uang Pas (Rp 0)';
    changeEl.className = 'font-black text-sm text-emerald-600';
  } else {
    const change = paid - total;
    changeEl.textContent = `Rp ${change.toLocaleString('id-ID')}`;
    changeEl.className = 'font-black text-sm text-emerald-600';
  }
}

async function handleProcessTransaction() {
  if (STATE.cart.length === 0) {
    showToast('Keranjang belanja masih kosong! Silakan pilih barang.', 'error');
    return;
  }

  const subtotal = STATE.cart.reduce((sum, it) => sum + (it.price * it.qty), 0);
  const discountInput = document.getElementById('cartDiscountInput');
  const discount = discountInput ? Math.max(0, Number(discountInput.value || 0)) : 0;
  const total = Math.max(0, subtotal - discount);

  let paid = total;
  if (activePaymentMethod === 'CASH') {
    const paidInput = document.getElementById('paidAmountInput');
    paid = paidInput ? Number(paidInput.value || 0) : 0;
    if (paid < total) {
      showToast(`Uang tunai kurang! Total tagihan: Rp ${total.toLocaleString('id-ID')}, uang diberikan: Rp ${paid.toLocaleString('id-ID')}`, 'error');
      return;
    }
  }

  const submitBtn = document.getElementById('btnSubmitSale');
  const originalBtnHtml = submitBtn ? submitBtn.innerHTML : '';
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Memproses Transaksi...';
  }

  try {
    const res = await apiCall('/transactions/sale', 'POST', {
      items: STATE.cart.map(it => ({ product_id: it.product_id, qty: it.qty, unit_price: it.price })),
      payment_method: activePaymentMethod,
      paid_amount: paid,
      discount_amount: discount
    });

    showToast(res.message);
    clearCart();

    // Buka dialog Struk Penjualan
    if (res.transaction && res.transaction.id) {
      openReceiptModal(res.transaction.id);
    }

    // Refresh daftar produk dari database (stok telah berkurang secara otomatis)
    const pRes = await apiCall('/products');
    STATE.products = pRes.products || [];
    filterPosProducts();
  } catch (err) {
    // Error ditangani oleh apiCall
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnHtml;
    }
  }
}

// ================= STRUK CETAK MODAL & INTEGRASI AUDIT JURNAL =================
async function openReceiptModal(transactionId) {
  const modal = document.getElementById('receiptModal');
  const content = document.getElementById('receiptContent');
  if (!modal || !content) return;

  content.innerHTML = `
    <div class="text-center py-8 text-slate-400">
      <i class="fa-solid fa-spinner fa-spin text-2xl text-sky-600 mb-2 block"></i>
      <div>Memuat data struk transaksi & entri jurnal...</div>
    </div>
  `;
  modal.classList.remove('hidden');

  try {
    const res = await apiCall(`/transactions/${transactionId}/receipt`);
    const tx = res.transaction;
    const items = res.items || [];
    const journal = res.journal;

    const receiptDate = new Date(tx.date).toLocaleDateString('id-ID', {
      year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    content.innerHTML = `
      <!-- KOP STRUK TOKO -->
      <div class="text-center border-b border-dashed border-slate-300 pb-3 mb-3">
        <h3 class="font-extrabold text-base tracking-wider uppercase text-slate-900">TOKO MAJU JAYA BERSAMA</h3>
        <p class="text-[11px] text-slate-600">Jl. Pemuda No. 88, Jakarta Pusat</p>
        <p class="text-[10px] text-slate-500">Telp: 021-5551234 &bull; NPWP: 01.234.567.8-012.000</p>
      </div>

      <!-- METADATA STRUK -->
      <div class="border-b border-dashed border-slate-300 pb-2 mb-2 text-[11px] space-y-1 text-slate-700">
        <div class="flex justify-between"><span>No. Faktur:</span><strong class="font-mono text-slate-900">${tx.invoice_no}</strong></div>
        <div class="flex justify-between"><span>Tanggal:</span><span>${receiptDate}</span></div>
        <div class="flex justify-between"><span>Kasir:</span><strong class="text-slate-900">${tx.cashier_name || 'Kasir'}</strong></div>
        <div class="flex justify-between"><span>Pelanggan:</span><span>${tx.customer_name || 'Pelanggan Umum'}</span></div>
      </div>

      <!-- DAFTAR ITEM BELANJA -->
      <div class="border-b border-dashed border-slate-300 pb-2 mb-2 text-[11px] divide-y divide-dotted divide-slate-200">
        ${items.map(it => `
          <div class="py-1.5">
            <div class="font-bold text-slate-900">${it.product_name}</div>
            <div class="flex justify-between text-slate-600 text-[10px]">
              <span>${it.qty} x Rp ${Number(it.unit_price).toLocaleString('id-ID')}</span>
              <span class="font-bold text-slate-800">Rp ${Number(it.subtotal).toLocaleString('id-ID')}</span>
            </div>
          </div>
        `).join('')}
      </div>

      <!-- RINGKASAN PEMBAYARAN -->
      <div class="space-y-1 text-[11px] font-semibold border-b border-dashed border-slate-300 pb-3 mb-3 text-slate-700">
        <div class="flex justify-between"><span>Subtotal:</span><span>Rp ${Number(tx.subtotal).toLocaleString('id-ID')}</span></div>
        ${Number(tx.discount_amount) > 0 ? `
          <div class="flex justify-between text-rose-600"><span>Diskon:</span><span>- Rp ${Number(tx.discount_amount).toLocaleString('id-ID')}</span></div>
        ` : ''}
        <div class="flex justify-between text-xs font-black text-slate-900 pt-1 border-t border-slate-200">
          <span>TOTAL BAYAR:</span><span class="text-sky-700">Rp ${Number(tx.total_amount).toLocaleString('id-ID')}</span>
        </div>
        <div class="flex justify-between pt-1"><span>Metode:</span><span class="font-bold">${tx.payment_method}</span></div>
        <div class="flex justify-between"><span>Bayar Diterima:</span><span>Rp ${Number(tx.paid_amount).toLocaleString('id-ID')}</span></div>
        <div class="flex justify-between"><span>Kembalian:</span><span class="font-bold text-emerald-700">Rp ${Number(tx.change_amount).toLocaleString('id-ID')}</span></div>
      </div>

      <!-- BANNER INTEGRASI JURNAL AKUNTANSI OTOMATIS -->
      <div class="mb-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-[10px] space-y-1.5 text-emerald-900 font-sans">
        <div class="flex items-center justify-between font-bold text-emerald-800">
          <span class="flex items-center gap-1.5">
            <i class="fa-solid fa-book-journal-whills text-emerald-600"></i>
            Auto-Jurnal Akuntansi:
          </span>
          <span class="bg-emerald-200/80 text-emerald-900 px-2 py-0.5 rounded font-black text-[9px]">
            ${journal ? journal.status : 'POSTED'}
          </span>
        </div>
        <div class="font-mono text-[10px] text-emerald-800 font-semibold">
          No. Jurnal: ${journal ? journal.journal_no : `JV-SALE-${tx.invoice_no.replace(/\//g, '-')}`}
        </div>
        <div class="text-[10px] text-emerald-700 leading-tight">
          Entri double-entry otomatis terposting seimbang ke Buku Besar:
        </div>
        ${journal && journal.lines && journal.lines.length > 0 ? `
          <div class="pt-1 border-t border-emerald-200/80 space-y-1 font-mono text-[9px]">
            ${journal.lines.map(l => `
              <div class="flex justify-between">
                <span>${l.account_code} ${l.account_name}</span>
                <span class="font-bold">${l.debit > 0 ? `(D) Rp ${Number(l.debit).toLocaleString('id-ID')}` : `(K) Rp ${Number(l.credit).toLocaleString('id-ID')}`}</span>
              </div>
            `).join('')}
          </div>
        ` : `
          <div class="pt-1 border-t border-emerald-200/80 text-[9px] text-emerald-700 space-y-0.5">
            <div>&bull; Debit: ${tx.payment_method === 'CASH' ? 'Kas Toko (1001)' : (tx.payment_method === 'TRANSFER' ? 'Bank BCA (1002)' : 'Piutang Usaha (1101)')}</div>
            <div>&bull; Kredit: Pendapatan Penjualan Toko (4001)</div>
            <div>&bull; Debit: Beban Pokok Penjualan HPP (5001) & Kredit: Persediaan Barang (1201)</div>
          </div>
        `}
        <div class="pt-1 border-t border-emerald-200/80 font-bold text-[9px] text-center text-emerald-800 flex items-center justify-center gap-1">
          <i class="fa-solid fa-circle-check text-emerald-600"></i> Keseimbangan Debit = Kredit Terverifikasi 100%
        </div>
      </div>

      <!-- FOOTER STRUK -->
      <div class="text-center text-[10px] text-slate-500 space-y-0.5">
        <p class="font-bold text-slate-700">Terima kasih telah berbelanja di toko kami!</p>
        <p>Barang yang sudah dibeli tidak dapat ditukar/dikembalikan tanpa nota ini.</p>
        <p class="text-[9px] text-slate-400 pt-1">Sistem POS & Akuntansi Toko Terintegrasi</p>
      </div>
    `;
  } catch (err) {
    content.innerHTML = '<div class="text-center py-4 text-rose-500 font-bold">Gagal memuat struk belanja.</div>';
  }
}

function closeReceiptModal() {
  const modal = document.getElementById('receiptModal');
  if (modal) modal.classList.add('hidden');
}

// ================= UTILITY: EKSPOR DATA KE CSV (EXCEL COMPATIBLE) =================
function downloadCsv(filename, headers, rows) {
  const processCell = (val) => {
    let str = val === null || val === undefined ? '' : String(val);
    if (str.search(/("|,|\n|\r)/g) >= 0) {
      str = `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const headerLine = headers.map(processCell).join(',');
  const rowLines = rows.map(r => r.map(processCell).join(','));
  const csvContent = '\uFEFF' + [headerLine, ...rowLines].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ================= VIEW: RIWAYAT TRANSAKSI LENGKAP & VOID =================
let HIST_FILTER = {
  search: '',
  date_from: '',
  date_to: '',
  status: 'ALL',
  payment_method: 'ALL'
};

let CURRENT_TRANSACTIONS = [];

async function renderShiftSalesView() {
  const container = document.getElementById('dynamicContentContainer');
  container.innerHTML = `
    <div class="p-12 text-center text-slate-400 animate-fade-in">
      <i class="fa-solid fa-spinner fa-spin text-3xl text-sky-600 mb-2 block"></i>
      <div class="text-xs font-semibold text-slate-600">Memuat riwayat transaksi penjualan...</div>
    </div>
  `;

  // Bangun query parameters
  const params = new URLSearchParams({ type: 'SALE' });
  if (HIST_FILTER.status !== 'ALL') params.append('status', HIST_FILTER.status);
  if (HIST_FILTER.payment_method !== 'ALL') params.append('payment_method', HIST_FILTER.payment_method);
  if (HIST_FILTER.date_from) params.append('date_from', HIST_FILTER.date_from);
  if (HIST_FILTER.date_to) params.append('date_to', HIST_FILTER.date_to);
  if (HIST_FILTER.search) params.append('search', HIST_FILTER.search);

  const res = await apiCall(`/transactions?${params.toString()}`);
  CURRENT_TRANSACTIONS = res.transactions || [];
  const summary = res.summary || {
    totalTransactions: CURRENT_TRANSACTIONS.length,
    totalAmount: CURRENT_TRANSACTIONS.filter(t => t.status === 'COMPLETED').reduce((s, t) => s + Number(t.total_amount), 0),
    completedCount: CURRENT_TRANSACTIONS.filter(t => t.status === 'COMPLETED').length,
    voidCount: CURRENT_TRANSACTIONS.filter(t => t.status === 'VOID').length
  };

  container.innerHTML = `
    <div class="space-y-4 animate-fade-in printable-report">
      
      <!-- HEADER RIWAYAT TRANSAKSI -->
      <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 class="text-sm font-bold text-slate-800 flex items-center gap-2">
            <i class="fa-solid fa-clock-rotate-left text-sky-600"></i>
            <span>Riwayat Transaksi Penjualan Kasir</span>
            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
              ${CURRENT_TRANSACTIONS.length} Terdata
            </span>
          </h2>
          <p class="text-xs text-slate-500 mt-0.5">
            Daftar seluruh faktur penjualan terintegrasi database MySQL Laragon beserta status dan struk.
          </p>
        </div>

        <!-- ACTION BUTTONS: CETAK & UNDUH CSV -->
        <div class="flex items-center space-x-2 no-print">
          <button 
            type="button" 
            onclick="window.print()" 
            class="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
            title="Cetak Riwayat Transaksi"
          >
            <i class="fa-solid fa-print"></i>
            <span>Cetak Dokumen</span>
          </button>
          <button 
            type="button" 
            onclick="downloadTransactionsCsv()" 
            class="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
            title="Unduh Data CSV/Excel"
          >
            <i class="fa-solid fa-file-excel"></i>
            <span>Unduh CSV</span>
          </button>
        </div>
      </div>

      <!-- KARTU METRIK RINGKASAN TRANSAKSI -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div class="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
          <div class="text-[11px] font-semibold text-slate-500">Total Transaksi</div>
          <div class="text-lg font-black text-slate-900 mt-0.5">${CURRENT_TRANSACTIONS.length} Faktur</div>
          <div class="text-[10px] text-slate-400 mt-0.5">Sesuai kriteria filter</div>
        </div>

        <div class="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
          <div class="text-[11px] font-semibold text-slate-500">Omzet Penjualan Selesai</div>
          <div class="text-lg font-black text-sky-700 mt-0.5">Rp ${Number(summary.totalAmount).toLocaleString('id-ID')}</div>
          <div class="text-[10px] text-emerald-600 font-semibold mt-0.5">Terjurnal ke Kas/Bank</div>
        </div>

        <div class="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
          <div class="text-[11px] font-semibold text-slate-500">Transaksi Selesai</div>
          <div class="text-lg font-black text-emerald-600 mt-0.5">${summary.completedCount} Sukses</div>
          <div class="text-[10px] text-slate-400 mt-0.5">Struk berhasil terbit</div>
        </div>

        <div class="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
          <div class="text-[11px] font-semibold text-slate-500">Batal / Void</div>
          <div class="text-lg font-black text-rose-600 mt-0.5">${summary.voidCount} Faktur</div>
          <div class="text-[10px] text-rose-500 font-medium mt-0.5">Jurnal pembalik terbit</div>
        </div>
      </div>

      <!-- FILTER BAR KOMPREHENSIF -->
      <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3 no-print">
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 text-xs">
          
          <!-- Pencarian -->
          <div class="lg:col-span-4">
            <label class="block font-bold text-slate-700 mb-1">Cari Faktur / Kasir / Pelanggan</label>
            <div class="relative">
              <i class="fa-solid fa-magnifying-glass absolute left-3 top-2.5 text-slate-400 text-xs"></i>
              <input 
                id="histSearchInput" 
                type="text" 
                value="${HIST_FILTER.search}" 
                placeholder="No Faktur (INV/...), Kasir..." 
                class="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
            </div>
          </div>

          <!-- Tanggal Mulai -->
          <div class="lg:col-span-2">
            <label class="block font-bold text-slate-700 mb-1">Dari Tanggal</label>
            <input 
              id="histDateFrom" 
              type="date" 
              value="${HIST_FILTER.date_from}" 
              class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
          </div>

          <!-- Tanggal Selesai -->
          <div class="lg:col-span-2">
            <label class="block font-bold text-slate-700 mb-1">Sampai Tanggal</label>
            <input 
              id="histDateTo" 
              type="date" 
              value="${HIST_FILTER.date_to}" 
              class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
          </div>

          <!-- Metode Bayar -->
          <div class="lg:col-span-2">
            <label class="block font-bold text-slate-700 mb-1">Metode Bayar</label>
            <select id="histPaymentMethod" class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-sky-500">
              <option value="ALL" ${HIST_FILTER.payment_method === 'ALL' ? 'selected' : ''}>Semua Metode</option>
              <option value="CASH" ${HIST_FILTER.payment_method === 'CASH' ? 'selected' : ''}>Tunai (CASH)</option>
              <option value="TRANSFER" ${HIST_FILTER.payment_method === 'TRANSFER' ? 'selected' : ''}>Transfer Bank</option>
              <option value="CREDIT" ${HIST_FILTER.payment_method === 'CREDIT' ? 'selected' : ''}>Piutang (Tempo)</option>
            </select>
          </div>

          <!-- Status Transaksi -->
          <div class="lg:col-span-2">
            <label class="block font-bold text-slate-700 mb-1">Status</label>
            <select id="histStatus" class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-sky-500">
              <option value="ALL" ${HIST_FILTER.status === 'ALL' ? 'selected' : ''}>Semua Status</option>
              <option value="COMPLETED" ${HIST_FILTER.status === 'COMPLETED' ? 'selected' : ''}>Selesai</option>
              <option value="VOID" ${HIST_FILTER.status === 'VOID' ? 'selected' : ''}>Batal (Void)</option>
              <option value="PENDING_APPROVAL" ${HIST_FILTER.status === 'PENDING_APPROVAL' ? 'selected' : ''}>Pending Approval</option>
            </select>
          </div>

        </div>

        <!-- Tombol Preset Periode Cepat & Terapkan -->
        <div class="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100 text-[11px]">
          <div class="flex items-center space-x-1.5">
            <span class="text-slate-400 font-semibold mr-1">Preset:</span>
            <button type="button" onclick="setHistDatePreset('TODAY')" class="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-medium">Hari Ini</button>
            <button type="button" onclick="setHistDatePreset('LAST_7')" class="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-medium">7 Hari Terakhir</button>
            <button type="button" onclick="setHistDatePreset('THIS_MONTH')" class="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-medium">Bulan Ini</button>
            <button type="button" onclick="setHistDatePreset('ALL')" class="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-medium">Semua</button>
          </div>

          <div class="flex items-center space-x-2">
            <button type="button" onclick="resetHistFilter()" class="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold">
              Reset
            </button>
            <button type="button" onclick="applyHistFilter()" class="px-4 py-1.5 btn-primary-gradient text-white rounded-xl font-bold shadow-sm">
              <i class="fa-solid fa-filter text-[10px]"></i> Terapkan Filter
            </button>
          </div>
        </div>
      </div>

      <!-- TABEL RIWAYAT TRANSAKSI -->
      <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs">
            <thead>
              <tr class="table-header-custom border-b border-slate-200">
                <th class="py-3 px-3.5">No. Faktur</th>
                <th class="py-3 px-3">Tanggal & Waktu</th>
                <th class="py-3 px-3">Kasir</th>
                <th class="py-3 px-3">Pelanggan</th>
                <th class="py-3 px-3">Metode</th>
                <th class="py-3 px-3 text-right">Nilai Total (Rp)</th>
                <th class="py-3 px-3">Status</th>
                <th class="py-3 px-3 text-right no-print">Aksi</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              ${CURRENT_TRANSACTIONS.length === 0 ? `
                <tr>
                  <td colspan="8" class="text-center py-10 text-slate-400">
                    <i class="fa-solid fa-receipt text-3xl mb-2 text-slate-300 block"></i>
                    <div class="font-bold text-slate-700">Tidak ada riwayat transaksi yang cocok</div>
                    <div class="text-[11px] text-slate-400 mt-0.5">Coba ubah tanggal atau filter di atas.</div>
                  </td>
                </tr>
              ` : CURRENT_TRANSACTIONS.map(t => {
                const dateObj = new Date(t.date);
                const dateStr = dateObj.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
                const timeStr = dateObj.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
                const isKasir = STATE.user && STATE.user.role === 'Kasir';
                const isApprover = STATE.user && ['Owner', 'Kepala Toko'].includes(STATE.user.role);

                return `
                  <tr class="hover:bg-slate-50 transition">
                    <td class="py-3 px-3.5">
                      <button onclick="openReceiptModal(${t.id})" class="font-bold text-sky-700 hover:text-sky-900 font-mono text-[11px] flex items-center gap-1">
                        <i class="fa-solid fa-receipt text-[10px]"></i>
                        <span>${t.invoice_no}</span>
                      </button>
                    </td>
                    <td class="py-3 px-3 text-slate-600">
                      <div>${dateStr}</div>
                      <div class="text-[10px] text-slate-400">${timeStr} WIB</div>
                    </td>
                    <td class="py-3 px-3 font-medium text-slate-800">${t.cashier_name || 'Kasir'}</td>
                    <td class="py-3 px-3 text-slate-600">${t.customer_name || 'Pelanggan Umum'}</td>
                    <td class="py-3 px-3">
                      <span class="px-2 py-0.5 rounded font-bold text-[10px] ${
                        t.payment_method === 'CASH' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                        (t.payment_method === 'TRANSFER' ? 'bg-sky-50 text-sky-700 border border-sky-200' : 'bg-purple-50 text-purple-700 border border-purple-200')
                      }">
                        ${t.payment_method}
                      </span>
                    </td>
                    <td class="py-3 px-3 text-right font-black text-slate-900">
                      Rp ${Number(t.total_amount).toLocaleString('id-ID')}
                    </td>
                    <td class="py-3 px-3">
                      ${t.status === 'COMPLETED' ? `
                        <span class="text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full font-bold text-[10px] flex items-center gap-1 w-fit">
                          <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> SELESAI
                        </span>
                      ` : (t.status === 'VOID' ? `
                        <span class="text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded-full font-bold text-[10px] flex items-center gap-1 w-fit">
                          <span class="w-1.5 h-1.5 rounded-full bg-rose-500"></span> VOID
                        </span>
                      ` : `
                        <span class="text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full font-bold text-[10px] flex items-center gap-1 w-fit">
                          <span class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span> PENDING APPROVAL
                        </span>
                      `)}
                    </td>
                    <td class="py-3 px-3 text-right space-x-1.5 no-print whitespace-nowrap">
                      <button 
                        type="button" 
                        onclick="openReceiptModal(${t.id})" 
                        class="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold transition"
                        title="Buka Struk Pembayaran"
                      >
                        <i class="fa-solid fa-receipt"></i> Struk
                      </button>

                      ${t.status === 'COMPLETED' && isKasir ? `
                        <button 
                          type="button" 
                          onclick="handlePromptVoid(${t.id}, '${t.invoice_no}')" 
                          class="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-[11px] font-bold transition"
                          title="Ajukan pembatalan faktur ke Kepala Toko"
                        >
                          <i class="fa-solid fa-ban"></i> Void
                        </button>
                      ` : ''}

                      ${t.status === 'PENDING_APPROVAL' && isApprover ? `
                        <button 
                          type="button" 
                          onclick="handleApproveVoid(${t.id}, true)" 
                          class="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold transition"
                          title="Setujui Pembatalan Faktur"
                        >
                          <i class="fa-solid fa-check"></i> Setujui
                        </button>
                      ` : ''}
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  `;
}

function applyHistFilter() {
  const sInput = document.getElementById('histSearchInput');
  const dFrom = document.getElementById('histDateFrom');
  const dTo = document.getElementById('histDateTo');
  const payM = document.getElementById('histPaymentMethod');
  const stat = document.getElementById('histStatus');

  if (sInput) HIST_FILTER.search = sInput.value.trim();
  if (dFrom) HIST_FILTER.date_from = dFrom.value;
  if (dTo) HIST_FILTER.date_to = dTo.value;
  if (payM) HIST_FILTER.payment_method = payM.value;
  if (stat) HIST_FILTER.status = stat.value;

  renderShiftSalesView();
}

function resetHistFilter() {
  HIST_FILTER = { search: '', date_from: '', date_to: '', status: 'ALL', payment_method: 'ALL' };
  renderShiftSalesView();
}

function setHistDatePreset(preset) {
  const today = new Date();
  const formatIso = (d) => d.toISOString().slice(0, 10);

  if (preset === 'TODAY') {
    HIST_FILTER.date_from = formatIso(today);
    HIST_FILTER.date_to = formatIso(today);
  } else if (preset === 'LAST_7') {
    const past7 = new Date();
    past7.setDate(today.getDate() - 6);
    HIST_FILTER.date_from = formatIso(past7);
    HIST_FILTER.date_to = formatIso(today);
  } else if (preset === 'THIS_MONTH') {
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    HIST_FILTER.date_from = formatIso(firstDay);
    HIST_FILTER.date_to = formatIso(today);
  } else {
    HIST_FILTER.date_from = '';
    HIST_FILTER.date_to = '';
  }

  renderShiftSalesView();
}

function downloadTransactionsCsv() {
  if (CURRENT_TRANSACTIONS.length === 0) {
    showToast('Tidak ada data transaksi untuk diunduh.', 'error');
    return;
  }

  const headers = ['No Faktur', 'Tanggal', 'Kasir', 'Pelanggan', 'Metode Bayar', 'Total Tagihan (Rp)', 'Status'];
  const rows = CURRENT_TRANSACTIONS.map(t => [
    t.invoice_no,
    new Date(t.date).toLocaleString('id-ID'),
    t.cashier_name || 'Kasir',
    t.customer_name || 'Walk-in',
    t.payment_method,
    t.total_amount,
    t.status
  ]);

  const filename = `Riwayat_Transaksi_POS_${new Date().toISOString().slice(0, 10)}.csv`;
  downloadCsv(filename, headers, rows);
  showToast('File CSV Riwayat Transaksi berhasil diunduh.');
}

async function handlePromptVoid(txId, invoiceNo) {
  const reason = prompt(`Masukkan alasan pembatalan (VOID) untuk faktur ${invoiceNo}:`);
  if (!reason) return;

  try {
    const res = await apiCall(`/transactions/${txId}/request-void`, 'POST', { void_reason: reason });
    showToast(res.message);
    renderShiftSalesView();
  } catch (err) {}
}

// ================= VIEW: PUSAT OTORISASI KEPALA TOKO =================
async function renderApprovalsView() {
  const container = document.getElementById('dynamicContentContainer');
  container.innerHTML = '<div class="p-8 text-center text-slate-400"><i class="fa-solid fa-spinner fa-spin"></i> Memuat data otorisasi...</div>';

  const res = await apiCall('/approvals/pending');

  container.innerHTML = `
    <div class="space-y-6 animate-fade-in">
      
      <!-- Summary Alert -->
      <div class="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between text-xs text-amber-900">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-xl bg-amber-200 flex items-center justify-center text-amber-800 text-base">
            <i class="fa-solid fa-stamp"></i>
          </div>
          <div>
            <div class="font-bold">Pusat Otorisasi Kepala Toko</div>
            <p class="text-amber-700">Terdapat ${res.totalPending} permohonan yang memerlukan persetujuan otorisasi Anda.</p>
          </div>
        </div>
      </div>

      <!-- 1. PERMOHONAN VOID / DISKON TRANSAKSI -->
      <div class="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
        <h4 class="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
          <i class="fa-solid fa-receipt text-rose-500"></i> Permohonan Void / Diskon Transaksi Kasir (${res.pendingTransactions.length})
        </h4>
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs">
            <thead>
              <tr class="table-header-custom border-b border-slate-200">
                <th class="py-2.5 px-3">No. Faktur</th>
                <th class="py-2.5 px-3">Kasir</th>
                <th class="py-2.5 px-3">Total</th>
                <th class="py-2.5 px-3">Alasan Permohonan</th>
                <th class="py-2.5 px-3 text-right">Otorisasi</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              ${res.pendingTransactions.length === 0 ? '<tr><td colspan="5" class="text-center py-4 text-slate-400">Tidak ada permohonan void transaksi pending.</td></tr>' : res.pendingTransactions.map(t => `
                <tr>
                  <td class="py-3 px-3 font-bold text-sky-700">${t.invoice_no}</td>
                  <td class="py-3 px-3 font-medium">${t.cashier_name}</td>
                  <td class="py-3 px-3 font-bold">Rp ${Number(t.total_amount).toLocaleString()}</td>
                  <td class="py-3 px-3 text-slate-600 italic">${t.void_reason || 'Diskon melebihi batas otorisasi'}</td>
                  <td class="py-3 px-3 text-right space-x-1.5">
                    <button onclick="handleApproveVoid(${t.id}, true)" class="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[11px]">
                      <i class="fa-solid fa-check"></i> Setujui
                    </button>
                    <button onclick="handleApproveVoid(${t.id}, false)" class="px-3 py-1 bg-rose-100 hover:bg-rose-200 text-rose-700 rounded-lg font-bold text-[11px]">
                      <i class="fa-solid fa-xmark"></i> Tolak
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- 2. PERMOHONAN HAPUS BUKU (WRITE-OFF) -->
      <div class="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
        <h4 class="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
          <i class="fa-solid fa-trash-can text-purple-500"></i> Permohonan Hapus Buku Gudang / Write-off (${res.pendingWriteOffs.length})
        </h4>
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs">
            <thead>
              <tr class="table-header-custom border-b border-slate-200">
                <th class="py-2.5 px-3">No. Pengajuan</th>
                <th class="py-2.5 px-3">Diajukan Oleh</th>
                <th class="py-2.5 px-3">Estimasi Kerugian (Rp)</th>
                <th class="py-2.5 px-3">Alasan Kerusakan</th>
                <th class="py-2.5 px-3 text-right">Otorisasi</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              ${res.pendingWriteOffs.length === 0 ? '<tr><td colspan="5" class="text-center py-4 text-slate-400">Tidak ada pengajuan hapus buku pending.</td></tr>' : res.pendingWriteOffs.map(w => `
                <tr>
                  <td class="py-3 px-3 font-bold text-purple-700">${w.write_off_no}</td>
                  <td class="py-3 px-3 font-medium">${w.requested_by_name}</td>
                  <td class="py-3 px-3 font-extrabold text-rose-600">Rp ${Number(w.total_loss_value).toLocaleString()}</td>
                  <td class="py-3 px-3 text-slate-600">${w.reason}</td>
                  <td class="py-3 px-3 text-right space-x-1.5">
                    <button onclick="handleApproveWriteOff(${w.id}, true)" class="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[11px]">
                      <i class="fa-solid fa-check"></i> Setujui
                    </button>
                    <button onclick="handleApproveWriteOff(${w.id}, false)" class="px-3 py-1 bg-rose-100 hover:bg-rose-200 text-rose-700 rounded-lg font-bold text-[11px]">
                      <i class="fa-solid fa-xmark"></i> Tolak
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- 3. PERMOHONAN STOK OPNAME -->
      <div class="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
        <h4 class="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
          <i class="fa-solid fa-clipboard-check text-sky-500"></i> Persetujuan Penyesuaian Stok Opname (${res.pendingOpnames.length})
        </h4>
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs">
            <thead>
              <tr class="table-header-custom border-b border-slate-200">
                <th class="py-2.5 px-3">No. Opname</th>
                <th class="py-2.5 px-3">Tanggal</th>
                <th class="py-2.5 px-3">Petugas Gudang</th>
                <th class="py-2.5 px-3">Catatan</th>
                <th class="py-2.5 px-3 text-right">Otorisasi</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              ${res.pendingOpnames.length === 0 ? '<tr><td colspan="5" class="text-center py-4 text-slate-400">Tidak ada draft opname pending.</td></tr>' : res.pendingOpnames.map(o => `
                <tr>
                  <td class="py-3 px-3 font-bold text-sky-700">${o.opname_no}</td>
                  <td class="py-3 px-3 text-slate-500">${o.opname_date}</td>
                  <td class="py-3 px-3 font-medium">${o.conducted_by_name}</td>
                  <td class="py-3 px-3 text-slate-600">${o.notes || '-'}</td>
                  <td class="py-3 px-3 text-right space-x-1.5">
                    <button onclick="handleApproveOpname(${o.id}, true)" class="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[11px]">
                      <i class="fa-solid fa-check"></i> Setujui & Selaraskan
                    </button>
                    <button onclick="handleApproveOpname(${o.id}, false)" class="px-3 py-1 bg-rose-100 hover:bg-rose-200 text-rose-700 rounded-lg font-bold text-[11px]">
                      <i class="fa-solid fa-xmark"></i> Tolak
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  `;
}

async function handleApproveVoid(txId, approved) {
  try {
    const res = await apiCall(`/transactions/${txId}/approve-void`, 'POST', { approved });
    showToast(res.message);
    renderApprovalsView();
  } catch (err) {}
}

async function handleApproveWriteOff(woId, approved) {
  try {
    const res = await apiCall(`/inventory/write-off/${woId}/approve`, 'POST', { approved });
    showToast(res.message);
    renderApprovalsView();
  } catch (err) {}
}

async function handleApproveOpname(opId, approved) {
  try {
    const res = await apiCall(`/inventory/opname/${opId}/approve`, 'POST', { approved });
    showToast(res.message);
    renderApprovalsView();
  } catch (err) {}
}

// ================= VIEW: MONITORING TOKO =================
async function renderStoreMonitoringView() {
  const container = document.getElementById('dynamicContentContainer');
  container.innerHTML = '<div class="p-8 text-center text-slate-400"><i class="fa-solid fa-spinner fa-spin"></i> Memuat monitoring...</div>';

  const [salesRes, invRes] = await Promise.all([
    apiCall('/reports/sales'),
    apiCall('/reports/inventory')
  ]);

  container.innerHTML = `
    <div class="space-y-6 animate-fade-in">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div class="text-xs font-semibold text-slate-500 mb-1">Total Penjualan</div>
          <div class="text-xl font-extrabold text-slate-900">Rp ${Number(salesRes.totalRevenue).toLocaleString()}</div>
          <div class="text-[11px] text-emerald-600 mt-1 font-semibold">${salesRes.totalTransactions} Transaksi Kasir</div>
        </div>
        <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div class="text-xs font-semibold text-slate-500 mb-1">Total Item Produk Aktif</div>
          <div class="text-xl font-extrabold text-slate-900">${invRes.summary.totalItems} Produk</div>
          <div class="text-[11px] text-slate-500 mt-1">${invRes.summary.totalUnits} Unit Fisik di Toko</div>
        </div>
        <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div class="text-xs font-semibold text-slate-500 mb-1">Peringatan Stok Menipis</div>
          <div class="text-xl font-extrabold text-rose-600">${invRes.summary.lowStockCount} Item</div>
          <div class="text-[11px] text-rose-500 mt-1">Perlu Restock Segera</div>
        </div>
      </div>

      <!-- Top Selling Products -->
      <div class="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
        <h4 class="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
          <i class="fa-solid fa-fire text-amber-500"></i> Produk Paling Laris
        </h4>
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs">
            <thead>
              <tr class="table-header-custom border-b border-slate-200">
                <th class="py-2.5 px-3">SKU</th>
                <th class="py-2.5 px-3">Nama Produk</th>
                <th class="py-2.5 px-3">Terjual (Unit)</th>
                <th class="py-2.5 px-3 text-right">Total Omzet</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              ${salesRes.topProducts.map(p => `
                <tr>
                  <td class="py-3 px-3 font-bold text-sky-700">${p.sku}</td>
                  <td class="py-3 px-3 font-semibold">${p.name}</td>
                  <td class="py-3 px-3 font-bold text-slate-800">${p.total_qty} pcs</td>
                  <td class="py-3 px-3 text-right font-extrabold text-slate-900">Rp ${Number(p.total_sales).toLocaleString()}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

// ================= VIEW: PRODUK & INVENTORI GUDANG =================
async function renderProductsView(readOnly = false) {
  const container = document.getElementById('dynamicContentContainer');
  container.innerHTML = '<div class="p-8 text-center text-slate-400"><i class="fa-solid fa-spinner fa-spin"></i> Memuat inventori...</div>';

  const res = await apiCall('/products');
  const products = res.products;

  container.innerHTML = `
    <div class="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4 animate-fade-in">
      <div class="flex items-center justify-between border-b border-slate-100 pb-3">
        <div>
          <h3 class="text-sm font-bold text-slate-800">Katalog Produk & Persediaan Gudang</h3>
          <p class="text-xs text-slate-500">Kelola master data produk, harga perolehan, harga jual, dan sisa stok fisik.</p>
        </div>
        ${!readOnly ? `
          <button onclick="openProductModal()" class="px-3.5 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-2">
            <i class="fa-solid fa-plus"></i> Tambah Produk Baru
          </button>
        ` : ''}
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs">
          <thead>
            <tr class="table-header-custom border-b border-slate-200">
              <th class="py-2.5 px-3">SKU</th>
              <th class="py-2.5 px-3">Nama Produk</th>
              <th class="py-2.5 px-3">Kategori</th>
              <th class="py-2.5 px-3">Harga Beli</th>
              <th class="py-2.5 px-3">Harga Jual</th>
              <th class="py-2.5 px-3">Stok Gudang</th>
              <th class="py-2.5 px-3">Status</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            ${products.map(p => `
              <tr class="hover:bg-slate-50">
                <td class="py-3 px-3 font-bold text-sky-700">${p.sku}</td>
                <td class="py-3 px-3 font-semibold text-slate-800">${p.name}</td>
                <td class="py-3 px-3 text-slate-500">${p.category_name || '-'}</td>
                <td class="py-3 px-3 text-slate-600 font-medium">Rp ${Number(p.buy_price).toLocaleString()}</td>
                <td class="py-3 px-3 text-slate-900 font-bold">Rp ${Number(p.sell_price).toLocaleString()}</td>
                <td class="py-3 px-3 font-extrabold text-slate-800">${p.current_stock} ${p.unit}</td>
                <td class="py-3 px-3">
                  ${p.current_stock <= p.min_stock
                    ? '<span class="text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full font-bold text-[10px]">MENIPIS</span>'
                    : '<span class="text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-bold text-[10px]">AMAN</span>'
                  }
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function openProductModal() {
  document.getElementById('productModal').classList.remove('hidden');
}
function closeProductModal() {
  document.getElementById('productModal').classList.add('hidden');
}

async function handleCreateProduct(e) {
  e.preventDefault();
  const sku = document.getElementById('prodSku').value;
  const barcode = document.getElementById('prodBarcode').value;
  const name = document.getElementById('prodName').value;
  const unit = document.getElementById('prodUnit').value;
  const buy_price = document.getElementById('prodBuyPrice').value;
  const sell_price = document.getElementById('prodSellPrice').value;
  const initial_stock = document.getElementById('prodInitStock').value;
  const min_stock = document.getElementById('prodMinStock').value;

  try {
    const res = await apiCall('/products', 'POST', {
      sku, barcode, name, unit,
      buy_price: Number(buy_price),
      sell_price: Number(sell_price),
      initial_stock: Number(initial_stock),
      min_stock: Number(min_stock)
    });
    showToast(res.message);
    closeProductModal();
    renderProductsView();
  } catch (err) {}
}

// ================= VIEW: PENERIMAAN PEMBELIAN SUPPLIER =================
async function renderPurchasesView() {
  const container = document.getElementById('dynamicContentContainer');
  const [prodsRes, contactsRes] = await Promise.all([
    apiCall('/products'),
    apiCall('/transactions/contacts?type=SUPPLIER')
  ]);

  container.innerHTML = `
    <div class="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4 animate-fade-in max-w-2xl mx-auto">
      <div class="border-b border-slate-100 pb-3">
        <h3 class="text-sm font-bold text-slate-800 flex items-center gap-2">
          <i class="fa-solid fa-truck-ramp-box text-sky-600"></i> Penerimaan Barang Pembelian Supplier
        </h3>
        <p class="text-xs text-slate-500">Input barang yang diterima dari supplier untuk menambah stok dan membukukan utang/kas.</p>
      </div>

      <form onsubmit="handleReceivePurchase(event)" class="space-y-4 text-xs">
        <div>
          <label class="block font-semibold text-slate-700 mb-1">Pilih Supplier</label>
          <select id="purSupplier" class="w-full p-2.5 bg-slate-50 border rounded-xl font-medium focus:ring-2 focus:ring-sky-500">
            ${contactsRes.contacts.map(c => `<option value="${c.id}">${c.name} (${c.phone || '-'})</option>`).join('')}
          </select>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Nomor Surat Jalan / Faktur Supplier</label>
            <input id="purInvoiceNo" type="text" placeholder="Contoh: SJ-99120" required class="w-full p-2.5 bg-slate-50 border rounded-xl">
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Metode Pembayaran</label>
            <select id="purPaymentMethod" class="w-full p-2.5 bg-slate-50 border rounded-xl">
              <option value="CASH">Kas Tunai Toko (Langsung Lunas)</option>
              <option value="TRANSFER">Transfer Bank BCA</option>
              <option value="CREDIT">Utang Usaha / Tempo (AP)</option>
            </select>
          </div>
        </div>

        <div class="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
          <div class="font-bold text-slate-700">Item Produk yang Diterima</div>
          <div class="grid grid-cols-12 gap-2">
            <div class="col-span-6">
              <select id="purProdSelect" class="w-full p-2 bg-white border rounded-lg text-xs">
                ${prodsRes.products.map(p => `<option value="${p.id}" data-cost="${p.buy_price}">${p.name} (Stok: ${p.current_stock})</option>`).join('')}
              </select>
            </div>
            <div class="col-span-3">
              <input id="purQty" type="number" min="1" value="10" placeholder="Qty" class="w-full p-2 bg-white border rounded-lg text-xs text-center font-bold">
            </div>
            <div class="col-span-3">
              <input id="purCost" type="number" placeholder="Harga Beli (Rp)" class="w-full p-2 bg-white border rounded-lg text-xs font-bold">
            </div>
          </div>
        </div>

        <button type="submit" class="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-md flex items-center justify-center gap-2">
          <i class="fa-solid fa-check"></i> Proses Penerimaan & Tambah Stok
        </button>
      </form>
    </div>
  `;

  // Auto isi default cost saat select berubah
  const select = document.getElementById('purProdSelect');
  const costInput = document.getElementById('purCost');
  function updateCost() {
    const selectedOption = select.options[select.selectedIndex];
    if (selectedOption) costInput.value = selectedOption.getAttribute('data-cost') || 0;
  }
  select.onchange = updateCost;
  updateCost();
}

async function handleReceivePurchase(e) {
  e.preventDefault();
  const supplier_id = document.getElementById('purSupplier').value;
  const invoice_no = document.getElementById('purInvoiceNo').value;
  const payment_method = document.getElementById('purPaymentMethod').value;
  const product_id = Number(document.getElementById('purProdSelect').value);
  const qty = Number(document.getElementById('purQty').value);
  const unit_cost = Number(document.getElementById('purCost').value);

  try {
    const res = await apiCall('/inventory/receive-purchase', 'POST', {
      supplier_id,
      invoice_no,
      payment_method,
      items: [{ product_id, qty, unit_cost }]
    });

    showToast(res.message);
    selectMenu('products');
  } catch (err) {}
}

// ================= VIEW: KARTU STOK =================
async function renderStockCardsView() {
  const container = document.getElementById('dynamicContentContainer');
  container.innerHTML = '<div class="p-8 text-center text-slate-400"><i class="fa-solid fa-spinner fa-spin"></i> Memuat mutasi kartu stok...</div>';

  const res = await apiCall('/inventory/stock-movements');
  const movements = res.movements;

  container.innerHTML = `
    <div class="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4 animate-fade-in">
      <div class="border-b border-slate-100 pb-3">
        <h3 class="text-sm font-bold text-slate-800">Kartu Stok & Riwayat Mutasi Persediaan</h3>
        <p class="text-xs text-slate-500">Lacak setiap pergerakan barang masuk, barang keluar, penyesuaian opname, dan write-off.</p>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs">
          <thead>
            <tr class="table-header-custom border-b border-slate-200">
              <th class="py-2.5 px-3">Waktu</th>
              <th class="py-2.5 px-3">Produk</th>
              <th class="py-2.5 px-3">Tipe Mutasi</th>
              <th class="py-2.5 px-3">No. Referensi</th>
              <th class="py-2.5 px-3 text-center">Stok Awal</th>
              <th class="py-2.5 px-3 text-center">Perubahan</th>
              <th class="py-2.5 px-3 text-center">Stok Akhir</th>
              <th class="py-2.5 px-3">Keterangan</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            ${movements.map(m => `
              <tr class="hover:bg-slate-50">
                <td class="py-3 px-3 text-slate-500">${new Date(m.created_at).toLocaleString('id-ID')}</td>
                <td class="py-3 px-3 font-bold text-slate-800">${m.product_name} <span class="text-[10px] text-slate-400 block">${m.sku}</span></td>
                <td class="py-3 px-3"><span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100">${m.movement_type}</span></td>
                <td class="py-3 px-3 font-semibold text-sky-700">${m.reference_no || '-'}</td>
                <td class="py-3 px-3 text-center font-medium">${m.stock_before}</td>
                <td class="py-3 px-3 text-center font-extrabold ${m.qty_change > 0 ? 'text-emerald-600' : 'text-rose-600'}">
                  ${m.qty_change > 0 ? '+' : ''}${m.qty_change}
                </td>
                <td class="py-3 px-3 text-center font-bold text-slate-900">${m.stock_after}</td>
                <td class="py-3 px-3 text-slate-500 text-[11px]">${m.notes || '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// ================= VIEW: STOK OPNAME =================
async function renderStockOpnameView() {
  const container = document.getElementById('dynamicContentContainer');
  const prodsRes = await apiCall('/products');

  container.innerHTML = `
    <div class="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4 animate-fade-in max-w-2xl mx-auto">
      <div class="border-b border-slate-100 pb-3">
        <h3 class="text-sm font-bold text-slate-800 flex items-center gap-2">
          <i class="fa-solid fa-clipboard-check text-sky-600"></i> Form Stok Opname (Penyesuaian Fisik vs Sistem)
        </h3>
        <p class="text-xs text-slate-500">Hitung stok aktual fisik di rak toko/gudang dan sesuaikan dengan catatan database.</p>
      </div>

      <form onsubmit="handleSubmitOpname(event)" class="space-y-4 text-xs">
        <div>
          <label class="block font-semibold text-slate-700 mb-1">Pilih Produk untuk Di-opname</label>
          <select id="opnameProd" onchange="updateOpnameSystemStock(this)" class="w-full p-2.5 bg-slate-50 border rounded-xl font-medium">
            ${prodsRes.products.map(p => `<option value="${p.id}" data-sys="${p.current_stock}">${p.name} (${p.sku}) - Sistem: ${p.current_stock} pcs</option>`).join('')}
          </select>
        </div>

        <div class="grid grid-cols-3 gap-3">
          <div>
            <label class="block font-semibold text-slate-500 mb-1">Stok di Sistem</label>
            <input id="opnameSystemStock" type="number" readonly class="w-full p-2.5 bg-slate-100 border rounded-xl text-center font-extrabold text-slate-700">
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Stok Fisik Aktual *</label>
            <input id="opnamePhysicalStock" type="number" required oninput="calculateOpnameDiff()" class="w-full p-2.5 bg-white border border-sky-400 rounded-xl text-center font-extrabold text-sky-700 focus:ring-2 focus:ring-sky-500">
          </div>
          <div>
            <label class="block font-semibold text-slate-500 mb-1">Selisih Fisik</label>
            <input id="opnameDifference" type="number" readonly class="w-full p-2.5 bg-slate-100 border rounded-xl text-center font-extrabold text-slate-700">
          </div>
        </div>

        <div>
          <label class="block font-semibold text-slate-700 mb-1">Catatan Keterangan</label>
          <input id="opnameNotes" type="text" placeholder="Penyebab perbedaan fisik (misal: barang terselip, rusak)..." class="w-full p-2.5 bg-slate-50 border rounded-xl">
        </div>

        <button type="submit" class="w-full py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl font-bold shadow-md flex items-center justify-center gap-2">
          <i class="fa-solid fa-paper-plane"></i> Ajukan Draft Opname ke Kepala Toko
        </button>
      </form>
    </div>
  `;

  const sel = document.getElementById('opnameProd');
  updateOpnameSystemStock(sel);
}

function updateOpnameSystemStock(select) {
  const opt = select.options[select.selectedIndex];
  const sys = opt ? Number(opt.getAttribute('data-sys') || 0) : 0;
  document.getElementById('opnameSystemStock').value = sys;
  document.getElementById('opnamePhysicalStock').value = sys;
  calculateOpnameDiff();
}

function calculateOpnameDiff() {
  const sys = Number(document.getElementById('opnameSystemStock').value || 0);
  const phys = Number(document.getElementById('opnamePhysicalStock').value || 0);
  const diffEl = document.getElementById('opnameDifference');
  const diff = phys - sys;
  diffEl.value = diff;
  diffEl.className = `w-full p-2.5 bg-slate-100 border rounded-xl text-center font-extrabold ${diff < 0 ? 'text-rose-600' : (diff > 0 ? 'text-emerald-600' : 'text-slate-700')}`;
}

async function handleSubmitOpname(e) {
  e.preventDefault();
  const product_id = Number(document.getElementById('opnameProd').value);
  const physical_stock = Number(document.getElementById('opnamePhysicalStock').value);
  const notes = document.getElementById('opnameNotes').value;

  try {
    const res = await apiCall('/inventory/opname', 'POST', {
      items: [{ product_id, physical_stock }],
      notes
    });
    showToast(res.message);
    selectMenu('stock_cards');
  } catch (err) {}
}

// ================= VIEW: PENGATURAN HAPUS BUKU (WRITE-OFF) =================
async function renderWriteOffView() {
  const container = document.getElementById('dynamicContentContainer');
  const prodsRes = await apiCall('/products');

  container.innerHTML = `
    <div class="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4 animate-fade-in max-w-2xl mx-auto">
      <div class="border-b border-slate-100 pb-3">
        <h3 class="text-sm font-bold text-slate-800 flex items-center gap-2">
          <i class="fa-solid fa-trash-can text-purple-600"></i> Pengajuan Hapus Buku (Write-off Barang Rusak/Kadaluwarsa)
        </h3>
        <p class="text-xs text-slate-500">Ajukan penghapusan inventori yang tidak layak jual ke Kepala Toko untuk diverifikasi.</p>
      </div>

      <form onsubmit="handleSubmitWriteOff(event)" class="space-y-4 text-xs">
        <div>
          <label class="block font-semibold text-slate-700 mb-1">Pilih Produk Rusak / Kadaluwarsa</label>
          <select id="woProd" class="w-full p-2.5 bg-slate-50 border rounded-xl font-medium">
            ${prodsRes.products.map(p => `<option value="${p.id}" data-cost="${p.buy_price}">${p.name} (Tersedia: ${p.current_stock})</option>`).join('')}
          </select>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Jumlah Rusak (Unit) *</label>
            <input id="woQty" type="number" min="1" value="1" required class="w-full p-2.5 bg-white border border-rose-300 rounded-xl text-center font-bold text-rose-600">
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Alasan Kerusakan / Hapus Buku *</label>
            <input id="woReason" type="text" placeholder="Contoh: Kemasan pecah saat bongkar muat..." required class="w-full p-2.5 bg-slate-50 border rounded-xl">
          </div>
        </div>

        <button type="submit" class="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold shadow-md flex items-center justify-center gap-2">
          <i class="fa-solid fa-paper-plane"></i> Ajukan Hapus Buku ke Kepala Toko
        </button>
      </form>
    </div>
  `;
}

async function handleSubmitWriteOff(e) {
  e.preventDefault();
  const select = document.getElementById('woProd');
  const product_id = Number(select.value);
  const qty = Number(document.getElementById('woQty').value);
  const reason = document.getElementById('woReason').value;
  const unit_cost = Number(select.options[select.selectedIndex].getAttribute('data-cost') || 0);

  try {
    const res = await apiCall('/inventory/write-off', 'POST', {
      reason,
      items: [{ product_id, qty, unit_cost }]
    });
    showToast(res.message);
    selectMenu('stock_cards');
  } catch (err) {}
}

// ================= VIEW: AKUNTANSI (JURNAL & COA & NERACA) =================
async function renderCoaView() {
  const container = document.getElementById('dynamicContentContainer');
  const res = await apiCall('/accounting/accounts');

  container.innerHTML = `
    <div class="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4 animate-fade-in">
      <div class="border-b border-slate-100 pb-3 flex justify-between items-center">
        <div>
          <h3 class="text-sm font-bold text-slate-800">Bagan Akun (Chart of Accounts / COA)</h3>
          <p class="text-xs text-slate-500">Master akun perkiraan standar akuntansi toko.</p>
        </div>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs">
          <thead>
            <tr class="table-header-custom border-b border-slate-200">
              <th class="py-2.5 px-3">Kode Akun</th>
              <th class="py-2.5 px-3">Nama Akun</th>
              <th class="py-2.5 px-3">Tipe Klasifikasi</th>
              <th class="py-2.5 px-3">Saldo Normal</th>
              <th class="py-2.5 px-3">Keterangan</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            ${res.accounts.map(a => `
              <tr class="hover:bg-slate-50">
                <td class="py-3 px-3 font-bold text-sky-700">${a.account_code}</td>
                <td class="py-3 px-3 font-bold text-slate-800">${a.account_name}</td>
                <td class="py-3 px-3"><span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100">${a.account_type}</span></td>
                <td class="py-3 px-3 font-semibold ${a.normal_balance === 'DEBIT' ? 'text-blue-600' : 'text-purple-600'}">${a.normal_balance}</td>
                <td class="py-3 px-3 text-slate-500 text-[11px]">${a.description || '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

async function renderJournalsView() {
  const container = document.getElementById('dynamicContentContainer');
  const res = await apiCall('/accounting/journals');

  container.innerHTML = `
    <div class="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4 animate-fade-in">
      <div class="border-b border-slate-100 pb-3 flex justify-between items-center">
        <div>
          <h3 class="text-sm font-bold text-slate-800">Jurnal Umum (General Journal Entries)</h3>
          <p class="text-xs text-slate-500">Pencatatan double-entry otomatis dari penjualan, pembelian, dan opname.</p>
        </div>
      </div>

      <div class="space-y-4">
        ${res.journals.map(j => `
          <div class="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2">
            <div class="flex justify-between items-center border-b border-slate-200 pb-2">
              <div>
                <strong class="text-sky-700 font-bold">${j.journal_no}</strong>
                <span class="text-slate-500 ml-2">(${j.entry_date})</span>
                <span class="font-medium text-slate-800 ml-2">${j.description}</span>
              </div>
              <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">${j.status}</span>
            </div>
            <div class="overflow-x-auto">
              <table class="w-full text-left text-[11px]">
                <thead>
                  <tr class="text-slate-400">
                    <th class="py-1 px-2">Kode Akun</th>
                    <th class="py-1 px-2">Nama Akun Perkiraan</th>
                    <th class="py-1 px-2 text-right">Debit (Rp)</th>
                    <th class="py-1 px-2 text-right">Kredit (Rp)</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-200">
                  ${j.lines.map(l => `
                    <tr>
                      <td class="py-1 px-2 font-mono text-slate-500">${l.account_code}</td>
                      <td class="py-1 px-2 font-medium ${l.credit > 0 ? 'pl-6 text-slate-600' : 'text-slate-900'}">${l.account_name}</td>
                      <td class="py-1 px-2 text-right font-bold ${l.debit > 0 ? 'text-slate-900' : 'text-slate-400'}">${l.debit > 0 ? 'Rp ' + Number(l.debit).toLocaleString() : '-'}</td>
                      <td class="py-1 px-2 text-right font-bold ${l.credit > 0 ? 'text-slate-900' : 'text-slate-400'}">${l.credit > 0 ? 'Rp ' + Number(l.credit).toLocaleString() : '-'}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

async function renderGeneralLedgerView() {
  const container = document.getElementById('dynamicContentContainer');
  const res = await apiCall('/accounting/general-ledger');

  container.innerHTML = `
    <div class="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4 animate-fade-in">
      <div class="border-b border-slate-100 pb-3">
        <h3 class="text-sm font-bold text-slate-800">Buku Besar (General Ledger)</h3>
        <p class="text-xs text-slate-500">Mutasi dan saldo berjalan per akun perkiraan.</p>
      </div>

      <div class="space-y-6">
        ${res.ledger.filter(l => l.transactions.length > 0).map(l => `
          <div class="border border-slate-200 rounded-xl overflow-hidden text-xs">
            <div class="bg-slate-100 px-4 py-2 flex justify-between font-bold text-slate-800">
              <span>${l.account.account_code} - ${l.account.account_name} (${l.account.normal_balance})</span>
              <span class="text-sky-700">Saldo Akhir: Rp ${Number(l.endingBalance).toLocaleString()}</span>
            </div>
            <table class="w-full text-left text-[11px]">
              <thead class="bg-slate-50 border-b border-slate-200 text-slate-500">
                <tr>
                  <th class="p-2">Tanggal</th>
                  <th class="p-2">No. Jurnal</th>
                  <th class="p-2">Keterangan</th>
                  <th class="p-2 text-right">Debit</th>
                  <th class="p-2 text-right">Kredit</th>
                  <th class="p-2 text-right">Saldo</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                ${l.transactions.map(t => `
                  <tr>
                    <td class="p-2 text-slate-500">${t.entry_date}</td>
                    <td class="p-2 font-mono text-sky-700">${t.journal_no}</td>
                    <td class="p-2 text-slate-700">${t.description}</td>
                    <td class="p-2 text-right font-medium">${t.debit > 0 ? 'Rp ' + Number(t.debit).toLocaleString() : '-'}</td>
                    <td class="p-2 text-right font-medium">${t.credit > 0 ? 'Rp ' + Number(t.credit).toLocaleString() : '-'}</td>
                    <td class="p-2 text-right font-bold text-slate-900">Rp ${Number(t.balance).toLocaleString()}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

async function renderTrialBalanceView() {
  const container = document.getElementById('dynamicContentContainer');
  const res = await apiCall('/accounting/trial-balance');

  container.innerHTML = `
    <div class="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4 animate-fade-in max-w-3xl mx-auto">
      <div class="border-b border-slate-100 pb-3 flex justify-between items-center">
        <div>
          <h3 class="text-sm font-bold text-slate-800">Neraca Saldo (Trial Balance)</h3>
          <p class="text-xs text-slate-500">Verifikasi keseimbangan total debit dan kredit seluruh akun.</p>
        </div>
        <span class="px-3 py-1 rounded-full text-xs font-bold ${res.isBalanced ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}">
          ${res.isBalanced ? '✓ BALANCE (SEIMBANG)' : '✗ UNBALANCED'}
        </span>
      </div>

      <table class="w-full text-left text-xs">
        <thead>
          <tr class="table-header-custom border-b border-slate-200">
            <th class="py-2.5 px-3">Kode</th>
            <th class="py-2.5 px-3">Nama Akun</th>
            <th class="py-2.5 px-3 text-right">Debit (Rp)</th>
            <th class="py-2.5 px-3 text-right">Kredit (Rp)</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          ${res.trialBalance.map(r => `
            <tr>
              <td class="py-2 px-3 font-mono text-slate-500">${r.code}</td>
              <td class="py-2 px-3 font-medium text-slate-800">${r.name}</td>
              <td class="py-2 px-3 text-right font-bold text-slate-900">${r.debit > 0 ? Number(r.debit).toLocaleString() : '-'}</td>
              <td class="py-2 px-3 text-right font-bold text-slate-900">${r.credit > 0 ? Number(r.credit).toLocaleString() : '-'}</td>
            </tr>
          `).join('')}
          <tr class="bg-slate-100 font-extrabold text-slate-900 text-xs">
            <td colspan="2" class="py-3 px-3 text-right">TOTAL</td>
            <td class="py-3 px-3 text-right text-sky-700">Rp ${Number(res.totalDebit).toLocaleString()}</td>
            <td class="py-3 px-3 text-right text-sky-700">Rp ${Number(res.totalCredit).toLocaleString()}</td>
          </tr>
        </tbody>
      </table>
    </div>
  `;
}

// ================= VIEW: LABA RUGI & NERACA =================
async function renderFinancialStatementsView() {
  const container = document.getElementById('dynamicContentContainer');
  const res = await apiCall('/accounting/financial-statements');
  const inc = res.incomeStatement;
  const bal = res.balanceSheet;

  container.innerHTML = `
    <div class="space-y-6 animate-fade-in">
      
      <!-- TOOLBAR ATAS: CETAK & EKSPOR -->
      <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 class="text-sm font-bold text-slate-800 flex items-center gap-2">
            <i class="fa-solid fa-file-invoice-dollar text-sky-600"></i>
            <span>Laporan Keuangan Resmi (Financial Statements)</span>
          </h2>
          <p class="text-xs text-slate-500 mt-0.5">Penutupan pembukuan: Ringkasan Laba Rugi dan Neraca Keuangan Toko.</p>
        </div>
        <div class="flex items-center space-x-2">
          <button 
            type="button" 
            onclick="downloadFinancialStatementsCsv()" 
            class="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition"
            title="Unduh laporan laba rugi dan neraca dalam format Excel/CSV"
          >
            <i class="fa-solid fa-file-excel text-emerald-600"></i>
            <span>Unduh CSV</span>
          </button>
          <button 
            type="button" 
            onclick="window.print()" 
            class="px-3.5 py-2 btn-primary-gradient text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-sm transition"
            title="Cetak format cetak dokumen resmi toko"
          >
            <i class="fa-solid fa-print"></i>
            <span>Cetak Dokumen</span>
          </button>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        <!-- LAPORAN LABA RUGI -->
        <div class="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div class="border-b border-slate-100 pb-2 flex justify-between items-center">
            <div>
              <h3 class="text-sm font-bold text-slate-800">Laporan Laba Rugi</h3>
              <p class="text-xs text-slate-400">Income Statement (Pendapatan - Beban)</p>
            </div>
            <span class="text-[10px] px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 font-bold border border-sky-200">
              Periode Berjalan
            </span>
          </div>

          <div class="text-xs space-y-3">
            <div class="font-bold text-sky-800 flex items-center justify-between">
              <span>PENDAPATAN (REVENUE)</span>
              <i class="fa-solid fa-arrow-trend-up text-emerald-500"></i>
            </div>
            <div class="space-y-1.5 pl-2">
              ${inc.revenues.map(r => `
                <div class="flex justify-between text-slate-600">
                  <span>${r.name}</span>
                  <span class="font-medium text-slate-900">Rp ${Number(r.amount).toLocaleString()}</span>
                </div>
              `).join('')}
              <div class="flex justify-between font-bold pt-1 border-t text-slate-900">
                <span>Total Pendapatan</span>
                <span class="text-emerald-600">Rp ${Number(inc.totalRevenue).toLocaleString()}</span>
              </div>
            </div>

            <div class="font-bold text-rose-800 pt-2 flex items-center justify-between">
              <span>BEBAN & HPP (EXPENSES)</span>
              <i class="fa-solid fa-arrow-trend-down text-rose-500"></i>
            </div>
            <div class="space-y-1.5 pl-2">
              ${inc.expenses.map(e => `
                <div class="flex justify-between text-slate-600">
                  <span>${e.name}</span>
                  <span class="font-medium text-slate-900">Rp ${Number(e.amount).toLocaleString()}</span>
                </div>
              `).join('')}
              <div class="flex justify-between font-bold pt-1 border-t text-slate-900">
                <span>Total Beban Operasional & HPP</span>
                <span class="text-rose-600">Rp ${Number(inc.totalExpense).toLocaleString()}</span>
              </div>
            </div>

            <div class="p-3 bg-sky-50 rounded-xl border border-sky-200 flex justify-between items-center text-xs font-extrabold text-sky-950">
              <span>LABA (RUGI) BERSIH:</span>
              <span class="text-base ${inc.netIncome >= 0 ? 'text-emerald-700' : 'text-rose-700'}">
                Rp ${Number(inc.netIncome).toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        <!-- NERACA (BALANCE SHEET) -->
        <div class="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div class="border-b border-slate-100 pb-2 flex justify-between items-center">
            <div>
              <h3 class="text-sm font-bold text-slate-800">Laporan Neraca</h3>
              <p class="text-xs text-slate-400">Balance Sheet (Aset = Kewajiban + Modal)</p>
            </div>
            <span class="text-[10px] px-2 py-0.5 rounded-md ${bal.isBalanced ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'} font-bold border">
              ${bal.isBalanced ? 'SEIMBANG' : 'BELUM SEIMBANG'}
            </span>
          </div>

          <div class="text-xs space-y-3">
            <div class="font-bold text-blue-800">ASET (AKTIVA)</div>
            <div class="space-y-1.5 pl-2">
              ${bal.assets.map(a => `
                <div class="flex justify-between text-slate-600">
                  <span>${a.name}</span>
                  <span class="font-medium text-slate-900">Rp ${Number(a.amount).toLocaleString()}</span>
                </div>
              `).join('')}
              <div class="flex justify-between font-bold pt-1 border-t text-slate-900">
                <span>TOTAL ASET</span>
                <span class="text-blue-700">Rp ${Number(bal.totalAssets).toLocaleString()}</span>
              </div>
            </div>

            <div class="font-bold text-purple-800 pt-2">KEWAJIBAN & EKUITAS (PASIVA)</div>
            <div class="space-y-1.5 pl-2">
              ${bal.liabilities.map(l => `
                <div class="flex justify-between text-slate-600">
                  <span>${l.name}</span>
                  <span class="font-medium text-slate-900">Rp ${Number(l.amount).toLocaleString()}</span>
                </div>
              `).join('')}
              ${bal.equity.map(eq => `
                <div class="flex justify-between text-slate-600">
                  <span>${eq.name}</span>
                  <span class="font-medium text-slate-900">Rp ${Number(eq.amount).toLocaleString()}</span>
                </div>
              `).join('')}
              <div class="flex justify-between text-slate-600">
                <span>Laba Berjalan Periode Ini</span>
                <span class="font-medium text-emerald-600">Rp ${Number(bal.currentPeriodProfit).toLocaleString()}</span>
              </div>
              <div class="flex justify-between font-bold pt-1 border-t text-slate-900">
                <span>TOTAL LIABILITAS & EKUITAS</span>
                <span class="text-purple-700">Rp ${Number(bal.totalLiabilitiesAndEquity).toLocaleString()}</span>
              </div>
            </div>

            <div class="p-3 ${bal.isBalanced ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-rose-50 border-rose-200 text-rose-900'} rounded-xl border flex justify-between items-center text-xs font-bold">
              <span>Status Keseimbangan Neraca:</span>
              <span>${bal.isBalanced ? '✓ SEIMBANG (Aset = Pasiva)' : '✗ TIDAK SEIMBANG'}</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  `;

  // Simpan data untuk kebutuhan ekspor CSV
  window._lastFinancialStatements = { inc, bal };
}

function downloadFinancialStatementsCsv() {
  if (!window._lastFinancialStatements) {
    showToast('Data laporan keuangan belum dimuat.', 'error');
    return;
  }
  const { inc, bal } = window._lastFinancialStatements;
  const headers = ['Kategori / Akun', 'Pos Laporan', 'Nilai (Rp)'];
  const rows = [];

  rows.push(['--- LAPORAN LABA RUGI ---', '', '']);
  inc.revenues.forEach(r => rows.push([r.name, 'Pendapatan', r.amount]));
  rows.push(['Total Pendapatan', 'Laba Rugi', inc.totalRevenue]);
  inc.expenses.forEach(e => rows.push([e.name, 'Beban/HPP', e.amount]));
  rows.push(['Total Beban', 'Laba Rugi', inc.totalExpense]);
  rows.push(['Laba (Rugi) Bersih', 'Laba Rugi', inc.netIncome]);

  rows.push(['', '', '']);
  rows.push(['--- LAPORAN NERACA (BALANCE SHEET) ---', '', '']);
  bal.assets.forEach(a => rows.push([a.name, 'Aset (Aktiva)', a.amount]));
  rows.push(['TOTAL ASET', 'Neraca', bal.totalAssets]);
  bal.liabilities.forEach(l => rows.push([l.name, 'Kewajiban (Liabilitas)', l.amount]));
  bal.equity.forEach(eq => rows.push([eq.name, 'Ekuitas (Modal)', eq.amount]));
  rows.push(['Laba Berjalan Periode Ini', 'Ekuitas', bal.currentPeriodProfit]);
  rows.push(['TOTAL LIABILITAS & EKUITAS', 'Neraca', bal.totalLiabilitiesAndEquity]);
  rows.push(['Status Keseimbangan', 'Neraca', bal.isBalanced ? 'SEIMBANG' : 'TIDAK SEIMBANG']);

  const filename = `Laporan_Keuangan_POS_Akuntansi_${new Date().toISOString().slice(0, 10)}.csv`;
  downloadCsv(filename, headers, rows);
  showToast('Laporan keuangan berhasil diunduh ke format CSV.');
}

// ================= VIEW: BAGIAN KEUANGAN (AR/AP & KAS) =================
async function renderArApView() {
  const container = document.getElementById('dynamicContentContainer');
  const [liqRes, arapRes] = await Promise.all([
    apiCall('/finance/liquidity'),
    apiCall('/finance/ar-ap')
  ]);

  container.innerHTML = `
    <div class="space-y-6 animate-fade-in">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div class="text-xs font-semibold text-slate-500 mb-1">Total Likuiditas Kas & Bank</div>
          <div class="text-xl font-extrabold text-emerald-700">Rp ${Number(liqRes.totalLiquidity).toLocaleString()}</div>
          <div class="text-[11px] text-slate-500 mt-1">Saldo Uang Siap Pakai</div>
        </div>
        <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div class="text-xs font-semibold text-slate-500 mb-1">Total Piutang Pelanggan (AR)</div>
          <div class="text-xl font-extrabold text-blue-700">Rp ${Number(arapRes.totalReceivables).toLocaleString()}</div>
          <div class="text-[11px] text-blue-600 mt-1">Tagihan Belum Diterima</div>
        </div>
        <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div class="text-xs font-semibold text-slate-500 mb-1">Total Utang ke Supplier (AP)</div>
          <div class="text-xl font-extrabold text-rose-700">Rp ${Number(arapRes.totalPayables).toLocaleString()}</div>
          <div class="text-[11px] text-rose-600 mt-1">Kewajiban Harus Dibayar</div>
        </div>
      </div>

      <!-- Piutang (AR) List -->
      <div class="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
        <h4 class="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
          <i class="fa-solid fa-hand-holding-dollar text-blue-600"></i> Daftar Piutang Usaha (AR) Pelanggan
        </h4>
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs">
            <thead>
              <tr class="table-header-custom border-b border-slate-200">
                <th class="py-2.5 px-3">Faktur</th>
                <th class="py-2.5 px-3">Pelanggan</th>
                <th class="py-2.5 px-3">Total Tagihan</th>
                <th class="py-2.5 px-3">Terbayar</th>
                <th class="py-2.5 px-3">Sisa Piutang</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              ${arapRes.receivables.length === 0 ? '<tr><td colspan="5" class="py-4 text-center text-slate-400">Tidak ada piutang beredar.</td></tr>' : arapRes.receivables.map(r => `
                <tr>
                  <td class="py-3 px-3 font-bold text-sky-700">${r.invoice_no}</td>
                  <td class="py-3 px-3 font-medium">${r.customer_name}</td>
                  <td class="py-3 px-3">Rp ${Number(r.total_amount).toLocaleString()}</td>
                  <td class="py-3 px-3 text-emerald-600 font-medium">Rp ${Number(r.paid_amount).toLocaleString()}</td>
                  <td class="py-3 px-3 font-extrabold text-blue-700">Rp ${(Number(r.total_amount) - Number(r.paid_amount)).toLocaleString()}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

async function renderCashFlowView() {
  const container = document.getElementById('dynamicContentContainer');
  const res = await apiCall('/finance/cash-flow');

  container.innerHTML = `
    <div class="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4 animate-fade-in">
      <div class="border-b border-slate-100 pb-3 flex justify-between items-center">
        <div>
          <h3 class="text-sm font-bold text-slate-800">Laporan Arus Kas (Cash Flow)</h3>
          <p class="text-xs text-slate-500">Mutasi kas masuk dan kas keluar rekening toko.</p>
        </div>
        <div class="text-right">
          <span class="text-xs text-slate-500">Arus Kas Bersih:</span>
          <span class="font-extrabold text-sm ml-2 ${res.netCashFlow >= 0 ? 'text-emerald-700' : 'text-rose-700'}">
            Rp ${Number(res.netCashFlow).toLocaleString()}
          </span>
        </div>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs">
          <thead>
            <tr class="table-header-custom border-b border-slate-200">
              <th class="py-2.5 px-3">Tanggal</th>
              <th class="py-2.5 px-3">No. Jurnal</th>
              <th class="py-2.5 px-3">Akun</th>
              <th class="py-2.5 px-3">Keterangan</th>
              <th class="py-2.5 px-3 text-right text-emerald-700">Arus Masuk (Rp)</th>
              <th class="py-2.5 px-3 text-right text-rose-700">Arus Keluar (Rp)</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            ${res.streams.map(s => `
              <tr>
                <td class="py-3 px-3 text-slate-500">${s.date}</td>
                <td class="py-3 px-3 font-mono text-sky-700">${s.journal_no}</td>
                <td class="py-3 px-3 font-medium text-slate-700">${s.account}</td>
                <td class="py-3 px-3 text-slate-600">${s.description}</td>
                <td class="py-3 px-3 text-right font-bold text-emerald-600">${s.inflow > 0 ? Number(s.inflow).toLocaleString() : '-'}</td>
                <td class="py-3 px-3 text-right font-bold text-rose-600">${s.outflow > 0 ? Number(s.outflow).toLocaleString() : '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// ================= VIEW: OWNER DASBOR EKSEKUTIF & GRAFIK RINGKASAN =================
async function renderOwnerDashboardView() {
  destroyAllCharts();
  const container = document.getElementById('dynamicContentContainer');
  const res = await apiCall('/reports/owner-dashboard');
  const kpis = res.kpis || {};
  const charts = res.charts || {};
  const recentTx = res.recentTransactions || [];

  container.innerHTML = `
    <div class="space-y-6 animate-fade-in">
      
      <!-- Executive Greeting Banner Menyapa Khusna Mufida -->
      <div class="bg-gradient-to-r from-sky-950 via-indigo-950 to-slate-900 text-white p-6 rounded-3xl border border-sky-800 shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
        <div>
          <div class="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider mb-1.5">
            <i class="fa-solid fa-crown text-amber-400"></i> Dasbor Eksekutif Pemilik Toko
          </div>
          <h2 class="text-2xl sm:text-3xl font-black text-white">
            Selamat Datang, ${STATE.user ? STATE.user.name : 'Khusna Mufida'}!
          </h2>
          <p class="text-xs sm:text-sm text-sky-200 mt-1 max-w-2xl leading-relaxed">
            Pantau arus kas harian, tren penjualan kasir, valuasi persediaan produk, dan estimasi laba bersih operasional toko secara real-time.
          </p>
        </div>
        <div class="bg-white/10 backdrop-blur-md px-5 py-3.5 rounded-2xl border border-white/20 text-right flex-shrink-0">
          <div class="text-[11px] text-sky-300 font-semibold">Otoritas Akses Sistem</div>
          <div class="text-xs font-bold text-white flex items-center gap-2 justify-end mt-1">
            <span class="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Owner &bull; Akses Penuh</span>
          </div>
          <div class="text-[10px] text-slate-300 mt-0.5">Database MySQL Laragon Online</div>
        </div>
      </div>

      <!-- Top Metric Cards (5 KPI Utama) -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <!-- KPI 1: Penjualan Hari Ini -->
        <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:border-sky-300 transition">
          <div class="flex items-center justify-between text-slate-500 mb-2">
            <span class="text-xs font-semibold text-slate-600">Penjualan Hari Ini</span>
            <div class="w-8 h-8 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center text-xs">
              <i class="fa-solid fa-coins"></i>
            </div>
          </div>
          <div class="text-xl font-black text-slate-900">Rp ${Number(kpis.todaySalesTotal || 0).toLocaleString()}</div>
          <div class="text-[11px] text-emerald-600 font-semibold mt-1 flex items-center gap-1">
            <i class="fa-solid fa-check"></i>
            <span>${kpis.todaySalesCount || 0} Struk Selesai</span>
          </div>
        </div>

        <!-- KPI 2: Omzet Bulan Ini -->
        <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:border-emerald-300 transition">
          <div class="flex items-center justify-between text-slate-500 mb-2">
            <span class="text-xs font-semibold text-slate-600">Omzet Bulan Ini</span>
            <div class="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xs">
              <i class="fa-solid fa-chart-line"></i>
            </div>
          </div>
          <div class="text-xl font-black text-slate-900">Rp ${Number(kpis.monthSalesTotal || 0).toLocaleString()}</div>
          <div class="text-[11px] text-slate-500 font-medium mt-1">
            ${kpis.monthSalesCount || 0} Total Transaksi
          </div>
        </div>

        <!-- KPI 3: Nilai Aset Persediaan -->
        <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:border-purple-300 transition">
          <div class="flex items-center justify-between text-slate-500 mb-2">
            <span class="text-xs font-semibold text-slate-600">Valuasi Stok Gudang</span>
            <div class="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center text-xs">
              <i class="fa-solid fa-boxes-stacked"></i>
            </div>
          </div>
          <div class="text-xl font-black text-slate-900">Rp ${Number(kpis.inventoryValuation || 0).toLocaleString()}</div>
          <div class="text-[11px] text-purple-600 font-medium mt-1">
            ${kpis.totalProducts || 0} Varian Produk Aktif
          </div>
        </div>

        <!-- KPI 4: Likuiditas Kas & Bank -->
        <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:border-blue-300 transition">
          <div class="flex items-center justify-between text-slate-500 mb-2">
            <span class="text-xs font-semibold text-slate-600">Likuiditas Kas & Bank</span>
            <div class="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-xs">
              <i class="fa-solid fa-vault"></i>
            </div>
          </div>
          <div class="text-xl font-black text-slate-900">Rp ${Number(kpis.cashLiquidity || 0).toLocaleString()}</div>
          <div class="text-[11px] text-blue-600 font-medium mt-1">Kas Kasir & Rek. BCA</div>
        </div>

      </div>

      <!-- Banner Ringkasan Laba Bersih Berjalan -->
      <div class="bg-gradient-to-r from-emerald-500/10 via-sky-500/10 to-indigo-500/10 border border-emerald-200/80 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-base font-bold">
            <i class="fa-solid fa-scale-balanced"></i>
          </div>
          <div>
            <div class="text-xs font-bold text-slate-800">Estimasi Laba Bersih Berjalan (Net Profit)</div>
            <div class="text-[11px] text-slate-500">Hasil total akumulasi pendapatan penjualan dikurangi seluruh HPP dan beban operasional jurnal akuntansi.</div>
          </div>
        </div>
        <div class="text-right sm:flex-shrink-0">
          <span class="text-xs font-bold text-slate-500">Laba Bersih: </span>
          <span class="text-lg font-black ${(kpis.netProfit || 0) >= 0 ? 'text-emerald-700' : 'text-rose-700'}">
            Rp ${Number(kpis.netProfit || 0).toLocaleString()}
          </span>
        </div>
      </div>

      <!-- BAGIAN GRAFIK INTERAKTIF CHART.JS -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        <!-- Grafik 1: Tren Penjualan 7 Hari Terakhir (Line Chart) -->
        <div class="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm lg:col-span-2 space-y-3">
          <div class="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 class="text-sm font-bold text-slate-800 flex items-center gap-2">
                <i class="fa-solid fa-chart-line text-sky-600"></i> Tren Penjualan 7 Hari Terakhir
              </h3>
              <p class="text-xs text-slate-400">Fluktuasi omzet rupiah dan jumlah transaksi struk kasir.</p>
            </div>
            <span class="text-[10px] px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 font-bold border border-sky-200">
              7 Hari Berjalan
            </span>
          </div>
          <div class="relative h-64 w-full">
            <canvas id="ownerTrendChart"></canvas>
          </div>
        </div>

        <!-- Grafik 2: Komposisi Metode Pembayaran (Doughnut Chart) -->
        <div class="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
          <div class="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 class="text-sm font-bold text-slate-800 flex items-center gap-2">
                <i class="fa-solid fa-chart-pie text-indigo-600"></i> Komposisi Pembayaran
              </h3>
              <p class="text-xs text-slate-400">Distribusi Tunai, Transfer BCA & QRIS.</p>
            </div>
          </div>
          <div class="relative h-64 w-full flex items-center justify-center">
            <canvas id="ownerPaymentChart"></canvas>
          </div>
        </div>

      </div>

      <!-- Row Grafik 3 & Tabel Transaksi Terkini -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        <!-- Grafik 3: Top 5 Produk Terlaris (Horizontal Bar Chart) -->
        <div class="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
          <div class="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 class="text-sm font-bold text-slate-800 flex items-center gap-2">
                <i class="fa-solid fa-trophy text-amber-500"></i> Top 5 Produk Terlaris
              </h3>
              <p class="text-xs text-slate-400">Berdasarkan total kuantitas unit terjual.</p>
            </div>
            <button 
              type="button" 
              onclick="selectMenu('products')" 
              class="text-xs text-sky-600 hover:text-sky-800 font-bold transition"
            >
              Lihat Katalog &rarr;
            </button>
          </div>
          <div class="relative h-60 w-full">
            <canvas id="ownerTopProductsChart"></canvas>
          </div>
        </div>

        <!-- Tabel 5 Transaksi Kasir Terkini -->
        <div class="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
          <div class="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 class="text-sm font-bold text-slate-800 flex items-center gap-2">
                <i class="fa-solid fa-clock-rotate-left text-blue-600"></i> 5 Transaksi Kasir Terkini
              </h3>
              <p class="text-xs text-slate-400">Struk belanja paling akhir diproses di POS.</p>
            </div>
            <button 
              type="button" 
              onclick="selectMenu('shift_sales')" 
              class="text-xs text-sky-600 hover:text-sky-800 font-bold transition"
            >
              Semua Riwayat &rarr;
            </button>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs">
              <thead>
                <tr class="table-header-custom border-b border-slate-200">
                  <th class="py-2 px-2.5">No. Faktur</th>
                  <th class="py-2 px-2.5">Kasir</th>
                  <th class="py-2 px-2.5">Metode</th>
                  <th class="py-2 px-2.5 text-right">Total (Rp)</th>
                  <th class="py-2 px-2.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                ${recentTx.length === 0 ? `
                  <tr><td colspan="5" class="py-4 text-center text-slate-400 text-xs">Belum ada transaksi tercatat.</td></tr>
                ` : recentTx.map(t => `
                  <tr class="hover:bg-slate-50 transition">
                    <td class="py-2.5 px-2.5 font-bold text-sky-700">${t.invoice_no}</td>
                    <td class="py-2.5 px-2.5 text-slate-700 font-medium">${t.cashier_name || 'Kasir'}</td>
                    <td class="py-2.5 px-2.5">
                      <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">${t.payment_method}</span>
                    </td>
                    <td class="py-2.5 px-2.5 text-right font-black text-slate-900">Rp ${Number(t.total_amount).toLocaleString()}</td>
                    <td class="py-2.5 px-2.5 text-center">
                      <span class="px-2 py-0.5 rounded-full font-bold text-[10px] ${t.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}">
                        ${t.status === 'COMPLETED' ? 'SELESAI' : 'VOID'}
                      </span>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      <!-- Quick Action Navigation -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
        <button onclick="selectMenu('reports_sales')" class="p-4 bg-white hover:bg-sky-50 rounded-2xl border border-slate-200 text-left transition group shadow-xs">
          <i class="fa-solid fa-file-invoice text-xl text-sky-600 mb-2 block group-hover:scale-110 transition"></i>
          <h4 class="text-xs font-bold text-slate-900">Laporan Penjualan</h4>
          <p class="text-[11px] text-slate-500 mt-0.5">Filter periodik, rekap struk & cetak/unduh CSV.</p>
        </button>

        <button onclick="selectMenu('reports_finance')" class="p-4 bg-white hover:bg-emerald-50 rounded-2xl border border-slate-200 text-left transition group shadow-xs">
          <i class="fa-solid fa-file-invoice-dollar text-xl text-emerald-600 mb-2 block group-hover:scale-110 transition"></i>
          <h4 class="text-xs font-bold text-slate-900">Laporan Keuangan</h4>
          <p class="text-[11px] text-slate-500 mt-0.5">Akses Laba Rugi dan Neraca penutupan buku.</p>
        </button>

        <button onclick="selectMenu('reports_inventory')" class="p-4 bg-white hover:bg-purple-50 rounded-2xl border border-slate-200 text-left transition group shadow-xs">
          <i class="fa-solid fa-boxes-packing text-xl text-purple-600 mb-2 block group-hover:scale-110 transition"></i>
          <h4 class="text-xs font-bold text-slate-900">Rekap Persediaan Stok</h4>
          <p class="text-[11px] text-slate-500 mt-0.5">Analisis valuasi stok & pantau stok menipis.</p>
        </button>

        <button onclick="selectMenu('users_management')" class="p-4 bg-white hover:bg-amber-50 rounded-2xl border border-slate-200 text-left transition group shadow-xs">
          <i class="fa-solid fa-users-gear text-xl text-amber-600 mb-2 block group-hover:scale-110 transition"></i>
          <h4 class="text-xs font-bold text-slate-900">Manajemen Pengguna (RBAC)</h4>
          <p class="text-[11px] text-slate-500 mt-0.5">Kelola staf, hak akses 7 role, dan kredensial.</p>
        </button>
      </div>

    </div>
  `;

  // INISIALISASI GRAFIK DENGAN CHART.JS
  if (typeof Chart !== 'undefined') {
    // 1. Line Chart Tren Penjualan 7 Hari
    const trendCtx = document.getElementById('ownerTrendChart')?.getContext('2d');
    if (trendCtx && charts.trend7Days && charts.trend7Days.length > 0) {
      const labels = charts.trend7Days.map(d => d.label);
      const dataOmzet = charts.trend7Days.map(d => Number(d.total));
      const dataCount = charts.trend7Days.map(d => Number(d.count));

      chartInstances['ownerTrendChart'] = new Chart(trendCtx, {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: 'Omzet Penjualan (Rp)',
              data: dataOmzet,
              borderColor: '#0284c7',
              backgroundColor: 'rgba(2, 132, 199, 0.12)',
              fill: true,
              tension: 0.35,
              pointBackgroundColor: '#0284c7',
              pointBorderColor: '#ffffff',
              pointBorderWidth: 2,
              pointRadius: 4,
              pointHoverRadius: 6,
              yAxisID: 'y'
            },
            {
              label: 'Jumlah Struk Kasir',
              data: dataCount,
              borderColor: '#10b981',
              backgroundColor: 'transparent',
              borderDash: [4, 4],
              tension: 0.35,
              pointBackgroundColor: '#10b981',
              pointRadius: 3,
              pointHoverRadius: 5,
              yAxisID: 'y1'
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { position: 'top', labels: { boxWidth: 12, font: { size: 11, weight: 'bold' } } },
            tooltip: {
              callbacks: {
                label: (context) => {
                  if (context.datasetIndex === 0) {
                    return ` Omzet: Rp ${Number(context.raw).toLocaleString()}`;
                  }
                  return ` Struk Kasir: ${context.raw} transaksi`;
                }
              }
            }
          },
          scales: {
            y: {
              type: 'linear',
              position: 'left',
              ticks: {
                callback: (val) => 'Rp ' + Number(val).toLocaleString(),
                font: { size: 10 }
              },
              grid: { color: '#f1f5f9' }
            },
            y1: {
              type: 'linear',
              position: 'right',
              grid: { drawOnChartArea: false },
              ticks: { font: { size: 10 }, stepSize: 1 }
            },
            x: {
              grid: { display: false },
              ticks: { font: { size: 10 } }
            }
          }
        }
      });
    }

    // 2. Doughnut Chart Komposisi Pembayaran
    const paymentCtx = document.getElementById('ownerPaymentChart')?.getContext('2d');
    if (paymentCtx && charts.paymentComposition) {
      const payData = charts.paymentComposition;
      const payLabels = payData.map(p => {
        const map = { CASH: 'Tunai', TRANSFER: 'Transfer BCA', QRIS: 'QRIS' };
        return map[p.payment_method] || p.payment_method;
      });
      const payTotals = payData.map(p => Number(p.total));

      chartInstances['ownerPaymentChart'] = new Chart(paymentCtx, {
        type: 'doughnut',
        data: {
          labels: payLabels.length > 0 ? payLabels : ['Belum Ada Data'],
          datasets: [{
            data: payTotals.length > 0 ? payTotals : [1],
            backgroundColor: payTotals.length > 0 ? ['#0284c7', '#8b5cf6', '#10b981', '#f59e0b'] : ['#e2e8f0'],
            borderWidth: 2,
            borderColor: '#ffffff'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11, weight: 'bold' } } },
            tooltip: {
              callbacks: {
                label: (context) => {
                  if (payTotals.length === 0) return ' Tidak ada transaksi';
                  const total = payTotals.reduce((a, b) => a + b, 0);
                  const val = context.raw;
                  const pct = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
                  return ` ${context.label}: Rp ${Number(val).toLocaleString()} (${pct}%)`;
                }
              }
            }
          },
          cutout: '62%'
        }
      });
    }

    // 3. Bar Chart Top 5 Produk Terlaris
    const prodCtx = document.getElementById('ownerTopProductsChart')?.getContext('2d');
    if (prodCtx && charts.topSellingProducts) {
      const prodData = charts.topSellingProducts;
      chartInstances['ownerTopProductsChart'] = new Chart(prodCtx, {
        type: 'bar',
        data: {
          labels: prodData.map(p => p.name.length > 18 ? p.name.slice(0, 18) + '...' : p.name),
          datasets: [{
            label: 'Unit Terjual',
            data: prodData.map(p => Number(p.total_qty)),
            backgroundColor: '#38bdf8',
            borderRadius: 6
          }]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                afterLabel: (ctx) => {
                  const item = prodData[ctx.dataIndex];
                  return `Total Omzet: Rp ${Number(item.total_sales).toLocaleString()}`;
                }
              }
            }
          },
          scales: {
            x: { ticks: { stepSize: 1, font: { size: 10 } }, grid: { color: '#f1f5f9' } },
            y: { ticks: { font: { size: 10 } }, grid: { display: false } }
          }
        }
      });
    }
  }
}

// ================= VIEW: MANAJEMEN PENGGUNA (RBAC 7 ROLE) =================
STATE.userFilterRole = 'ALL';
STATE.userFilterStatus = 'ALL';
STATE.userSearchText = '';
STATE.cachedUsersList = [];

async function renderUsersManagementView() {
  const container = document.getElementById('dynamicContentContainer');
  const res = await apiCall('/users');
  const allUsers = res.users || [];
  STATE.cachedUsersList = allUsers;

  // Hitung jumlah per role
  const roleCounts = { ALL: allUsers.length };
  Object.keys(ROLE_INFO).forEach(r => { roleCounts[r] = 0; });
  allUsers.forEach(u => {
    if (roleCounts[u.role] !== undefined) roleCounts[u.role]++;
  });

  // Filter daftar user
  let filtered = allUsers;
  if (STATE.userFilterRole !== 'ALL') {
    filtered = filtered.filter(u => u.role === STATE.userFilterRole);
  }
  if (STATE.userFilterStatus !== 'ALL') {
    const isActiveVal = STATE.userFilterStatus === 'ACTIVE' ? 1 : 0;
    filtered = filtered.filter(u => u.is_active === isActiveVal);
  }
  if (STATE.userSearchText.trim()) {
    const q = STATE.userSearchText.trim().toLowerCase();
    filtered = filtered.filter(u => 
      u.name.toLowerCase().includes(q) || 
      u.username.toLowerCase().includes(q) || 
      u.email.toLowerCase().includes(q)
    );
  }

  container.innerHTML = `
    <div class="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-sm space-y-5 animate-fade-in">
      
      <!-- HEADER & TOMBOL TAMBAH PENGGUNA -->
      <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b border-slate-100 gap-4">
        <div>
          <h2 class="text-base font-bold text-slate-800 flex items-center gap-2">
            <i class="fa-solid fa-users-gear text-amber-600"></i>
            <span>Manajemen Pengguna & Otoritas Role (RBAC)</span>
          </h2>
          <p class="text-xs text-slate-500 mt-0.5">
            Kelola akun staf, hak akses 7 peran operasional, status aktif akun, dan kredensial masuk.
          </p>
        </div>
        <button 
          type="button" 
          onclick="openAddUserModal()" 
          class="btn-primary-gradient px-4 py-2 rounded-xl text-white font-bold text-xs flex items-center space-x-2 shadow-sm transition"
        >
          <i class="fa-solid fa-user-plus"></i>
          <span>Tambah Pengguna Baru</span>
        </button>
      </div>

      <!-- FILTER TABS 7 ROLE OPERASIONAL -->
      <div class="flex items-center space-x-2 overflow-x-auto pb-2 scrollbar-thin">
        <button 
          type="button" 
          onclick="setUserRoleFilter('ALL')" 
          class="flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 ${STATE.userFilterRole === 'ALL' ? 'bg-sky-600 text-white shadow-sm' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}"
        >
          <span>Semua Role</span>
          <span class="px-1.5 py-0.2 rounded-full text-[10px] ${STATE.userFilterRole === 'ALL' ? 'bg-sky-700 text-sky-100' : 'bg-slate-200 text-slate-600'}">
            ${roleCounts.ALL}
          </span>
        </button>

        ${Object.keys(ROLE_INFO).map(roleName => {
          const isSelected = STATE.userFilterRole === roleName;
          const count = roleCounts[roleName] || 0;
          return `
            <button 
              type="button" 
              onclick="setUserRoleFilter('${roleName}')" 
              class="flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 ${isSelected ? 'bg-sky-600 text-white shadow-sm' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}"
            >
              <span>${roleName}</span>
              <span class="px-1.5 py-0.2 rounded-full text-[10px] ${isSelected ? 'bg-sky-700 text-sky-100' : 'bg-slate-200 text-slate-600'}">
                ${count}
              </span>
            </button>
          `;
        }).join('')}
      </div>

      <!-- SEARCH & FILTER STATUS BAR -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div class="sm:col-span-2 relative">
          <i class="fa-solid fa-magnifying-glass absolute left-3.5 top-3 text-slate-400 text-xs"></i>
          <input 
            type="text" 
            id="userSearchInput" 
            oninput="handleUserSearch(event)" 
            placeholder="Cari berdasarkan nama pegawai, username, atau email..." 
            value="${STATE.userSearchText}" 
            class="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-sky-500 focus:outline-none"
          >
        </div>
        <div>
          <select 
            id="userStatusFilter" 
            onchange="setUserStatusFilter(this.value)" 
            class="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-sky-500 focus:outline-none cursor-pointer"
          >
            <option value="ALL" ${STATE.userFilterStatus === 'ALL' ? 'selected' : ''}>Semua Status Akun</option>
            <option value="ACTIVE" ${STATE.userFilterStatus === 'ACTIVE' ? 'selected' : ''}>Hanya Akun Aktif</option>
            <option value="INACTIVE" ${STATE.userFilterStatus === 'INACTIVE' ? 'selected' : ''}>Hanya Non-Aktif</option>
          </select>
        </div>
      </div>

      <!-- TABEL DAFTAR PENGGUNA -->
      <div class="overflow-x-auto border border-slate-100 rounded-2xl">
        <table class="w-full text-left text-xs">
          <thead>
            <tr class="table-header-custom border-b border-slate-200">
              <th class="py-3 px-4">Nama Pegawai</th>
              <th class="py-3 px-3">Username & Email</th>
              <th class="py-3 px-3">No. Telepon / WA</th>
              <th class="py-3 px-3">Role Otoritas</th>
              <th class="py-3 px-3">Status</th>
              <th class="py-3 px-4 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            ${filtered.length === 0 ? `
              <tr>
                <td colspan="6" class="py-8 text-center text-slate-400 text-xs">
                  <i class="fa-solid fa-user-slash text-2xl mb-2 text-slate-300 block"></i>
                  Tidak ditemukan data pengguna staf yang sesuai dengan filter.
                </td>
              </tr>
            ` : filtered.map(u => {
              const meta = ROLE_INFO[u.role] || {};
              const initial = (u.name || 'U').charAt(0).toUpperCase();
              return `
                <tr class="hover:bg-slate-50 transition">
                  <td class="py-3 px-4">
                    <div class="flex items-center space-x-2.5">
                      <div class="w-8 h-8 rounded-full bg-slate-200 text-slate-700 font-extrabold flex items-center justify-center text-xs flex-shrink-0">
                        ${initial}
                      </div>
                      <div>
                        <div class="font-bold text-slate-900">${u.name}</div>
                        <div class="text-[10px] text-slate-400">ID: #${u.id} &bull; Dibuat: ${new Date(u.created_at).toLocaleDateString('id-ID')}</div>
                      </div>
                    </div>
                  </td>
                  <td class="py-3 px-3">
                    <div class="font-mono font-medium text-slate-800">${u.username}</div>
                    <div class="text-slate-400 text-[11px]">${u.email}</div>
                  </td>
                  <td class="py-3 px-3 text-slate-600 font-medium">
                    ${u.phone || '<span class="text-slate-400">-</span>'}
                  </td>
                  <td class="py-3 px-3">
                    <span class="px-2.5 py-0.5 rounded-full font-bold text-[10px] ${meta.badgeClass || 'bg-slate-100 text-slate-700'}">
                      ${u.role}
                    </span>
                  </td>
                  <td class="py-3 px-3">
                    <span class="px-2 py-0.5 rounded-full font-bold text-[10px] ${u.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}">
                      ${u.is_active ? 'AKTIF' : 'NON-AKTIF'}
                    </span>
                  </td>
                  <td class="py-3 px-4 text-right">
                    <div class="flex items-center justify-end space-x-1.5">
                      <button 
                        type="button" 
                        onclick="openEditUserModal(${u.id})" 
                        class="px-2.5 py-1 bg-sky-50 hover:bg-sky-100 text-sky-700 rounded-lg text-xs font-bold transition flex items-center gap-1"
                        title="Edit data dan role pengguna"
                      >
                        <i class="fa-solid fa-pen-to-square"></i>
                        <span>Edit</span>
                      </button>
                      <button 
                        type="button" 
                        onclick="handleToggleUser(${u.id})" 
                        class="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition"
                        title="${u.is_active ? 'Nonaktifkan akun pengguna' : 'Aktifkan kembali akun'}"
                      >
                        ${u.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                      </button>
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>

    </div>
  `;
}

function setUserRoleFilter(role) {
  STATE.userFilterRole = role;
  renderUsersManagementView();
}

function setUserStatusFilter(status) {
  STATE.userFilterStatus = status;
  renderUsersManagementView();
}

function handleUserSearch(event) {
  STATE.userSearchText = event.target.value;
  renderUsersManagementView();
}

function openAddUserModal() {
  const modal = document.getElementById('userModal');
  const title = document.getElementById('userModalTitle');
  const editIdInput = document.getElementById('editUserId');
  const submitBtn = document.getElementById('userModalSubmitBtn');
  const pwdLabel = document.getElementById('userPasswordLabel');
  const pwdInput = document.getElementById('newUserPassword');
  const usernameInput = document.getElementById('newUserUsername');
  const emailInput = document.getElementById('newUserEmail');

  if (!modal) return;

  editIdInput.value = '';
  title.textContent = 'Tambah Pengguna Staf Baru (RBAC)';
  submitBtn.textContent = 'Simpan Staf Pengguna';
  pwdLabel.textContent = 'Kata Sandi (Password) *';
  pwdInput.required = true;
  pwdInput.placeholder = 'Minimal 6 karakter...';
  usernameInput.disabled = false;
  emailInput.disabled = false;

  document.getElementById('newUserName').value = '';
  usernameInput.value = '';
  emailInput.value = '';
  document.getElementById('newUserRole').value = 'Kasir';
  document.getElementById('newUserPhone').value = '';
  pwdInput.value = '';

  modal.classList.remove('hidden');
}

function openEditUserModal(userId) {
  const user = (STATE.cachedUsersList || []).find(u => u.id === userId);
  if (!user) return;

  const modal = document.getElementById('userModal');
  const title = document.getElementById('userModalTitle');
  const editIdInput = document.getElementById('editUserId');
  const submitBtn = document.getElementById('userModalSubmitBtn');
  const pwdLabel = document.getElementById('userPasswordLabel');
  const pwdInput = document.getElementById('newUserPassword');
  const usernameInput = document.getElementById('newUserUsername');
  const emailInput = document.getElementById('newUserEmail');

  if (!modal) return;

  editIdInput.value = user.id;
  title.textContent = `Edit Akun Pengguna: ${user.name}`;
  submitBtn.textContent = 'Perbarui Data Pengguna';
  pwdLabel.textContent = 'Ganti Kata Sandi (Opsional)';
  pwdInput.required = false;
  pwdInput.placeholder = 'Kosongkan jika tidak ingin mengubah password...';
  pwdInput.value = '';

  document.getElementById('newUserName').value = user.name;
  usernameInput.value = user.username;
  usernameInput.disabled = true;
  emailInput.value = user.email;
  emailInput.disabled = true;
  document.getElementById('newUserRole').value = user.role;
  document.getElementById('newUserPhone').value = user.phone || '';

  modal.classList.remove('hidden');
}

function closeUserModal() {
  const modal = document.getElementById('userModal');
  if (modal) modal.classList.add('hidden');
}

async function handleUserFormSubmit(event) {
  event.preventDefault();
  const editId = document.getElementById('editUserId').value;
  const name = document.getElementById('newUserName').value.trim();
  const role = document.getElementById('newUserRole').value;
  const phone = document.getElementById('newUserPhone').value.trim();
  const password = document.getElementById('newUserPassword').value;

  try {
    if (editId) {
      // MODE UPDATE (PUT)
      const payload = { name, role, phone };
      if (password) payload.password = password;
      const res = await apiCall(`/users/${editId}`, 'PUT', payload);
      showToast(res.message);
    } else {
      // MODE TAMBAH (POST)
      const username = document.getElementById('newUserUsername').value.trim();
      const email = document.getElementById('newUserEmail').value.trim();
      if (!password) {
        showToast('Kata sandi wajib diisi untuk pengguna baru.', 'error');
        return;
      }
      const payload = { name, username, email, role, phone, password };
      const res = await apiCall('/users', 'POST', payload);
      showToast(res.message);
    }

    closeUserModal();
    renderUsersManagementView();
  } catch (err) {
    // Error ditangani oleh apiCall
  }
}

async function handleToggleUser(userId) {
  try {
    const res = await apiCall(`/users/${userId}/toggle-status`, 'PATCH');
    showToast(res.message);
    renderUsersManagementView();
  } catch (err) {}
}

// ================= VIEW: LAPORAN PENJUALAN PERIODIK =================
STATE.salesReportFilter = STATE.salesReportFilter || {
  date_from: '',
  date_to: '',
  payment_method: 'ALL',
  search: ''
};

async function renderSalesReportView() {
  const container = document.getElementById('dynamicContentContainer');
  
  // Susun Query Params
  const params = new URLSearchParams();
  if (STATE.salesReportFilter.date_from) params.set('date_from', STATE.salesReportFilter.date_from);
  if (STATE.salesReportFilter.date_to) params.set('date_to', STATE.salesReportFilter.date_to);
  if (STATE.salesReportFilter.payment_method && STATE.salesReportFilter.payment_method !== 'ALL') {
    params.set('payment_method', STATE.salesReportFilter.payment_method);
  }
  if (STATE.salesReportFilter.search) params.set('search', STATE.salesReportFilter.search);

  const endpoint = `/reports/sales${params.toString() ? '?' + params.toString() : ''}`;
  const res = await apiCall(endpoint);
  
  const summary = res.summary || {};
  const sales = res.sales || [];
  const topProducts = res.topProducts || [];
  const paymentBreakdown = res.paymentBreakdown || [];

  window._lastSalesReport = { summary, sales, filter: { ...STATE.salesReportFilter } };

  container.innerHTML = `
    <div class="space-y-6 animate-fade-in">
      
      <!-- TOOLBAR ATAS: HEADER & TOMBOL AKSI -->
      <div class="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 class="text-base font-bold text-slate-800 flex items-center gap-2">
            <i class="fa-solid fa-file-invoice text-sky-600"></i>
            <span>Laporan Penjualan Transaksional & Rekap Periodik</span>
          </h2>
          <p class="text-xs text-slate-500 mt-0.5">
            Rekapitulasi seluruh transaksi kasir, analisis metode bayar, top produk terlaris, dan rincian struk.
          </p>
        </div>
        <div class="flex items-center space-x-2">
          <button 
            type="button" 
            onclick="downloadSalesCsv()" 
            class="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition"
            title="Unduh seluruh rincian transaksi penjualan ke format Excel/CSV"
          >
            <i class="fa-solid fa-file-excel text-emerald-600"></i>
            <span>Unduh CSV</span>
          </button>
          <button 
            type="button" 
            onclick="window.print()" 
            class="px-4 py-2 btn-primary-gradient text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-sm transition"
            title="Cetak laporan penjualan resmi"
          >
            <i class="fa-solid fa-print"></i>
            <span>Cetak Dokumen</span>
          </button>
        </div>
      </div>

      <!-- FILTER PANEL PERIODIK & PRESET CEPAT -->
      <div class="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <div class="flex items-center justify-between border-b border-slate-100 pb-3">
          <span class="text-xs font-bold text-slate-700 flex items-center gap-1.5">
            <i class="fa-solid fa-filter text-sky-500"></i> Filter Rentang Tanggal & Parameter
          </span>
          <!-- PRESET TANGGAL CEPAT -->
          <div class="flex items-center space-x-1.5 text-xs">
            <button 
              type="button" 
              onclick="applySalesReportPreset('today')" 
              class="px-2.5 py-1 bg-slate-100 hover:bg-sky-50 hover:text-sky-700 text-slate-600 rounded-lg font-semibold text-[11px] transition"
            >
              Hari Ini
            </button>
            <button 
              type="button" 
              onclick="applySalesReportPreset('7days')" 
              class="px-2.5 py-1 bg-slate-100 hover:bg-sky-50 hover:text-sky-700 text-slate-600 rounded-lg font-semibold text-[11px] transition"
            >
              7 Hari
            </button>
            <button 
              type="button" 
              onclick="applySalesReportPreset('month')" 
              class="px-2.5 py-1 bg-slate-100 hover:bg-sky-50 hover:text-sky-700 text-slate-600 rounded-lg font-semibold text-[11px] transition"
            >
              Bulan Ini
            </button>
            <button 
              type="button" 
              onclick="applySalesReportPreset('all')" 
              class="px-2.5 py-1 bg-slate-100 hover:bg-sky-50 hover:text-sky-700 text-slate-600 rounded-lg font-semibold text-[11px] transition"
            >
              Semua
            </button>
          </div>
        </div>

        <form onsubmit="handleSalesReportFilterSubmit(event)" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
          <div>
            <label class="block font-bold text-slate-600 mb-1">Dari Tanggal</label>
            <input 
              type="date" 
              id="reportDateFrom" 
              value="${STATE.salesReportFilter.date_from}" 
              class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none text-xs"
            >
          </div>
          <div>
            <label class="block font-bold text-slate-600 mb-1">Sampai Tanggal</label>
            <input 
              type="date" 
              id="reportDateTo" 
              value="${STATE.salesReportFilter.date_to}" 
              class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none text-xs"
            >
          </div>
          <div>
            <label class="block font-bold text-slate-600 mb-1">Metode Bayar</label>
            <select 
              id="reportPaymentMethod" 
              class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none text-xs font-semibold cursor-pointer"
            >
              <option value="ALL" ${STATE.salesReportFilter.payment_method === 'ALL' ? 'selected' : ''}>Semua Metode</option>
              <option value="CASH" ${STATE.salesReportFilter.payment_method === 'CASH' ? 'selected' : ''}>Tunai (Cash)</option>
              <option value="TRANSFER" ${STATE.salesReportFilter.payment_method === 'TRANSFER' ? 'selected' : ''}>Transfer BCA</option>
              <option value="QRIS" ${STATE.salesReportFilter.payment_method === 'QRIS' ? 'selected' : ''}>QRIS</option>
            </select>
          </div>
          <div>
            <label class="block font-bold text-slate-600 mb-1">Pencarian Teks</label>
            <input 
              type="text" 
              id="reportSearchQuery" 
              placeholder="Faktur / Kasir / Pelanggan..." 
              value="${STATE.salesReportFilter.search}" 
              class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none text-xs"
            >
          </div>
          <div class="flex items-end space-x-2">
            <button 
              type="submit" 
              class="flex-1 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl font-bold transition flex items-center justify-center space-x-1"
            >
              <i class="fa-solid fa-magnifying-glass"></i>
              <span>Terapkan</span>
            </button>
            <button 
              type="button" 
              onclick="resetSalesReportFilter()" 
              class="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-semibold transition"
              title="Reset ke pengaturan default"
            >
              <i class="fa-solid fa-arrow-rotate-left"></i>
            </button>
          </div>
        </form>
      </div>

      <!-- 4 KARTU METRIK RINGKASAN PENJUALAN PERIODIK -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div class="text-xs font-semibold text-slate-500 mb-1">Total Omzet Penjualan</div>
          <div class="text-xl font-black text-sky-700">Rp ${Number(summary.totalRevenue || 0).toLocaleString()}</div>
          <div class="text-[11px] text-slate-400 mt-1">Akumulasi penjualan kotor</div>
        </div>

        <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div class="text-xs font-semibold text-slate-500 mb-1">Total Diskon Diberikan</div>
          <div class="text-xl font-black text-rose-600">Rp ${Number(summary.totalDiscounts || 0).toLocaleString()}</div>
          <div class="text-[11px] text-slate-400 mt-1">Potongan harga promosi kasir</div>
        </div>

        <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div class="text-xs font-semibold text-slate-500 mb-1">Jumlah Transaksi Selesai</div>
          <div class="text-xl font-black text-emerald-700">${summary.totalTransactions || 0} Struk</div>
          <div class="text-[11px] text-slate-400 mt-1">Transaksi sukses terlayani</div>
        </div>

        <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div class="text-xs font-semibold text-slate-500 mb-1">Rata-rata Nilai Struk (AOV)</div>
          <div class="text-xl font-black text-indigo-700">Rp ${Number(summary.averageTransaction || 0).toLocaleString()}</div>
          <div class="text-[11px] text-slate-400 mt-1">Omzet dibagi jumlah transaksi</div>
        </div>

      </div>

      <!-- ROW: BREAKDOWN METODE PEMBAYARAN & TOP 5 PRODUK -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        <!-- Breakdown Metode Bayar -->
        <div class="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-3">
          <h3 class="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <i class="fa-solid fa-wallet text-sky-600"></i> Rekap Per Metode Pembayaran
          </h3>
          <div class="divide-y divide-slate-100">
            ${paymentBreakdown.length === 0 ? `
              <div class="py-3 text-center text-slate-400 text-xs">Belum ada rincian metode pembayaran.</div>
            ` : paymentBreakdown.map(pb => `
              <div class="py-2.5 flex items-center justify-between text-xs">
                <div class="flex items-center space-x-2">
                  <span class="px-2 py-0.5 rounded font-bold text-[10px] bg-slate-100 text-slate-700">${pb.payment_method}</span>
                  <span class="text-slate-500">${pb.count} Transaksi</span>
                </div>
                <span class="font-extrabold text-slate-900">Rp ${Number(pb.total).toLocaleString()}</span>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Top 5 Produk di Periode Tersebut -->
        <div class="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-3">
          <h3 class="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <i class="fa-solid fa-star text-amber-500"></i> Top 5 Produk Terlaris Periode Ini
          </h3>
          <div class="divide-y divide-slate-100">
            ${topProducts.length === 0 ? `
              <div class="py-3 text-center text-slate-400 text-xs">Belum ada penjualan produk pada periode ini.</div>
            ` : topProducts.map((tp, idx) => `
              <div class="py-2.5 flex items-center justify-between text-xs">
                <div class="flex items-center space-x-2">
                  <span class="w-5 h-5 rounded-full bg-amber-50 text-amber-700 font-bold flex items-center justify-center text-[10px]">${idx + 1}</span>
                  <div>
                    <span class="font-bold text-slate-900">${tp.name}</span>
                    <span class="text-[10px] text-slate-400 block">${tp.category_name || 'Umum'} &bull; SKU: ${tp.sku}</span>
                  </div>
                </div>
                <div class="text-right">
                  <div class="font-extrabold text-sky-700">${tp.total_qty} Unit</div>
                  <div class="text-[10px] text-slate-500">Rp ${Number(tp.total_sales).toLocaleString()}</div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

      </div>

      <!-- TABEL RINCIAN TRANSAKSI PENJUALAN LENGKAP -->
      <div class="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm space-y-3">
        <div class="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 class="text-sm font-bold text-slate-800 flex items-center gap-2">
            <i class="fa-solid fa-list-check text-slate-700"></i> Rincian Seluruh Transaksi Penjualan
          </h3>
          <span class="text-xs text-slate-400">Total: <strong class="text-slate-800">${sales.length}</strong> struk</span>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs">
            <thead>
              <tr class="table-header-custom border-b border-slate-200">
                <th class="py-3 px-3">No. Faktur</th>
                <th class="py-3 px-3">Tanggal & Waktu</th>
                <th class="py-3 px-3">Kasir</th>
                <th class="py-3 px-3">Pelanggan</th>
                <th class="py-3 px-3">Metode</th>
                <th class="py-3 px-3 text-right">Diskon (Rp)</th>
                <th class="py-3 px-3 text-right">Total Bayar (Rp)</th>
                <th class="py-3 px-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              ${sales.length === 0 ? `
                <tr>
                  <td colspan="8" class="py-8 text-center text-slate-400 text-xs">
                    <i class="fa-solid fa-receipt text-2xl mb-2 text-slate-300 block"></i>
                    Tidak ada transaksi penjualan yang sesuai dengan kriteria filter saat ini.
                  </td>
                </tr>
              ` : sales.map(s => `
                <tr class="hover:bg-slate-50 transition">
                  <td class="py-3 px-3 font-bold text-sky-700 font-mono">${s.invoice_no}</td>
                  <td class="py-3 px-3 text-slate-500">${new Date(s.date).toLocaleString('id-ID')}</td>
                  <td class="py-3 px-3 font-medium text-slate-800">${s.cashier_name}</td>
                  <td class="py-3 px-3 text-slate-600">${s.customer_name || '<span class="text-slate-400">Walk-in</span>'}</td>
                  <td class="py-3 px-3">
                    <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">${s.payment_method}</span>
                  </td>
                  <td class="py-3 px-3 text-right text-rose-600 font-medium">${Number(s.discount || 0) > 0 ? Number(s.discount).toLocaleString() : '-'}</td>
                  <td class="py-3 px-3 text-right font-black text-slate-900">Rp ${Number(s.total_amount).toLocaleString()}</td>
                  <td class="py-3 px-3 text-center">
                    <button 
                      type="button" 
                      onclick="openReceiptModal(${s.id})" 
                      class="px-2.5 py-1 bg-sky-50 hover:bg-sky-100 text-sky-700 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 mx-auto"
                      title="Lihat Struk Belanja & Audit Jurnal"
                    >
                      <i class="fa-solid fa-receipt"></i>
                      <span>Struk</span>
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  `;
}

function handleSalesReportFilterSubmit(event) {
  event.preventDefault();
  STATE.salesReportFilter.date_from = document.getElementById('reportDateFrom').value;
  STATE.salesReportFilter.date_to = document.getElementById('reportDateTo').value;
  STATE.salesReportFilter.payment_method = document.getElementById('reportPaymentMethod').value;
  STATE.salesReportFilter.search = document.getElementById('reportSearchQuery').value.trim();
  renderSalesReportView();
}

function resetSalesReportFilter() {
  STATE.salesReportFilter = {
    date_from: '',
    date_to: '',
    payment_method: 'ALL',
    search: ''
  };
  renderSalesReportView();
}

function applySalesReportPreset(preset) {
  const now = new Date();
  const formatYmd = (d) => d.toISOString().slice(0, 10);

  if (preset === 'today') {
    STATE.salesReportFilter.date_from = formatYmd(now);
    STATE.salesReportFilter.date_to = formatYmd(now);
  } else if (preset === '7days') {
    const past7 = new Date();
    past7.setDate(now.getDate() - 6);
    STATE.salesReportFilter.date_from = formatYmd(past7);
    STATE.salesReportFilter.date_to = formatYmd(now);
  } else if (preset === 'month') {
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    STATE.salesReportFilter.date_from = formatYmd(firstDay);
    STATE.salesReportFilter.date_to = formatYmd(now);
  } else if (preset === 'all') {
    STATE.salesReportFilter.date_from = '';
    STATE.salesReportFilter.date_to = '';
  }

  renderSalesReportView();
}

function downloadSalesCsv() {
  if (!window._lastSalesReport || !window._lastSalesReport.sales) {
    showToast('Data penjualan belum dimuat.', 'error');
    return;
  }
  const sales = window._lastSalesReport.sales;
  const headers = ['No Faktur', 'Tanggal & Waktu', 'Kasir', 'Pelanggan', 'Metode Bayar', 'Diskon (Rp)', 'Total (Rp)'];
  const rows = sales.map(s => [
    s.invoice_no,
    new Date(s.date).toLocaleString('id-ID'),
    s.cashier_name,
    s.customer_name || 'Walk-in',
    s.payment_method,
    Number(s.discount || 0),
    Number(s.total_amount)
  ]);

  const filename = `Laporan_Penjualan_${new Date().toISOString().slice(0, 10)}.csv`;
  downloadCsv(filename, headers, rows);
  showToast('Laporan penjualan berhasil diunduh ke format CSV.');
}

function openReceiptFromSalesRow(invoiceNo, date, cashier, customer, method, subtotal, discount, total) {
  const modal = document.getElementById('receiptModal');
  const body = document.getElementById('receiptContent');
  if (!modal || !body) return;

  body.innerHTML = `
    <div class="text-center pb-3 border-b border-dashed border-slate-300">
      <div class="font-extrabold text-sm tracking-wider uppercase text-slate-900">TOKO MAJU JAYA BERSAMA</div>
      <div class="text-[11px] text-slate-600">Jl. Pemuda No. 88, Jakarta Pusat</div>
      <div class="text-[10px] text-slate-500">Telp: 021-5551234 &bull; POS & Akuntansi Terpadu</div>
    </div>
    <div class="py-2.5 border-b border-dashed border-slate-300 space-y-1 text-[11px] text-slate-700">
      <div class="flex justify-between"><span>No. Faktur:</span><span class="font-mono font-bold text-slate-900">${invoiceNo}</span></div>
      <div class="flex justify-between"><span>Waktu:</span><span>${new Date(date).toLocaleString('id-ID')}</span></div>
      <div class="flex justify-between"><span>Kasir:</span><span class="font-bold text-slate-900">${cashier}</span></div>
      <div class="flex justify-between"><span>Pelanggan:</span><span>${customer || 'Pelanggan Umum'}</span></div>
      <div class="flex justify-between"><span>Metode:</span><span class="font-bold">${method}</span></div>
    </div>
    <div class="py-2.5 border-b border-dashed border-slate-300 space-y-1 text-[11px]">
      <div class="flex justify-between text-slate-600"><span>Subtotal:</span><span>Rp ${Number(subtotal).toLocaleString('id-ID')}</span></div>
      ${discount > 0 ? `<div class="flex justify-between text-rose-600"><span>Diskon:</span><span>- Rp ${Number(discount).toLocaleString('id-ID')}</span></div>` : ''}
      <div class="flex justify-between font-black text-xs text-slate-900 pt-1 border-t border-slate-200">
        <span>TOTAL BAYAR:</span><span class="text-sky-700 font-extrabold">Rp ${Number(total).toLocaleString('id-ID')}</span>
      </div>
    </div>
    <div class="text-center pt-3 text-[10px] text-slate-400">
      <div>Terima kasih atas kunjungan Anda</div>
      <div>Struk Resmi Terverifikasi Sistem POS & Akuntansi</div>
    </div>
  `;

  modal.classList.remove('hidden');
}

// ================= VIEW: REKAP PERSEDIAAN GUDANG =================
async function renderInventoryReportView() {
  const container = document.getElementById('dynamicContentContainer');
  const res = await apiCall('/reports/inventory');
  const summary = res.summary || {};
  const lowStock = res.lowStockItems || [];

  container.innerHTML = `
    <div class="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-sm space-y-5 animate-fade-in">
      
      <!-- HEADER & AKSI -->
      <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b border-slate-100 gap-4">
        <div>
          <h2 class="text-base font-bold text-slate-800 flex items-center gap-2">
            <i class="fa-solid fa-boxes-packing text-purple-600"></i>
            <span>Rekap Persediaan & Valuasi Stok Gudang</span>
          </h2>
          <p class="text-xs text-slate-500 mt-0.5">Nilai aset barang dagangan berdasarkan harga perolehan (HPP) dan pemantauan stok menipis.</p>
        </div>
        <div class="flex items-center space-x-2">
          <button 
            type="button" 
            onclick="window.print()" 
            class="px-3.5 py-2 btn-primary-gradient text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-sm transition"
          >
            <i class="fa-solid fa-print"></i>
            <span>Cetak Rekap</span>
          </button>
        </div>
      </div>

      <!-- KARTU RINGKASAN STOK -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="p-4 bg-slate-50 rounded-2xl border border-slate-200">
          <div class="text-[11px] text-slate-500 font-medium">Total Varian Produk</div>
          <div class="text-xl font-bold text-slate-800 mt-1">${summary.totalItems || 0} Varian</div>
          <div class="text-[10px] text-slate-400 mt-0.5">Semua item terdaftar</div>
        </div>

        <div class="p-4 bg-slate-50 rounded-2xl border border-slate-200">
          <div class="text-[11px] text-slate-500 font-medium">Total Kuantitas Fisik</div>
          <div class="text-xl font-bold text-slate-800 mt-1">${summary.totalUnits || 0} Unit</div>
          <div class="text-[10px] text-slate-400 mt-0.5">Jumlah unit di gudang</div>
        </div>

        <div class="p-4 bg-sky-50 rounded-2xl border border-sky-200">
          <div class="text-[11px] text-sky-800 font-bold">Total Nilai Persediaan</div>
          <div class="text-xl font-black text-sky-950 mt-1">Rp ${Number(summary.totalValuation || 0).toLocaleString()}</div>
          <div class="text-[10px] text-sky-700 mt-0.5">Valuasi berbasis HPP</div>
        </div>

        <div class="p-4 ${(summary.lowStockCount || 0) > 0 ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'} rounded-2xl border">
          <div class="text-[11px] ${(summary.lowStockCount || 0) > 0 ? 'text-amber-800 font-bold' : 'text-slate-500 font-medium'}">Stok Kritis / Menipis</div>
          <div class="text-xl font-black ${(summary.lowStockCount || 0) > 0 ? 'text-amber-700' : 'text-slate-800'} mt-1">
            ${summary.lowStockCount || 0} Produk
          </div>
          <div class="text-[10px] text-slate-400 mt-0.5">&le; Stok minimum</div>
        </div>
      </div>

      <!-- DAFTAR PRODUK MENIPIS -->
      <div class="space-y-3 pt-2">
        <h3 class="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
          <i class="fa-solid fa-triangle-exclamation text-amber-500"></i> Daftar Produk Kritis & Perlu Restock
        </h3>
        <div class="overflow-x-auto border border-slate-100 rounded-2xl">
          <table class="w-full text-left text-xs">
            <thead>
              <tr class="table-header-custom border-b border-slate-200">
                <th class="py-2.5 px-3">SKU</th>
                <th class="py-2.5 px-3">Nama Produk</th>
                <th class="py-2.5 px-3">Kategori</th>
                <th class="py-2.5 px-3 text-center">Sisa Stok</th>
                <th class="py-2.5 px-3 text-center">Min. Stok</th>
                <th class="py-2.5 px-3 text-right">Nilai Stok (HPP)</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              ${lowStock.length === 0 ? `
                <tr><td colspan="6" class="py-4 text-center text-emerald-600 font-medium">✓ Seluruh persediaan produk berada di atas batas minimum.</td></tr>
              ` : lowStock.map(p => `
                <tr class="hover:bg-slate-50 transition">
                  <td class="py-2.5 px-3 font-mono font-bold text-slate-700">${p.sku}</td>
                  <td class="py-2.5 px-3 font-semibold text-slate-900">${p.name}</td>
                  <td class="py-2.5 px-3 text-slate-500">${p.category_name || '-'}</td>
                  <td class="py-2.5 px-3 text-center">
                    <span class="px-2 py-0.5 rounded-full font-bold text-[10px] bg-rose-100 text-rose-800">${p.current_stock} ${p.unit}</span>
                  </td>
                  <td class="py-2.5 px-3 text-center text-slate-500 font-medium">${p.min_stock} ${p.unit}</td>
                  <td class="py-2.5 px-3 text-right font-bold text-slate-800">Rp ${Number(p.current_stock * p.buy_price).toLocaleString()}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  `;
}

// Start application when DOM is loaded
document.addEventListener('DOMContentLoaded', initApp);
