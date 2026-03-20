// State Management
let allBooks = [];
let filteredBooks = [];
let cart = []; // The shopping cart array
let currentPage = 1;
const itemsPerPage = 24;

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

function updateQuantity(bookId, newQty) {
    const item = cart.find(b => b._id === bookId);
    if (item) {
        item.quantity = Math.max(1, parseInt(newQty) || 1);
        saveCart();
        
        // Update Total Items without re-rendering the whole cart body to avoid losing input focus
        let total = 0;
        let totalPrice = 0;
        cart.forEach(b => {
            const qty = b.quantity || 1;
            total += qty;
            totalPrice += parsePrice(b["ราคา"]) * qty;
        });
        cartTotalItems.innerHTML = `${total} เล่ม <span style="color:#34d399; margin-left:1rem;">฿${totalPrice.toLocaleString('th-TH', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>`;
    }
}

function renderCart() {
    cartItemsContainer.innerHTML = '';
    
    let totalQty = 0;
    let totalPrice = 0;
    cart.forEach(book => {
        const qty = book.quantity || 1;
        totalQty += qty;
        totalPrice += parsePrice(book["ราคา"]) * qty;
    });
    
    cartTotalItems.innerHTML = `${totalQty} เล่ม <span style="color:#34d399; margin-left:1rem;">฿${totalPrice.toLocaleString('th-TH', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>`;
    
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
    const exportData = cart.map(book => {
        const qty = book.quantity || 1;
        const price = parsePrice(book["ราคา"]);
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
            "ราคารวม": price * qty
        };
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
