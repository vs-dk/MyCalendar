/* ============================================
   CUSTODY CALENDAR — Application Logic
   ============================================ */

// ---- Constants ----
const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

const MONTHS_SHORT = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

const MODES = ['custody', 'school', 'work'];
const MODE_LABELS = { custody: 'ELLA', school: 'SCHOOL', work: 'WORK' };
const MODE_CLASSES = { custody: 'mode-custody', school: 'mode-school', work: 'mode-work' };

// ---- State ----
const state = {
    currentYear: new Date().getFullYear(),
    currentMonth: new Date().getMonth(), // 0-indexed
    isLocked: true,
    currentModeIndex: 0,
    // Data: keyed by "YYYY-MM-DD" → Set of marker types
    markers: {},
};

// ---- DOM References ----
const dom = {
    monthYearLabel: document.getElementById('month-year-label'),
    btnPrev: document.getElementById('btn-prev'),
    btnNext: document.getElementById('btn-next'),
    calendarGrid: document.getElementById('calendar-grid'),
    btnLock: document.getElementById('btn-lock'),
    lockIcon: document.getElementById('lock-icon'),
    btnMode: document.getElementById('btn-mode'),
    modalOverlay: document.getElementById('modal-overlay'),
    modalYearLabel: document.getElementById('modal-year-label'),
    modalYearPrev: document.getElementById('modal-year-prev'),
    modalYearNext: document.getElementById('modal-year-next'),
    modalMonthsGrid: document.getElementById('modal-months-grid'),
};

// ---- Helpers ----

/** Create a date key string "YYYY-MM-DD" */
function dateKey(year, month, day) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Get markers for a date */
function getMarkers(key) {
    return state.markers[key] || new Set();
}

/** Toggle a marker on a date */
function toggleMarker(key, type) {
    if (!state.markers[key]) {
        state.markers[key] = new Set();
    }
    if (state.markers[key].has(type)) {
        state.markers[key].delete(type);
        if (state.markers[key].size === 0) {
            delete state.markers[key];
        }
    } else {
        state.markers[key].add(type);
    }
    saveData();
}

/** Get the current mode string */
function currentMode() {
    return MODES[state.currentModeIndex];
}

/** Check if a date is today */
function isToday(year, month, day) {
    const today = new Date();
    return today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
}

/** Get the number of days in a month */
function daysInMonth(year, month) {
    return new Date(year, month + 1, 0).getDate();
}

/** Get the day of week for the 1st of a month (0=Sun → adjusted to Mon=0) */
function firstDayOfMonth(year, month) {
    const day = new Date(year, month, 1).getDay();
    return (day + 6) % 7; // Convert: Sun=0 → 6, Mon=1 → 0, etc.
}

// ---- Persistence (localStorage) ----

function saveData() {
    const serialized = {};
    for (const [key, markers] of Object.entries(state.markers)) {
        serialized[key] = Array.from(markers);
    }
    localStorage.setItem('custody-calendar-data', JSON.stringify(serialized));
}

function loadData() {
    try {
        const raw = localStorage.getItem('custody-calendar-data');
        if (raw) {
            const parsed = JSON.parse(raw);
            for (const [key, arr] of Object.entries(parsed)) {
                state.markers[key] = new Set(arr);
            }
        }
    } catch (e) {
        console.warn('Failed to load calendar data:', e);
    }
}

// ---- Rendering ----

function renderHeader() {
    dom.monthYearLabel.textContent = `${MONTHS[state.currentMonth]} ${state.currentYear}`;
}

