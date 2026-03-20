// State Management
let allBooks = [];
let filteredBooks = [];
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

const modal = document.getElementById('bookModal');
const closeModal = document.getElementById('closeModal');
const modalContent = document.getElementById('modalContent');

// Initialize App
async function init() {
    try {
        const response = await fetch('data.json');
        if (!response.ok) throw new Error('Network response was not ok');
        allBooks = await response.json();
        
        // Remove duplicates if any (based on name and grade)
        const uniqueKeys = new Set();
        const uniqueBooks = [];
        allBooks.forEach(book => {
            const key = `${book["ชื่อหนังสือ"]}-${book["ชั้น"]}-${book["ผู้จัดพิมพ์"]}`;
            if (!uniqueKeys.has(key)) {
                uniqueKeys.add(key);
                uniqueBooks.push(book);
            }
        });
        allBooks = uniqueBooks;
        
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
    totalCount.textContent = `พบ ${filteredBooks.length.toLocaleString()} รายการ`;
    renderGrid();
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

// Event Listeners
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
