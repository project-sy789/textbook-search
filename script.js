// State Management
let allBooks = [];
let filteredBooks = [];
let cart = []; // The shopping cart array
let currentPage = 1;
const itemsPerPage = 24;

// OBEC Budget State
let currentGrade = localStorage.getItem('cartGrade') || "ป.6";
let currentStudentCount = parseInt(localStorage.getItem('cartStudentCount')) || 30;
let isObecStrictMode = localStorage.getItem('obecStrictMode') !== "false"; // default true

const BUDGET_RATES = {
    "อนุบาล": 200, "อ.1": 200, "อ.2": 200, "อ.3": 200,
    "ป.1": 656, "ป.2": 650, "ป.3": 653, "ป.4": 707, "ป.5": 846, "ป.6": 859,
    "ม.1": 808, "ม.2": 921, "ม.3": 996,
    "ม.4": 1384, "ม.5": 1326, "ม.6": 1164
};

function getGradeCategory(grade) {
    if (grade.includes("อ.") || grade.includes("อนุบาล")) return "อนุบาล";
    if (grade.includes("ป.")) return "ประถม";
    if (grade.includes("ม.")) return "มัธยม";
    return "";
}

function validateCart(cartItems, gradeLevel, studentCount, strictMode) {
    let budgetPerStudent = BUDGET_RATES[gradeLevel] || 0;
    let totalBudget = budgetPerStudent * studentCount;
    let totalPrice = cartItems.reduce((sum, item) => sum + (parsePrice(item["ราคา"]) * (item.quantity || 1)), 0);
    let remainingBudget = totalBudget - totalPrice;
    
    let result = {
        totalBudget,
        totalPrice,
        remainingBudget,
        isValid: true,
        errors: [],
        warnings: [],
        canBuySupplementary: false,
        budgetStatusMessage: "",
        budgetStatusColor: ""
    };
    
    let account1Subjects = new Set();
    let hasWorkbook = false;
    let hasAccount2 = false;
    let hasAccount3 = false;
    let badWorkbooks = new Set();
    let oldEditions = new Set();
    
    cartItems.forEach(item => {
        let acc = item["บัญชี"] || "";
        if (acc.includes("บัญชี 1")) {
            if (item["กลุ่มสาระการเรียนรู้"]) account1Subjects.add(item["กลุ่มสาระการเรียนรู้"].trim());
        }
        if (item["ประเภท"] && item["ประเภท"].includes("แบบฝึกหัด")) hasWorkbook = true;
        if (acc.includes("บัญชี 2")) hasAccount2 = true;
        if (acc.includes("บัญชี 3")) hasAccount3 = true;
        
        // Curriculum Check 2560
        if (strictMode) {
            let subj = item["กลุ่มสาระการเรียนรู้"] || "";
            if (subj.includes("คณิตศาสตร์") || subj.includes("วิทยาศาสตร์") || subj.includes("ภูมิศาสตร์")) {
                let is2560 = (item["ปีพิมพ์เผยแพร่"] === "2560" || (item["ชื่อหนังสือ"] && item["ชื่อหนังสือ"].includes("2560")));
                if (!is2560) {
                    oldEditions.add(`ระวัง: "${item["ชื่อหนังสือ"]}" อาจไม่ใช่ฉบับปรับปรุง 2560`);
                }
            }
        }
    });
    
    let has8Groups = account1Subjects.size >= 8;
    
    if (strictMode) {
        let gradeCat = getGradeCategory(gradeLevel);
        
        // 1. Basic Subject Check
        if (gradeCat !== "อนุบาล" && !has8Groups && cartItems.length > 0) {
            result.warnings.push("คุณยังเลือกหนังสือเรียนรายวิชาพื้นฐาน (บัญชี 1) ไม่ครบ 8 กลุ่มสาระ");
        }
        
        // 2. Workbook Validation
        if (hasWorkbook) {
            if (gradeCat === "อนุบาล") {
                result.errors.push("ระดับปฐมวัยไม่อนุญาตให้จัดซื้อแบบฝึกหัด (อนุญาตเฉพาะหนังสือเสริมประสบการณ์)");
            } else if (gradeCat === "มัธยม") {
                result.errors.push("ระดับมัธยมศึกษาไม่อนุญาตให้ใช้งบเรียนฟรีจัดซื้อแบบฝึกหัด");
            } else if (gradeCat === "ประถม") {
                cartItems.forEach(item => {
                    if (item["ประเภท"] && item["ประเภท"].includes("แบบฝึกหัด")) {
                        let subj = item["กลุ่มสาระการเรียนรู้"] || "";
                        if (!subj.includes("ภาษาไทย") && !subj.includes("คณิตศาสตร์") && !subj.includes("ภาษาต่างประเทศ")) {
                            badWorkbooks.add(`ประถมศึกษาไม่อนุญาตให้ซื้อแบบฝึกหัดวิชา: ${subj || 'ระบุไม่ได้'}`);
                        }
                    }
                });
            }
        }
        
        // 3. Account 2 & 3 Lock Check
        if ((hasAccount2 || hasAccount3) && (!has8Groups || remainingBudget < 0)) {
            result.errors.push("สื่อการเรียนรู้ (บัญชี 2) และวิชาเพิ่มเติม (บัญชี 3) จะจัดซื้อได้เมื่อเลือกวิชาพื้นฐานครบ 8 กลุ่มสาระและมีงบประมาณเหลือจ่ายเท่านั้น");
        }
        
        badWorkbooks.forEach(e => result.errors.push(e));
        oldEditions.forEach(w => result.warnings.push(w));
        
        if (result.errors.length > 0) result.isValid = false;
    }
    
    // C. Budget Management Alerts
    if (remainingBudget < 0) {
        result.budgetStatusMessage = "🔴 งบประมาณไม่เพียงพอ: ตามระเบียบ สพฐ. ให้ยืมเงินจาก 'รายการค่ากิจกรรมพัฒนาคุณภาพผู้เรียน' มาใช้เป็นลำดับแรก หากยังไม่พอให้ยืมจาก 'รายการค่าจัดการเรียนการสอน' และเมื่อได้รับจัดสรรเพิ่มเติมให้ส่งใช้คืน";
        result.budgetStatusColor = "red";
    } else if (remainingBudget > 0 && has8Groups) {
        result.canBuySupplementary = true;
        result.budgetStatusMessage = `🟢 มีงบประมาณเหลือจ่าย ฿${remainingBudget.toLocaleString('th-TH')}: สามารถนำไปจัดซื้อสื่อการเรียนรู้ (บัญชี 2), หนังสือรายวิชาเพิ่มเติม (บัญชี 3) หรือจัดทำเอกสารประกอบการเรียนได้ (ต้องผ่านความเห็นชอบจากคณะกรรมการภาคี 4 ฝ่ายและกรรมการสถานศึกษา)`;
        result.budgetStatusColor = "green";
    } else if (remainingBudget > 0 && cartItems.length > 0) {
        result.budgetStatusMessage = `🟡 มีงบประมาณว่าง ฿${remainingBudget.toLocaleString('th-TH')} (ยังเลือกวิชาพื้นฐานไม่ครบ)`;
        result.budgetStatusColor = "yellow";
    }
    
    return result;
    return result;
}