function renderCalendar(direction = null) {
    const grid = dom.calendarGrid;
    grid.innerHTML = '';

    // Apply slide animation
    if (direction) {
        grid.classList.remove('slide-left', 'slide-right');
        // Force reflow
        void grid.offsetWidth;
        grid.classList.add(direction === 'left' ? 'slide-left' : 'slide-right');
    }

    const year = state.currentYear;
    const month = state.currentMonth;
    const totalDays = daysInMonth(year, month);
    const startDay = firstDayOfMonth(year, month); // 0=Monday

    // Previous month info
    const prevMonth = month === 0 ? 11 : month - 1;
    const prevYear = month === 0 ? year - 1 : year;
    const prevMonthDays = daysInMonth(prevYear, prevMonth);

    // Next month info
    const nextMonth = month === 11 ? 0 : month + 1;
    const nextYear = month === 11 ? year + 1 : year;

    // We always show 6 rows × 7 days = 42 cells + 6 gap cells = 48 total
    let dayCounter = 1;
    let nextDayCounter = 1;

    for (let row = 0; row < 6; row++) {
        for (let col = 0; col < 8; col++) { // 8 because col 5 is the gap
            // Column 5 is the weekend gap
            if (col === 5) {
                const gapCell = document.createElement('div');
                gapCell.className = 'day-cell weekend-gap';
                grid.appendChild(gapCell);
                continue;
            }

            const actualCol = col > 5 ? col - 1 : col; // Adjust for gap column
            const cellIndex = row * 7 + actualCol;

            const cell = document.createElement('div');
            cell.className = 'day-cell';

            let cellYear, cellMonth, cellDay, isOtherMonth = false;

            if (cellIndex < startDay) {
                // Previous month
                cellDay = prevMonthDays - startDay + cellIndex + 1;
                cellYear = prevYear;
                cellMonth = prevMonth;
                isOtherMonth = true;
            } else if (cellIndex >= startDay + totalDays) {
                // Next month
                cellDay = nextDayCounter++;
                cellYear = nextYear;
                cellMonth = nextMonth;
                isOtherMonth = true;
            } else {
                // Current month
                cellDay = dayCounter++;
                cellYear = year;
                cellMonth = month;
            }

            if (isOtherMonth) {
                cell.classList.add('other-month');
            }

            // Check markers
            const key = dateKey(cellYear, cellMonth, cellDay);
            const markers = getMarkers(key);

            if (markers.has('custody')) {
                cell.classList.add('custody');
            }
            if (markers.has('school')) {
                cell.classList.add('school-holiday');
            }
            if (markers.has('work')) {
                cell.classList.add('work-holiday');
            }

            // Marker dot (only if has school or work holiday)
            if (markers.has('school') || markers.has('work')) {
                const dot = document.createElement('div');
                dot.className = 'marker-dot';
                cell.appendChild(dot);
            }

            // Day number
            const dayNum = document.createElement('span');
            dayNum.className = 'day-number';
            dayNum.textContent = cellDay;
            cell.appendChild(dayNum);

            // Today highlight
            if (isToday(cellYear, cellMonth, cellDay)) {
                cell.classList.add('today');
            }

            // Editable state
            if (!state.isLocked) {
                cell.classList.add('editable');
                cell.addEventListener('click', () => {
                    toggleMarker(key, currentMode());
                    renderCalendar();
                });
            }

            // Store date info on cell
            cell.dataset.date = key;

            grid.appendChild(cell);
        }
    }
}

function renderLockState() {
    const btn = dom.btnLock;
    const svg = dom.lockIcon;

    if (state.isLocked) {
        btn.classList.remove('unlocked');
        dom.btnMode.classList.add('hidden');
        // Locked icon SVG path
        svg.innerHTML = `
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
        `;
    } else {
        btn.classList.add('unlocked');
        dom.btnMode.classList.remove('hidden');
        // Unlocked icon SVG path
        svg.innerHTML = `
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 9.9-1"></path>
        `;
    }
}

function renderModeButton() {
    const mode = currentMode();
    dom.btnMode.textContent = MODE_LABELS[mode];

    // Remove all mode classes
    dom.btnMode.classList.remove(...Object.values(MODE_CLASSES));
    // Add current mode class
    dom.btnMode.classList.add(MODE_CLASSES[mode]);
}

function renderAll() {
    renderHeader();
    renderCalendar();
    renderLockState();
    renderModeButton();
}

// ---- Navigation ----

