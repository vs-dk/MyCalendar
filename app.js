/* ============================================
   MY CALENDAR — Application Logic
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
    btnToday: document.getElementById('btn-today'),
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
    syncToGitHub(serialized);
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
    // Also pull from GitHub to stay in sync across devices
    loadFromGitHub();
}

async function loadFromGitHub() {
    const token = getGitHubToken();
    if (!token) return;

    try {
        const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_FILE}`, {
            headers: { 'Authorization': `token ${token}` }
        });
        if (!res.ok) return;

        const data = await res.json();
        const parsed = JSON.parse(atob(data.content));

        // Replace local data with GitHub data (GitHub is source of truth)
        state.markers = {};
        for (const [key, arr] of Object.entries(parsed)) {
            state.markers[key] = new Set(arr);
        }

        // Update localStorage to match
        localStorage.setItem('custody-calendar-data', JSON.stringify(parsed));

        // Re-render with fresh data
        renderCalendar();
    } catch (e) {
        console.warn('GitHub load failed, using local data:', e);
    }
}

// ---- GitHub Sync ----

const GITHUB_REPO = 'vs-dk/MyCalendar';
const GITHUB_FILE = 'data/markers.json';

function getGitHubToken() {
    return localStorage.getItem('github-token');
}

function setGitHubToken(token) {
    localStorage.setItem('github-token', token);
}

async function syncToGitHub(data) {
    const token = getGitHubToken();
    if (!token) return;

    try {
        // Get current file SHA (needed for updates)
        let sha = null;
        const getRes = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_FILE}`, {
            headers: { 'Authorization': `token ${token}` }
        });
        if (getRes.ok) {
            const existing = await getRes.json();
            sha = existing.sha;
        }

        // Write file
        const body = {
            message: 'sync markers',
            content: btoa(JSON.stringify(data, null, 2)),
        };
        if (sha) body.sha = sha;

        await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_FILE}`, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });
    } catch (e) {
        console.warn('GitHub sync failed:', e);
    }
}

// ---- Rendering ----

function renderHeader(flash = false) {
    dom.monthYearLabel.textContent = `${MONTHS[state.currentMonth]} ${state.currentYear}`;
    if (flash) {
        dom.monthYearLabel.classList.remove('flash');
        void dom.monthYearLabel.offsetWidth; // force reflow
        dom.monthYearLabel.classList.add('flash');
    }
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

            // Event indicator (dot above day number)
            const dayEvents = getEventsForDate(key);
            if (dayEvents.length > 0) {
                cell.classList.add('has-events');
                const eventDot = document.createElement('div');
                eventDot.className = 'event-dot';
                cell.appendChild(eventDot);
            }

            // Editable state
            if (!state.isLocked) {
                cell.classList.add('editable');
                cell.addEventListener('click', () => {
                    toggleMarker(key, currentMode());
                    renderCalendar();
                });
            } else if (dayEvents.length > 0) {
                // Locked + has events: show tooltip on tap
                const tooltipCol = col;
                cell.addEventListener('click', () => showEventTooltip(cell, dayEvents, tooltipCol));
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

// ---- Event tooltip on calendar ----

let activeTooltip = null;

function showEventTooltip(cell, events, col) {
    // Remove existing tooltip
    if (activeTooltip) {
        activeTooltip.remove();
        activeTooltip = null;
    }

    const tooltip = document.createElement('div');
    tooltip.className = 'event-tooltip';

    // Align tooltip based on column position
    if (col <= 1) {
        // Monday/Tuesday: align left
        tooltip.style.left = '0';
        tooltip.style.transform = 'none';
    } else if (col >= 6) {
        // Saturday/Sunday: align right
        tooltip.style.left = 'auto';
        tooltip.style.right = '0';
        tooltip.style.transform = 'none';
    }

    for (const ev of events) {
        const line = document.createElement('div');
        line.className = 'event-tooltip-line';
        const dot = ev.type === 'oo' ? '\uD83D\uDFE0' : '\uD83D\uDD34'; // 🟠 or 🔴
        line.textContent = dot + ' ' + (ev.text || '(no description)');
        tooltip.appendChild(line);
    }

    cell.style.position = 'relative';
    cell.appendChild(tooltip);
    activeTooltip = tooltip;

    // Close on tap anywhere else
    const close = (e) => {
        if (!tooltip.contains(e.target) && e.target !== cell) {
            tooltip.remove();
            activeTooltip = null;
            document.removeEventListener('click', close);
        }
    };
    setTimeout(() => document.addEventListener('click', close), 10);
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
    renderHeader(true);
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

    // Today button (mobile)
    dom.btnToday.addEventListener('click', () => {
        const now = new Date();
        goToMonth(now.getFullYear(), now.getMonth(), null);
    });

    // Month/year label → open modal
    dom.monthYearLabel.addEventListener('click', openModal);

    // Lock toggle
    dom.btnLock.addEventListener('click', () => {
        state.isLocked = !state.isLocked;
        if (!state.isLocked) {
            state.currentModeIndex = 0; // Always start with "Ella" mode
            renderModeButton();
        }
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
    // Check for token in URL (one-time setup)
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) {
        setGitHubToken(token);
        // Clean URL
        window.history.replaceState({}, '', window.location.pathname);
        console.log('GitHub token saved');
    }

    loadData();
    initEvents();
    renderAll();

    // Register Service Worker for PWA
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js')
            .then(() => console.log('SW registered'))
            .catch((err) => console.warn('SW registration failed:', err));
    }
}

// ============================================
//  EVENTS SYSTEM (One-off & Recurring)
// ============================================

const GITHUB_EVENTS_FILE = 'data/events.json';
const FILTER_STATES = ['all', 'oo', 'rec', 'completed'];
const FILTER_LABELS = { all: 'ALL', oo: '1 OFF', rec: 'REC', completed: 'DONE' };

const eventsState = {
    oneoff: [],      // {id, date, text, completed}
    recurring: [],   // {id, day, text, completed: [dates]}
    filterIndex: 0,
    expanded: false,  // true = 12 months view
    deleteConfirmId: null,
    doneConfirmId: null,
    undoConfirmId: null,
};

// ---- Events DOM refs ----
const evDom = {
    section: document.getElementById('events-section'),
    list: document.getElementById('events-list'),
    btnAddOO: document.getElementById('btn-add-oo'),
    btnAddRec: document.getElementById('btn-add-rec'),
    btnFilter: document.getElementById('btn-filter'),
    btnExpand: document.getElementById('btn-expand'),
    // OO modal
    ooOverlay: document.getElementById('modal-oo-overlay'),
    ooYear: document.getElementById('oo-year'),
    ooMonth: document.getElementById('oo-month'),
    ooDay: document.getElementById('oo-day'),
    ooText: document.getElementById('oo-text'),
    ooSave: document.getElementById('oo-save'),
    ooCancel: document.getElementById('oo-cancel'),
    // REC modal
    recOverlay: document.getElementById('modal-rec-overlay'),
    recDay: document.getElementById('rec-day'),
    recText: document.getElementById('rec-text'),
    recSave: document.getElementById('rec-save'),
    recCancel: document.getElementById('rec-cancel'),
    // Detail modal
    detailOverlay: document.getElementById('modal-event-detail-overlay'),
    detailTitle: document.getElementById('detail-title'),
    detailDate: document.getElementById('detail-date'),
    detailText: document.getElementById('detail-text'),
    detailDelete: document.getElementById('detail-delete'),
    detailDone: document.getElementById('detail-done'),
    detailClose: document.getElementById('detail-close'),
};

// ---- Events helpers ----

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function todayStr() {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
}

function addMonths(dateStr, months) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1 + months, d);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatDateShort(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    return `${d} ${MONTHS_SHORT[m - 1]}`;
}

function daysInMonthNum(year, month) {
    return new Date(year, month, 0).getDate();
}

/** Check if a date has any events (one-off or recurring) */
function getEventsForDate(dateStr) {
    const events = [];
    for (const ev of eventsState.oneoff) {
        if (ev.date === dateStr && !ev.completed) {
            events.push({ type: 'oo', text: ev.text });
        }
    }
    const [y, m, d] = dateStr.split('-').map(Number);
    for (const ev of eventsState.recurring) {
        const maxDay = daysInMonthNum(y, m);
        const actualDay = Math.min(ev.day, maxDay);
        if (actualDay === d) {
            const isCompleted = (ev.completed || []).includes(dateStr);
            if (!isCompleted) {
                events.push({ type: 'rec', text: ev.text });
            }
        }
    }
    return events;
}