// DOM Elements
const bookGrid = document.getElementById('bookGrid');
const loading = document.getElementById('loading');
const noResults = document.getElementById('noResults');
const pagination = document.getElementById('pagination');
const totalCount = document.getElementById('totalCount');
const searchInput = document.getElementById('searchInput');

const filterAccount = document.getElementById('filterAccount');
const filterType = document.getElementById('filterType');
const filterSubject = document.getElementById('filterSubject');
const filterGrade = document.getElementById('filterGrade');
const filterPublisher = document.getElementById('filterPublisher');
const resetFilters = document.getElementById('resetFilters');
const accountNotice = document.getElementById('accountNotice');

const modal = document.getElementById('bookModal');
const closeModal = document.getElementById('closeModal');
const modalContent = document.getElementById('modalContent');

const cartTrigger = document.getElementById('cartTrigger');
const cartBadge = document.getElementById('cartBadge');
const cartModal = document.getElementById('cartModal');
const closeCartModal = document.getElementById('closeCartModal');
const cartItemsContainer = document.getElementById('cartItems');
const cartTotalItems = document.getElementById('cartTotalItems');
const clearCartBtn = document.getElementById('clearCartBtn');
const exportCartBtn = document.getElementById('exportCartBtn');

// Initialize App
async function init() {
    try {
        const response = await fetch('data.json');
        if (!response.ok) throw new Error('Network response was not ok');
        allBooks = await response.json();
        
        // Add unique ID to each book to easily manage them in cart
        allBooks.forEach((book, idx) => {
            book._id = idx;
        });
        
        // Load cart from localStorage
        const savedCart = localStorage.getItem('textbookCart');
        if (savedCart) {
            cart = JSON.parse(savedCart);
            updateCartBadge();
        }
        
        // Fetch metadata
        try {
            const metaRes = await fetch('updated.json');
            if (metaRes.ok) {
                const meta = await metaRes.json();
                const d = new Date(meta.last_updated);
                const formatter = new Intl.DateTimeFormat('th-TH', { 
                    year: 'numeric', month: 'long', day: 'numeric', 
                    hour: '2-digit', minute: '2-digit' 
                });
                document.getElementById('lastUpdated').textContent = `🕒 ดึงข้อมูลล่าสุดเมื่อ: ${formatter.format(d)} น.`;
            }
        } catch(e) {
            console.error('No updated.json found', e);
        }
        
        // Apply initial configurations
        document.getElementById('cartGradeSelect').value = currentGrade;
        document.getElementById('cartStudentCount').value = currentStudentCount;
        document.getElementById('obecStrictModeToggle').checked = isObecStrictMode;

        document.getElementById('cartGradeSelect').addEventListener('change', (e) => {
            currentGrade = e.target.value;
            localStorage.setItem('cartGrade', currentGrade);
            renderCart(); renderGrid();
        });
        document.getElementById('cartStudentCount').addEventListener('input', (e) => {
            currentStudentCount = Math.max(1, parseInt(e.target.value) || 1);
            localStorage.setItem('cartStudentCount', currentStudentCount);
            renderCart(); renderGrid();
        });
        document.getElementById('obecStrictModeToggle').addEventListener('change', (e) => {
            isObecStrictMode = e.target.checked;
            localStorage.setItem('obecStrictMode', isObecStrictMode);
            renderCart(); renderGrid();
        });

        populateFilters();
        applyFilters();
        
        loading.classList.add('hidden');
    } catch (error) {
        console.error('Error loading data:', error);
        loading.innerHTML = `
            <svg style="color:#ef4444" xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
            <h2 style="margin-top:1rem;color:#f8fafc">ไม่สามารถโหลดข้อมูลได้</h2>
            <p style="color:#94a3b8">กรุณาตรวจสอบว่ามีไฟล์ data.json อยู่ในโฟลเดอร์ หรือลองรีเฟรชหน้าเว็บ</p>
        `;
    }
}