function goToMonth(year, month, direction = null) {
    state.currentYear = year;
    state.currentMonth = month;
    renderHeader();
    renderCalendar(direction);
}

function prevMonth() {
    let m = state.currentMonth - 1;
    let y = state.currentYear;
    if (m < 0) { m = 11; y--; }
    goToMonth(y, m, 'right');
}

function nextMonth() {
    let m = state.currentMonth + 1;
    let y = state.currentYear;
    if (m > 11) { m = 0; y++; }
    goToMonth(y, m, 'left');
}

// ---- Modal ----

let modalYear = state.currentYear;

function openModal() {
    modalYear = state.currentYear;
    renderModal();
    dom.modalOverlay.classList.remove('hidden');
    // Trigger animation on next frame
    requestAnimationFrame(() => {
        dom.modalOverlay.classList.add('visible');
    });
}

function closeModal() {
    dom.modalOverlay.classList.remove('visible');
    setTimeout(() => {
        dom.modalOverlay.classList.add('hidden');
    }, 250);
}

function renderModal() {
    dom.modalYearLabel.textContent = modalYear;

    dom.modalMonthsGrid.innerHTML = '';
    for (let i = 0; i < 12; i++) {
        const btn = document.createElement('button');
        btn.className = 'modal-month-btn';
        btn.textContent = MONTHS_SHORT[i];

        if (i === state.currentMonth && modalYear === state.currentYear) {
            btn.classList.add('current');
        }

        btn.addEventListener('click', () => {
            goToMonth(modalYear, i, null);
            closeModal();
        });

        dom.modalMonthsGrid.appendChild(btn);
    }
}

// ---- Swipe Gesture ----

let touchStartX = 0;
let touchEndX = 0;
const SWIPE_THRESHOLD = 50;

function handleTouchStart(e) {
    touchStartX = e.changedTouches[0].screenX;
}

function handleTouchEnd(e) {
    touchEndX = e.changedTouches[0].screenX;
    const diff = touchStartX - touchEndX;

    if (Math.abs(diff) > SWIPE_THRESHOLD) {
        if (diff > 0) {
            nextMonth(); // Swipe left → next month
        } else {
            prevMonth(); // Swipe right → prev month
        }
    }
}

// ---- Event Listeners ----

function initEvents() {
    // Navigation arrows
    dom.btnPrev.addEventListener('click', prevMonth);
    dom.btnNext.addEventListener('click', nextMonth);

    // Month/year label → open modal
    dom.monthYearLabel.addEventListener('click', openModal);

    // Lock toggle
    dom.btnLock.addEventListener('click', () => {
        state.isLocked = !state.isLocked;
        renderLockState();
        renderCalendar();
    });

    // Mode toggle
    dom.btnMode.addEventListener('click', () => {
        state.currentModeIndex = (state.currentModeIndex + 1) % MODES.length;
        renderModeButton();
    });

    // Modal
    dom.modalOverlay.addEventListener('click', (e) => {
        if (e.target === dom.modalOverlay) {
            closeModal();
        }
    });

    dom.modalYearPrev.addEventListener('click', () => {
        modalYear--;
        renderModal();
    });

    dom.modalYearNext.addEventListener('click', () => {
        modalYear++;
        renderModal();
    });

    // Swipe gestures
    dom.calendarGrid.addEventListener('touchstart', handleTouchStart, { passive: true });
    dom.calendarGrid.addEventListener('touchend', handleTouchEnd, { passive: true });

    // Keyboard navigation (desktop)
    document.addEventListener('keydown', (e) => {
        if (dom.modalOverlay.classList.contains('visible')) {
            if (e.key === 'Escape') closeModal();
            return;
        }
        if (e.key === 'ArrowLeft') prevMonth();
        if (e.key === 'ArrowRight') nextMonth();
    });
}

// ---- Init ----

function init() {
    loadData();
    initEvents();
    renderAll();

    // Register Service Worker for PWA
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js')
            .then(() => console.log('SW registered'))
            .catch((err) => console.warn('SW registration failed:', err));
    }
}

// Start the app
init();