// ---- Events persistence ----

function saveEvents() {
    const data = {
        oneoff: eventsState.oneoff,
        recurring: eventsState.recurring,
    };
    localStorage.setItem('calendar-events', JSON.stringify(data));
    syncEventsToGitHub(data);
}

function loadEvents() {
    try {
        const raw = localStorage.getItem('calendar-events');
        if (raw) {
            const parsed = JSON.parse(raw);
            eventsState.oneoff = parsed.oneoff || [];
            eventsState.recurring = parsed.recurring || [];
        }
    } catch (e) {
        console.warn('Failed to load events:', e);
    }
    loadEventsFromGitHub();
}

async function loadEventsFromGitHub() {
    const token = getGitHubToken();
    if (!token) return;

    try {
        const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_EVENTS_FILE}`, {
            headers: { 'Authorization': `token ${token}` }
        });
        if (!res.ok) return;

        const data = await res.json();
        const parsed = JSON.parse(atob(data.content));

        eventsState.oneoff = parsed.oneoff || [];
        eventsState.recurring = parsed.recurring || [];

        localStorage.setItem('calendar-events', JSON.stringify(parsed));
        renderEventsList();
    } catch (e) {
        console.warn('GitHub events load failed, using local data:', e);
    }
}

async function syncEventsToGitHub(data) {
    const token = getGitHubToken();
    if (!token) return;

    try {
        let sha = null;
        const getRes = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_EVENTS_FILE}`, {
            headers: { 'Authorization': `token ${token}` }
        });
        if (getRes.ok) {
            const existing = await getRes.json();
            sha = existing.sha;
        }

        const body = {
            message: 'sync events',
            content: btoa(JSON.stringify(data, null, 2)),
        };
        if (sha) body.sha = sha;

        await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_EVENTS_FILE}`, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });
    } catch (e) {
        console.warn('GitHub events sync failed:', e);
    }
}

// ---- Generate flat list of events for display ----

function getEventsList() {
    const today = todayStr();
    const maxDate = eventsState.expanded ? addMonths(today, 12) : addMonths(today, 1);
    // For completed view: show last 3 months
    const minCompleted = addMonths(today, -3);

    const filter = FILTER_STATES[eventsState.filterIndex];
    const items = [];

    // One-off events
    if (filter !== 'rec') {
        for (const ev of eventsState.oneoff) {
            if (filter === 'completed') {
                if (ev.completed && ev.date >= minCompleted) {
                    items.push({ ...ev, type: 'oo', sortDate: ev.date });
                }
            } else {
                if (!ev.completed && ev.date <= maxDate) {
                    items.push({ ...ev, type: 'oo', sortDate: ev.date });
                }
            }
        }
    }

    // Recurring events — expand into instances
    if (filter !== 'oo') {
        for (const ev of eventsState.recurring) {
            // For non-completed: start from next month if the day already passed this month
            const startDate = new Date(today.substring(0, 7) + '-01');
            const start = filter === 'completed'
                ? new Date(minCompleted.substring(0, 7) + '-01')
                : new Date(startDate);
            // For completed: scan up to 12 months ahead to catch future instances marked done
            const endDate = filter === 'completed'
                ? new Date(addMonths(today, 12))
                : new Date(maxDate);

            // Generate one instance per month
            const d = new Date(start);
            while (d <= endDate) {
                const y = d.getFullYear();
                const m = d.getMonth() + 1;
                const maxDay = daysInMonthNum(y, m);
                const actualDay = Math.min(ev.day, maxDay);
                const instanceDate = `${y}-${String(m).padStart(2, '0')}-${String(actualDay).padStart(2, '0')}`;
                const isCompleted = (ev.completed || []).includes(instanceDate);

                if (filter === 'completed') {
                    if (isCompleted) {
                        items.push({ id: ev.id, date: instanceDate, text: ev.text, type: 'rec', sortDate: instanceDate, recId: ev.id, completed: true });
                    }
                } else {
                    if (!isCompleted && instanceDate >= today && instanceDate <= maxDate) {
                        items.push({ id: ev.id, date: instanceDate, text: ev.text, type: 'rec', sortDate: instanceDate, recId: ev.id, completed: false });
                    }
                }

                d.setMonth(d.getMonth() + 1);
            }
        }
    }

    // Sort
    if (filter === 'completed') {
        items.sort((a, b) => b.sortDate.localeCompare(a.sortDate)); // newest first
    } else {
        items.sort((a, b) => a.sortDate.localeCompare(b.sortDate)); // chronological
    }

    return items;
}

// ---- Render events list ----

function renderEventsList() {
    const list = evDom.list;
    list.innerHTML = '';
    eventsState.deleteConfirmId = null;
    eventsState.doneConfirmId = null;
    eventsState.undoConfirmId = null;

    const filter = FILTER_STATES[eventsState.filterIndex];
    evDom.btnFilter.textContent = FILTER_LABELS[filter];
    evDom.btnFilter.classList.remove('filter-oo', 'filter-rec', 'filter-completed');
    if (filter === 'oo') evDom.btnFilter.classList.add('filter-oo');
    if (filter === 'rec') evDom.btnFilter.classList.add('filter-rec');
    if (filter === 'completed') evDom.btnFilter.classList.add('filter-completed');
    evDom.btnExpand.classList.toggle('expanded', eventsState.expanded);
    evDom.btnExpand.textContent = eventsState.expanded ? 'see less' : 'see more';

    const items = getEventsList();
    const today = todayStr();

    const hasPast = filter !== 'completed' && items.some(i => i.sortDate < today);
    let pastDividerInserted = false;

    if (items.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'event-row';
        empty.style.justifyContent = 'center';
        empty.style.opacity = '0.3';
        empty.innerHTML = '<span class="event-row-text" style="text-align:center">No events</span>';
        list.appendChild(empty);
        return;
    }

    let lastWeek = null;

    for (const item of items) {
        // Insert "today" divider between past and future
        if (filter !== 'completed' && !pastDividerInserted && hasPast && item.sortDate >= today) {
            const divider = document.createElement('div');
            divider.className = 'events-divider';
            divider.innerHTML = '<span>upcoming</span>';
            list.appendChild(divider);
            pastDividerInserted = true;
            lastWeek = null; // reset week tracking after divider
        }

        // Weekly separator (Monday-based)
        // Calculate days since epoch Monday (1970-01-05 was a Monday)
        const [iy, im, id] = item.sortDate.split('-').map(Number);
        const itemMs = Date.UTC(iy, im - 1, id);
        const epochMonday = Date.UTC(1970, 0, 5); // first Monday of epoch
        const weekKey = Math.floor((itemMs - epochMonday) / 604800000);
        if (lastWeek !== null && weekKey !== lastWeek) {
            const sep = document.createElement('div');
            sep.className = 'events-week-sep';
            list.appendChild(sep);
        }
        lastWeek = weekKey;

        const row = document.createElement('div');
        row.className = `event-row type-${item.type}`;

        const dateSpan = document.createElement('span');
        dateSpan.className = 'event-row-date';
        dateSpan.textContent = formatDateShort(item.sortDate);

        const textSpan = document.createElement('span');
        textSpan.className = 'event-row-text';
        textSpan.textContent = item.text || '(no description)';

        const actions = document.createElement('div');
        actions.className = 'event-row-actions';

        if (filter === 'completed') {
            // Undo button
            const undoBtn = document.createElement('button');
            undoBtn.className = 'event-action-btn';
            undoBtn.textContent = 'undo';
            undoBtn.title = 'Undo';
            undoBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                handleUndo(item, undoBtn);
            });
            actions.appendChild(undoBtn);

            // Delete button
            const delBtn = document.createElement('button');
            delBtn.className = 'event-action-btn';
            delBtn.textContent = '\u2715';
            delBtn.title = 'Delete';
            delBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                handleDelete(item, delBtn);
            });
            actions.appendChild(delBtn);
        } else {
            // Done button (with double confirmation)
            const doneBtn = document.createElement('button');
            doneBtn.className = 'event-action-btn';
            doneBtn.textContent = '\u2713';
            doneBtn.title = 'Mark done';
            doneBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                handleDone(item, doneBtn);
            });
            actions.appendChild(doneBtn);

            // Delete button
            const delBtn = document.createElement('button');
            delBtn.className = 'event-action-btn';
            delBtn.textContent = '\u2715';
            delBtn.title = 'Delete';
            delBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                handleDelete(item, delBtn);
            });
            actions.appendChild(delBtn);
        }

        row.appendChild(dateSpan);
        row.appendChild(textSpan);
        row.appendChild(actions);

        // Tap row to see detail
        row.addEventListener('click', () => openDetailModal(item));

        list.appendChild(row);
    }
}

// ---- Event actions ----

function completeEvent(item) {
    if (item.type === 'oo') {
        const ev = eventsState.oneoff.find(e => e.id === item.id);
        if (ev) ev.completed = true;
    } else {
        const ev = eventsState.recurring.find(e => e.id === (item.recId || item.id));
        if (ev) {
            if (!ev.completed) ev.completed = [];
            if (!ev.completed.includes(item.date)) {
                ev.completed.push(item.date);
            }
        }
    }
    saveEvents();
    renderEventsList();
}

function undoComplete(item) {
    if (item.type === 'oo') {
        const ev = eventsState.oneoff.find(e => e.id === item.id);
        if (ev) ev.completed = false;
    } else {
        const ev = eventsState.recurring.find(e => e.id === (item.recId || item.id));
        if (ev && ev.completed) {
            ev.completed = ev.completed.filter(d => d !== item.date);
        }
    }
    saveEvents();
    renderEventsList();
}

function handleUndo(item, btn) {
    const confirmKey = 'undo-' + item.id + '-' + item.date;
    if (eventsState.undoConfirmId === confirmKey) {
        eventsState.undoConfirmId = null;
        undoComplete(item);
    } else {
        eventsState.undoConfirmId = confirmKey;
        btn.className = 'event-action-btn confirm-done';
        btn.textContent = 'Sure?';
        setTimeout(function() {
            if (eventsState.undoConfirmId === confirmKey) {
                eventsState.undoConfirmId = null;
                btn.className = 'event-action-btn';
                btn.textContent = '\u21A9';
            }
        }, 3000);
    }
}

function handleDone(item, btn) {
    const confirmKey = `${item.id}-${item.date}`;
    if (eventsState.doneConfirmId === confirmKey) {
        eventsState.doneConfirmId = null;
        completeEvent(item);
    } else {
        eventsState.doneConfirmId = confirmKey;
        btn.className = 'event-action-btn confirm-done';
        btn.textContent = 'Sure?';
        setTimeout(() => {
            if (eventsState.doneConfirmId === confirmKey) {
                eventsState.doneConfirmId = null;
                btn.className = 'event-action-btn';
                btn.textContent = '\u2713';
            }
        }, 3000);
    }
}

function handleDelete(item, btn) {
    const confirmKey = `${item.id}-${item.date}`;
    if (eventsState.deleteConfirmId === confirmKey) {
        // Second tap — delete
        if (item.type === 'oo') {
            eventsState.oneoff = eventsState.oneoff.filter(e => e.id !== item.id);
        } else {
            eventsState.recurring = eventsState.recurring.filter(e => e.id !== (item.recId || item.id));
        }
        eventsState.deleteConfirmId = null;
        saveEvents();
        renderEventsList();
    } else {
        // First tap — confirm
        eventsState.deleteConfirmId = confirmKey;
        btn.className = 'event-action-btn confirm-delete';
        btn.textContent = 'Sure?';
        // Reset after 3s
        setTimeout(() => {
            if (eventsState.deleteConfirmId === confirmKey) {
                eventsState.deleteConfirmId = null;
                btn.className = 'event-action-btn';
                btn.textContent = '\u2715';
            }
        }, 3000);
    }
}

// ---- Detail modal (reuses OO/REC modals for editing) ----

let editingEvent = null; // { type: 'oo'|'rec', id, recId? }

function openDetailModal(item) {
    if (item.type === 'oo') {
        editingEvent = { type: 'oo', id: item.id };
        populateOOModal();
        // Pre-fill with existing data
        const [y, m, d] = item.date.split('-').map(Number);
        evDom.ooYear.value = y;
        evDom.ooMonth.value = m;
        updateOODays();
        evDom.ooDay.value = d;
        evDom.ooText.value = item.text || '';
        evDom.ooOverlay.classList.remove('hidden');
        requestAnimationFrame(() => evDom.ooOverlay.classList.add('visible'));
    } else {
        editingEvent = { type: 'rec', id: item.recId || item.id };
        populateRECModal();
        const ev = eventsState.recurring.find(e => e.id === editingEvent.id);
        if (ev) {
            evDom.recDay.value = ev.day;
            evDom.recText.value = ev.text || '';
        }
        evDom.recOverlay.classList.remove('hidden');
        requestAnimationFrame(() => evDom.recOverlay.classList.add('visible'));
    }
}

// ---- OO Modal ----

function populateOOModal() {
    const now = new Date();
    const curYear = now.getFullYear();

    // Years: current and next
    evDom.ooYear.innerHTML = '';
    for (let y = curYear; y <= curYear + 1; y++) {
        const opt = document.createElement('option');
        opt.value = y;
        opt.textContent = y;
        evDom.ooYear.appendChild(opt);
    }

    // Months
    evDom.ooMonth.innerHTML = '';
    for (let m = 1; m <= 12; m++) {
        const opt = document.createElement('option');
        opt.value = m;
        opt.textContent = MONTHS_SHORT[m - 1];
        evDom.ooMonth.appendChild(opt);
    }

    // Set defaults to today
    evDom.ooYear.value = curYear;
    evDom.ooMonth.value = now.getMonth() + 1;
    updateOODays();
    evDom.ooDay.value = now.getDate();
    evDom.ooText.value = '';
}

function updateOODays() {
    const y = parseInt(evDom.ooYear.value);
    const m = parseInt(evDom.ooMonth.value);
    const max = daysInMonthNum(y, m);
    const prev = parseInt(evDom.ooDay.value) || 1;

    evDom.ooDay.innerHTML = '';
    for (let d = 1; d <= max; d++) {
        const opt = document.createElement('option');
        opt.value = d;
        opt.textContent = d;
        evDom.ooDay.appendChild(opt);
    }
    evDom.ooDay.value = Math.min(prev, max);
}

function openOOModal() {
    editingEvent = null;
    populateOOModal();
    evDom.ooOverlay.classList.remove('hidden');
    requestAnimationFrame(() => evDom.ooOverlay.classList.add('visible'));
}

function closeOOModal() {
    evDom.ooOverlay.classList.remove('visible');
    setTimeout(() => evDom.ooOverlay.classList.add('hidden'), 250);
    editingEvent = null;
}

function saveOO() {
    const y = evDom.ooYear.value;
    const m = String(evDom.ooMonth.value).padStart(2, '0');
    const d = String(evDom.ooDay.value).padStart(2, '0');
    const date = `${y}-${m}-${d}`;
    const text = evDom.ooText.value.trim();

    if (editingEvent && editingEvent.type === 'oo') {
        const ev = eventsState.oneoff.find(e => e.id === editingEvent.id);
        if (ev) {
            ev.date = date;
            ev.text = text;
        }
        editingEvent = null;
    } else {
        eventsState.oneoff.push({
            id: generateId(),
            date,
            text,
            completed: false,
        });
    }

    saveEvents();
    closeOOModal();
    renderEventsList();
}

// ---- REC Modal ----

function populateRECModal() {
    evDom.recDay.innerHTML = '';
    for (let d = 1; d <= 31; d++) {
        const opt = document.createElement('option');
        opt.value = d;
        opt.textContent = d;
        evDom.recDay.appendChild(opt);
    }
    evDom.recDay.value = 1;
    evDom.recText.value = '';
}

function openRECModal() {
    editingEvent = null;
    populateRECModal();
    evDom.recOverlay.classList.remove('hidden');
    requestAnimationFrame(() => evDom.recOverlay.classList.add('visible'));
}

function closeRECModal() {
    evDom.recOverlay.classList.remove('visible');
    setTimeout(() => evDom.recOverlay.classList.add('hidden'), 250);
    editingEvent = null;
}

function saveREC() {
    const day = parseInt(evDom.recDay.value);
    const text = evDom.recText.value.trim();

    if (editingEvent && editingEvent.type === 'rec') {
        const ev = eventsState.recurring.find(e => e.id === editingEvent.id);
        if (ev) {
            ev.day = day;
            ev.text = text;
        }
        editingEvent = null;
    } else {
        eventsState.recurring.push({
            id: generateId(),
            day,
            text,
            completed: [],
        });
    }

    saveEvents();
    closeRECModal();
    renderEventsList();
}

// ---- Events event listeners ----

function initEventsListeners() {
    evDom.btnAddOO.addEventListener('click', openOOModal);
    evDom.btnAddRec.addEventListener('click', openRECModal);

    // Expand/collapse calendar
    const btnExpandEvents = document.getElementById('btn-expand-events');
    btnExpandEvents.addEventListener('click', () => {
        const app = document.getElementById('app');
        const collapsed = app.classList.toggle('calendar-collapsed');
        btnExpandEvents.textContent = collapsed ? 'collapse' : 'expand';
    });

    evDom.btnFilter.addEventListener('click', () => {
        eventsState.filterIndex = (eventsState.filterIndex + 1) % FILTER_STATES.length;
        renderEventsList();
    });

    evDom.btnExpand.addEventListener('click', () => {
        eventsState.expanded = !eventsState.expanded;
        renderEventsList();
    });

    // OO modal
    evDom.ooYear.addEventListener('change', updateOODays);
    evDom.ooMonth.addEventListener('change', updateOODays);
    evDom.ooSave.addEventListener('click', saveOO);
    evDom.ooCancel.addEventListener('click', closeOOModal);
    evDom.ooOverlay.addEventListener('click', (e) => { if (e.target === evDom.ooOverlay) closeOOModal(); });

    // REC modal
    evDom.recSave.addEventListener('click', saveREC);
    evDom.recCancel.addEventListener('click', closeRECModal);
    evDom.recOverlay.addEventListener('click', (e) => { if (e.target === evDom.recOverlay) closeRECModal(); });

    // Detail modal is no longer used — events open in OO/REC modals for editing
}

// Start the app
init();
loadEvents();
initEventsListeners();
renderEventsList();