// Extract unique values for filters
function populateFilters() {
    const accounts = new Set();
    const types = new Set();
    const subjects = new Set();
    const grades = new Set();
    const publishers = new Set();

    allBooks.forEach(book => {
        if (book["บัญชี"]) accounts.add(book["บัญชี"]);
        if (book["ประเภท"]) types.add(book["ประเภท"]);
        if (book["กลุ่มสาระการเรียนรู้"]) subjects.add(book["กลุ่มสาระการเรียนรู้"]);
        if (book["ชั้น"]) grades.add(book["ชั้น"]);
        if (book["ผู้จัดพิมพ์"]) publishers.add(book["ผู้จัดพิมพ์"]);
    });

    populateSelect(filterAccount, Array.from(accounts).sort());
    populateSelect(filterType, Array.from(types).sort());
    populateSelect(filterSubject, Array.from(subjects).sort());
    populateSelect(filterGrade, Array.from(grades).sort());
    populateSelect(filterPublisher, Array.from(publishers).sort());
}

function populateSelect(selectElement, items) {
    items.forEach(item => {
        if (!item) return;
        const option = document.createElement('option');
        option.value = item;
        option.textContent = item;
        selectElement.appendChild(option);
    });
}

// Filter Logic
function applyFilters() {
    const searchTerm = searchInput.value.toLowerCase().trim();
    const accountValue = filterAccount.value;
    const typeValue = filterType.value;
    const subjectValue = filterSubject.value;
    const gradeValue = filterGrade.value;
    const publisherValue = filterPublisher.value;

    filteredBooks = allBooks.filter(book => {
        const matchesSearch = !searchTerm || 
            (book["ชื่อหนังสือ"] && book["ชื่อหนังสือ"].toLowerCase().includes(searchTerm)) ||
            (book["ผู้เรียบเรียง"] && book["ผู้เรียบเรียง"].toLowerCase().includes(searchTerm)) ||
            (book["ผู้จัดพิมพ์"] && book["ผู้จัดพิมพ์"].toLowerCase().includes(searchTerm));
            
        const matchesAccount = !accountValue || book["บัญชี"] === accountValue;
        const matchesType = !typeValue || book["ประเภท"] === typeValue;
        const matchesSubject = !subjectValue || book["กลุ่มสาระการเรียนรู้"] === subjectValue;
        const matchesGrade = !gradeValue || book["ชั้น"] === gradeValue;
        const matchesPublisher = !publisherValue || book["ผู้จัดพิมพ์"] === publisherValue;

        return matchesSearch && matchesAccount && matchesType && matchesSubject && matchesGrade && matchesPublisher;
    });

    currentPage = 1;
    totalCount.textContent = `พบ ${filteredBooks.length.toLocaleString()} รายการ จากทั้งหมด ${allBooks.length.toLocaleString()} รายการ`;
    renderGrid();
    checkWarnings(accountValue);
}

// Notice Logic
const WARNING_MESSAGES = {
    "11": "", "12": "",
    "21": "⚠️ สื่อการเรียนรู้ รายวิชาพื้นฐาน: กระทรวงศึกษาธิการไม่ได้สนับสนุนงบประมาณในการจัดซื้อ",
    "22": "⚠️ สื่อการเรียนรู้ รายวิชาพื้นฐาน: กระทรวงศึกษาธิการไม่ได้สนับสนุนงบประมาณในการจัดซื้อ",
    "31": "⚠️ สื่อการเรียนรู้รายวิชาเพิ่มเติม: สถานศึกษาสามารถนำงบประมาณที่เหลือจากการจัดซื้อหนังสือเรียนรายวิชาพื้นฐาน ให้แก่นักเรียนทุกคนแล้วไปจัดซื้อได้ โดยผ่านความเห็นชอบของภาคี 4 ฝ่าย",
    "32": "⚠️ สื่อการเรียนรู้รายวิชาเพิ่มเติม: สถานศึกษาสามารถนำงบประมาณที่เหลือจากการจัดซื้อหนังสือเรียนรายวิชาพื้นฐาน ให้แก่นักเรียนทุกคนแล้วไปจัดซื้อได้ โดยผ่านความเห็นชอบของภาคี 4 ฝ่าย"
};

function checkWarnings(account) {
    if (WARNING_MESSAGES[account] || (account && account.includes("บัญชี 2") || account.includes("บัญชี 3"))) {
        let warnText = "";
        if (account.includes("2")) warnText = "⚠️ <b>บัญชีที่ 2 สื่อการเรียนรู้ รายวิชาพื้นฐาน:</b> กระทรวงศึกษาธิการไม่ได้สนับสนุนงบประมาณในการจัดซื้อ";
        if (account.includes("3")) warnText = "⚠️ <b>บัญชีที่ 3 สื่อการเรียนรู้รายวิชาเพิ่มเติม:</b> สถานศึกษาสามารถนำงบประมาณที่เหลือจากการจัดซื้อหนังสือเรียนรายวิชาพื้นฐานให้แก่นักเรียนทุกคนแล้วไปจัดซื้อได้ โดยผ่านความเห็นชอบของภาคี 4 ฝ่าย";
        
        accountNotice.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg><div>${warnText}</div>`;
        accountNotice.classList.remove('hidden');
    } else {
        accountNotice.classList.add('hidden');
    }
}

// Render Book Cards
function renderGrid() {
    bookGrid.innerHTML = '';
    
    if (filteredBooks.length === 0) {
        bookGrid.classList.add('hidden');
        pagination.classList.add('hidden');
        noResults.classList.remove('hidden');
        return;
    }

    bookGrid.classList.remove('hidden');
    noResults.classList.add('hidden');
    pagination.classList.remove('hidden');

    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedBooks = filteredBooks.slice(startIndex, startIndex + itemsPerPage);

    paginatedBooks.forEach((book, index) => {
        const globalIndex = startIndex + index;
        const card = document.createElement('div');
        card.className = 'book-card';
        card.onclick = () => openModal(globalIndex);
        
        const rawImgSrc = book["รูปภาพ"] || '';
        // Use weserv proxy for HTTP images strictly on HTTPS origins
        const imgSrc = rawImgSrc.startsWith('http://') 
            ? `https://images.weserv.nl/?url=${encodeURIComponent(rawImgSrc)}` 
            : rawImgSrc;

        const imgBlock = imgSrc 
            ? `<img src="${imgSrc}" alt="${book["ชื่อหนังสือ"]}" loading="lazy" onerror="this.outerHTML='<div class=\\'no-image-placeholder\\'><svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'40\\' height=\\'40\\' viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'1.5\\'><rect x=\\'3\\' y=\\'3\\' width=\\'18\\' height=\\'18\\' rx=\\'2\\' ry=\\'2\\'></rect><circle cx=\\'8.5\\' cy=\\'8.5\\' r=\\'1.5\\'></circle><polyline points=\\'21 15 16 10 5 21\\'></polyline></svg><span>ไม่มีรูปภาพ</span></div>'">` 
            : `<div class="no-image-placeholder"><svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg></div>`;

        const inCart = cart.find(b => b._id === book._id);
        const btnClass = inCart ? "btn-add-cart added" : "btn-add-cart";
        const btnText = inCart 
            ? `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> นำเข้าแล้ว`
            : `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg> เข้าตะกร้า`;
        
        const onclickAttr = inCart 
            ? `onclick="event.stopPropagation();"` 
            : `onclick="event.stopPropagation(); addToCart(this, ${book._id})"`;

        card.innerHTML = `
            ${book["บัญชี"] ? `<div class="badge-tag">${book["บัญชี"]}</div>` : ''}
            <div class="card-image">
                ${imgBlock}
            </div>
            <div class="card-content">
                <h3 class="book-title" title="${book["ชื่อหนังสือ"]}">${book["ชื่อหนังสือ"] || 'ไม่ระบุชื่อ'}</h3>
                
                <div class="book-meta">
                    <div class="meta-row">
                        <svg class="meta-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                        <span>${book["กลุ่มสาระการเรียนรู้"] || '-'}</span>
                    </div>
                    <div class="meta-row">
                        <svg class="meta-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20v-6M6 20V10M18 20V4"></path></svg>
                        <span>${book["ชั้น"] || '-'}</span>
                    </div>
                    <div class="meta-row">
                        <svg class="meta-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
                        <span>${book["ผู้จัดพิมพ์"] || '-'}</span>
                    </div>
                </div>
                
                <div class="price-tag">
                    <span>${book["ราคา"] || 'ไม่ระบุ'}</span>
                    <button class="${btnClass}" ${onclickAttr}>
                        ${btnText}
                    </button>
                </div>
            </div>
        `;
        bookGrid.appendChild(card);
    });

    renderPagination();
}

// Pagination Logic
function renderPagination() {
    pagination.innerHTML = '';
    const totalPages = Math.ceil(filteredBooks.length / itemsPerPage);
    if (totalPages <= 1) return;

    // Prev Button
    const prevBtn = document.createElement('button');
    prevBtn.className = 'page-btn';
    prevBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"></polyline></svg>';
    prevBtn.disabled = currentPage === 1;
    prevBtn.onclick = () => { currentPage--; renderGrid(); window.scrollTo({top: 0, behavior: 'smooth'}); };
    pagination.appendChild(prevBtn);

    // Page Numbers logic
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, startPage + 4);
    
    if (endPage - startPage < 4) {
        startPage = Math.max(1, endPage - 4);
    }

    if (startPage > 1) {
        addPageBtn(1);
        if (startPage > 2) pagination.appendChild(createEllipsis());
    }

    for (let i = startPage; i <= endPage; i++) {
        addPageBtn(i);
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) pagination.appendChild(createEllipsis());
        addPageBtn(totalPages);
    }

    // Next Button
    const nextBtn = document.createElement('button');
    nextBtn.className = 'page-btn';
    nextBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>';
    nextBtn.disabled = currentPage === totalPages;
    nextBtn.onclick = () => { currentPage++; renderGrid(); window.scrollTo({top: 0, behavior: 'smooth'}); };
    pagination.appendChild(nextBtn);
}

function addPageBtn(num) {
    const btn = document.createElement('button');
    btn.className = `page-btn ${num === currentPage ? 'active' : ''}`;
    btn.textContent = num;
    btn.onclick = () => {
        currentPage = num;
        renderGrid();
        window.scrollTo({top: 0, behavior: 'smooth'});
    };
    pagination.appendChild(btn);
}

function createEllipsis() {
    const span = document.createElement('span');
    span.style.color = 'var(--text-muted)';
    span.textContent = '...';
    return span;
}

// Modal Logic
function openModal(index) {
    const book = filteredBooks[index];
    const rawImgSrc = book["รูปภาพ"] || '';
    const imgSrc = rawImgSrc.startsWith('http://') 
        ? `https://images.weserv.nl/?url=${encodeURIComponent(rawImgSrc)}` 
        : rawImgSrc;
    
    modalContent.innerHTML = `
        <div class="detail-layout">
            <div class="detail-image-box">
                ${imgSrc ? `<img src="${imgSrc}" alt="book cover" onerror="this.outerHTML='<span style=\\'color:#94a3b8\\'>ไม่มีรูปภาพ</span>'">` : '<span style="color:#94a3b8">ไม่มีรูปภาพ</span>'}
            </div>
            <div class="detail-info">
                <div class="detail-type">${book["บัญชี"] || ''} | ${book["ประเภท"] || 'หนังสือ'}</div>
                <h2 class="detail-title">${book["ชื่อหนังสือ"] || 'ไม่ระบุชื่อ'}</h2>
                <div style="color:var(--text-muted); margin-bottom: 2rem;">${book["ผู้แต่ง"] || book["ผู้เรียบเรียง"] || ''}</div>
                
                <div class="detail-grid">
                    ${createDetailItem("กลุ่มสาระการเรียนรู้", book["กลุ่มสาระการเรียนรู้"])}
                    ${createDetailItem("ระดับชั้น", book["ชั้น"])}
                    ${createDetailItem("รายวิชา", book["รายวิชา"])}
                    ${createDetailItem("ผู้จัดพิมพ์", book["ผู้จัดพิมพ์"])}
                    ${createDetailItem("ปีพิมพ์เผยแพร่", book["ปีพิมพ์เผยแพร่"])}
                    ${createDetailItem("ขนาด", book["ขนาด"])}
                    ${createDetailItem("จำนวนหน้า", book["จำนวนหน้า"])}
                    ${createDetailItem("น้ำหนัก", book["น้ำหนัก"])}
                    
                    <div class="detail-item detail-price">
                        <div class="detail-label">ราคา</div>
                        <div class="detail-value">${book["ราคา"] || '-'} บาท</div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function createDetailItem(label, value) {
    if (!value) return '';
    return `
        <div class="detail-item">
            <div class="detail-label">${label}</div>
            <div class="detail-value">${value}</div>
        </div>
    `;
}

closeModal.onclick = () => {
    modal.classList.add('hidden');
    document.body.style.overflow = 'auto';
}

modal.onclick = (e) => {
    if (e.target === modal) closeModal.click();
}

// ------ CART LOGIC ------
function addToCart(btnElement, bookId) {
    const book = allBooks.find(b => b._id === bookId);
    if (!book) return;
    
    // Check if duplicate
    if(!cart.find(b => b._id === bookId)) {
        cart.push({ ...book, quantity: 1 });
        saveCart();
        
        // Visual feedback
        btnElement.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> นำเข้าแล้ว`;
        btnElement.classList.add("added");
        btnElement.onclick = (e) => e.stopPropagation();
    }
}

function removeFromCart(bookId) {
    cart = cart.filter(b => b._id !== bookId);
    saveCart();
    renderCart(); // re-render modal
    renderGrid(); // Refresh buttons state in main grid
}

function saveCart() {
    localStorage.setItem('textbookCart', JSON.stringify(cart));
    updateCartBadge();
}

function updateCartBadge() {
    // Count distinct items (or sum, up to preference. Badge usually counts distinct product lines)
    cartBadge.textContent = cart.length;
    if (cart.length > 0) {
        cartBadge.style.animation = "spin 0.3s ease-out";
        setTimeout(()=> cartBadge.style.animation = "", 300);
    }
}

function parsePrice(priceStr) {
    if (!priceStr) return 0;
    const cleaned = priceStr.toString().replace(/,/g, '').replace(/[^\d.]/g, '');
    const val = parseFloat(cleaned);
    return isNaN(val) ? 0 : val;
}

function validateCartRules() {
    let budgetPerStudent = BUDGET_RATES[currentGrade] || 0;
    let totalBudget = budgetPerStudent * currentStudentCount;
    let totalPrice = cart.reduce((sum, b) => sum + (parsePrice(b["ราคา"]) * (b.quantity || 1)), 0);
    let remainingBudget = totalBudget - totalPrice;
    
    let res = {
        totalBudget, totalPrice, remainingBudget,
        isValid: true,
        errors: [], warnings: [],
        canBuySupplementary: false,
        budgetMsg: "",
        budgetClass: "success"
    };
    
    let account1Subjects = new Set();
    let hasWorkbook = false;
    let hasAccount3 = false;
    
    cart.forEach(item => {
        let acc = item["บัญชี"] || "";
        let t = item["ประเภท"] || "";
        let subj = item["กลุ่มสาระการเรียนรู้"] || "";
        let title = item["ชื่อหนังสือ"] || "";
        
        if (acc.includes("บัญชี 1")) {
            if (subj) account1Subjects.add(subj.trim());
        }
        if (t.includes("แบบฝึกหัด")) hasWorkbook = true;
        if (acc.includes("บัญชี 3")) hasAccount3 = true;
        
        // Curriculum Checking
        if (isObecStrictMode && acc.includes("บัญชี 1")) {
            if (subj.includes("คณิตศาสตร์") || subj.includes("วิทยาศาสตร์") || subj.includes("ภูมิศาสตร์")) {
                let is2560 = (item["ปีพิมพ์เผยแพร่"] === "2560" || title.includes("2560") || title.includes("60"));
                if (!is2560) {
                    res.warnings.push(`ตรวจสอบ: [${title}] กลุ่ม${subj} อาจไม่ใช่ฉบับปรับปรุง พ.ศ. 2560`);
                }
            }
        }
    });
    
    let has8Groups = account1Subjects.size >= 8;
    
    if (isObecStrictMode) {
        let cat = getGradeCategory(currentGrade);
        
        // Basic Subjects
        if (cat !== "อนุบาล" && !has8Groups && cart.length > 0) {
            res.warnings.push(`คุณเลือกหนังสือวิชาพื้นฐาน (บัญชี 1) ไปแล้ว ${account1Subjects.size} จาก 8 กลุ่มสาระ`);
        }
        
        // Workbooks
        if (hasWorkbook) {
            if (cat === "อนุบาล") {
                res.errors.push("ระดับปฐมวัย ไม่อนุญาตให้จัดซื้อแบบฝึกหัด (อนุญาตเฉพาะหนังสือเสริมประสบการณ์)");
            } else if (cat === "มัธยม") {
                res.errors.push("ระดับมัธยมศึกษา ไม่อนุญาตให้ใช้งบเรียนฟรีจัดซื้อแบบฝึกหัด");
            } else if (cat === "ประถม") {
                cart.forEach(item => {
                    if ((item["ประเภท"] || "").includes("แบบฝึกหัด")) {
                        let subj = item["กลุ่มสาระการเรียนรู้"] || "";
                        if (!subj.includes("ภาษาไทย") && !subj.includes("คณิตศาสตร์") && !subj.includes("ต่างประเทศ")) {
                            res.errors.push(`ระดับประถมศึกษา อนุญาตให้ซื้อแบบฝึกหัดได้เฉพาะ ภาษาไทย, คณิตศาสตร์, ภาษาอังกฤษ (พบวิชา: ${subj})`);
                        }
                    }
                });
            }
        }
        
        // Account 3 Lock
        if (hasAccount3 && (!has8Groups || remainingBudget < 0)) {
            res.errors.push("วิชาเพิ่มเติม (บัญชี 3) ไม่อนุญาตให้ซื้อจนกว่าจะเลือกวิชาพื้นฐานครบ 8 กลุ่มสาระและมีงบประมาณเหลือจ่าย");
        }
    }
    
    if (res.errors.length > 0) res.isValid = false;
    
    if (remainingBudget < 0) {
        res.budgetMsg = "🔴 งบประมาณไม่เพียงพอ: ตามระเบียบ สพฐ. ให้ยืมเงินจาก 'รายการค่ากิจกรรมฯ' มาใช้เป็นลำดับแรก หากยังไม่พอให้ยืมจาก 'รายการจัดการเรียนการสอน' และเมื่อได้รับจัดสรรเพิ่มให้ส่งใช้คืน";
        res.budgetClass = "error";
    } else if (remainingBudget > 0 && has8Groups) {
        res.canBuySupplementary = true;
        res.budgetMsg = "🟢 งบประมาณเหลือจ่าย: สามารถนำไปจัดซื้อรายวิชาเพิ่มเติม (บัญชี 3) หรือสำเนาเอกสารประกอบการเรียนได้ โดยต้องผ่านความเห็นชอบของคณะกรรมการ 4 ฝ่าย";
        res.budgetClass = "success";
    }
    
    return res;
}

function updateQuantity(bookId, newQty) {
    const item = cart.find(b => b._id === bookId);
    if (item) {
        item.quantity = Math.max(1, parseInt(newQty) || 1);
        saveCart();
        
        // Update Total Items without re-rendering the whole cart body to avoid losing input focus
        renderCartDashboardOnly();
    }
}

function renderCartDashboardOnly() {
    let vRes = validateCartRules();
    
    // Update total label
    let totalQty = cart.reduce((sum, b) => sum + (b.quantity || 1), 0);
    cartTotalItems.innerHTML = `${totalQty} เล่ม <span style="color:#34d399; margin-left:1rem;">฿${vRes.totalPrice.toLocaleString('th-TH', {minimumFractionDigits: 2})}</span>`;
    
    // Update Budget UI
    const dash = document.getElementById('budgetDashboard');
    const alerts = document.getElementById('validationAlerts');
    
    let percentUsed = Math.min(100, (vRes.totalPrice / vRes.totalBudget) * 100);
    if (!vRes.totalBudget || vRes.totalBudget === 0) percentUsed = 0;
    
    let colorHex = vRes.remainingBudget < 0 ? '#ef4444' : '#3b82f6';
    
    dash.innerHTML = `
        <div class="budget-stats">
            <div class="budget-stat-item">
                <div class="budget-stat-label">งบอุดหนุนต่อหัว x นักเรียน</div>
                <div class="budget-stat-value">฿${vRes.totalBudget.toLocaleString('th-TH')}</div>
            </div>
            <div class="budget-stat-item">
                <div class="budget-stat-label">ยอดจัดซื้อรวม</div>
                <div class="budget-stat-value" style="color:${colorHex}">฿${vRes.totalPrice.toLocaleString('th-TH')}</div>
            </div>
            <div class="budget-stat-item">
                <div class="budget-stat-label">งบประมาณเหลือจ่าย</div>
                <div class="budget-stat-value" style="color:${colorHex}">฿${vRes.remainingBudget.toLocaleString('th-TH')}</div>
            </div>
        </div>
        <div class="progress-bar-bg">
            <div class="progress-bar-fill" style="width: ${percentUsed}%; background-color: ${percentUsed > 100 ? '#ef4444' : '#3b82f6'};"></div>
        </div>
    `;
    
    // Update Alerts
    let altHtml = '';
    if (vRes.budgetMsg) {
        let bCls = vRes.budgetClass === "error" ? "alert-error" : "alert-success";
        altHtml += `<div class="alert ${bCls}">${vRes.budgetMsg}</div>`;
    }
    if (isObecStrictMode) {
        vRes.errors.forEach(e => {
            altHtml += `<div class="alert alert-error">❌ ${e}</div>`;
        });
        vRes.warnings.forEach(w => {
            altHtml += `<div class="alert alert-warn">⚠️ ${w}</div>`;
        });
    }
    alerts.innerHTML = altHtml;
    
    // Disable Export if Strict Mode fails
    const btnExp = document.getElementById('exportCartBtn');
    if (btnExp) {
        if (!vRes.isValid && isObecStrictMode) {
            btnExp.disabled = true;
            btnExp.style.opacity = '0.5';
            btnExp.style.cursor = 'not-allowed';
            btnExp.title = "กรุณาแก้ไขข้อผิดพลาดตามระเบียบ สพฐ. ก่อนนำออกเอกสาร";
        } else {
            btnExp.disabled = false;
            btnExp.style.opacity = '1';
            btnExp.style.cursor = 'pointer';
            btnExp.title = "";
        }
    }
}

function renderCart() {
    cartItemsContainer.innerHTML = '';
    renderCartDashboardOnly();
    
    if (cart.length === 0) {
        cartItemsContainer.innerHTML = '<div style="text-align:center; padding: 2rem; color:var(--text-muted);">ไม่มีหนังสือในตะกร้า เริ่มค้นหาและเพิ่มได้เลย!</div>';
        return;
    }
    
    cart.forEach(book => {
        const item = document.createElement('div');
        item.className = 'cart-item';
        const qty = book.quantity || 1;
        const lineTotal = parsePrice(book["ราคา"]) * qty;
        
        item.innerHTML = `
            <div class="cart-item-info">
                <div class="cart-item-title">${book["ชื่อหนังสือ"]}</div>
                <div class="cart-item-meta">${book["บัญชี"] || ''} | ${book["ประเภท"] || ''} - ${book["ราคา"] || 'ไม่ระบุราคา'}</div>
                <div style="color:#34d399; font-weight:500; font-size:0.9rem; margin-top:0.25rem;">รวม: ฿${lineTotal.toLocaleString('th-TH', {minimumFractionDigits: 2})}</div>
            </div>
            <div class="cart-item-qty" style="display:flex; align-items:center; gap:0.5rem; margin-right: 1rem;">
                <span style="font-size:0.85rem; color:var(--text-muted);">จำนวน: </span>
                <input type="number" min="1" value="${qty}" onchange="updateQuantity(${book._id}, this.value)" style="width: 60px; padding: 0.25rem 0.5rem; border-radius: 6px; border: 1px solid rgba(255,255,255,0.2); background: rgba(0,0,0,0.3); color: white; text-align: center; font-family: var(--font-family);">
            </div>
            <button class="btn-remove" onclick="removeFromCart(${book._id})" title="ลบออก">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
        `;
        cartItemsContainer.appendChild(item);
    });
}

function exportToXLS() {
    if(cart.length === 0) {
        alert("ตะกร้าว่างเปล่า! กรุณาเพิ่มหนังสือลงตะกร้าก่อน Export");
        return;
    }
    
    // Convert cart objects to suitable format for Excel
    let totalQty = 0;
    let grandTotal = 0;
    
    const exportData = cart.map(book => {
        const qty = book.quantity || 1;
        const price = parsePrice(book["ราคา"]);
        const lineTotal = price * qty;
        
        totalQty += qty;
        grandTotal += lineTotal;
        
        return {
            "บัญชี": book["บัญชี"] || "",
            "ประเภท": book["ประเภท"] || "",
            "ชื่อหนังสือ": book["ชื่อหนังสือ"] || "",
            "รายวิชา": book["รายวิชา"] || "",
            "กลุ่มสาระ": book["กลุ่มสาระการเรียนรู้"] || "",
            "ระดับชั้น": book["ชั้น"] || "",
            "สำนักพิมพ์": book["ผู้จัดพิมพ์"] || "",
            "ราคาต่อหน่วย": price,
            "จำนวนเล่ม": qty,
            "ราคารวม": lineTotal
        };
    });
    
    // Append a Grand Total row
    exportData.push({
        "บัญชี": "",
        "ประเภท": "",
        "ชื่อหนังสือ": "",
        "รายวิชา": "",
        "กลุ่มสาระ": "",
        "ระดับชั้น": "",
        "สำนักพิมพ์": "",
        "ราคาต่อหน่วย": "รวมยอดทั้งหมด",
        "จำนวนเล่ม": totalQty,
        "ราคารวม": grandTotal
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Selected Books");
    
    XLSX.writeFile(workbook, "รายการหนังสือเรียนที่เลือก.xlsx", { compression: true });
}

// Event Listeners for Cart
cartTrigger.addEventListener('click', () => {
    renderCart();
    cartModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
});

closeCartModal.addEventListener('click', () => {
    cartModal.classList.add('hidden');
    document.body.style.overflow = 'auto';
});

cartModal.addEventListener('click', (e) => {
    if (e.target === cartModal) closeCartModal.click();
});

clearCartBtn.addEventListener('click', () => {
    if(confirm("แน่ใจหรือไม่ว่าต้องการล้างตะกร้าทั้งหมด?")) {
        cart = [];
        saveCart();
        renderCart();
        renderGrid(); // Refresh buttons
    }
});

exportCartBtn.addEventListener('click', exportToXLS);

// Event Listeners for Filters
searchInput.addEventListener('input', applyFilters);
filterAccount.addEventListener('change', applyFilters);
filterType.addEventListener('change', applyFilters);
filterSubject.addEventListener('change', applyFilters);
filterGrade.addEventListener('change', applyFilters);
filterPublisher.addEventListener('change', applyFilters);

resetFilters.addEventListener('click', () => {
    searchInput.value = '';
    filterAccount.value = '';
    filterType.value = '';
    filterSubject.value = '';
    filterGrade.value = '';
    filterPublisher.value = '';
    applyFilters();
});

// Start
init();
