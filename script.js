// 고정된 기본 NEIS API 키(여기에 본인 키를 넣으세요).
// 보안상 파일에 하드코딩하는 것은 권장하지 않지만, 요청하셔서 기본값으로 사용하도록 설정합니다.
const OPENAPI_KEY = '7c7578d165144d6d91b83484497faaee';

let currentOffice = 'E10';
let currentSchool = '7331058';
let schoolsData = [];
function formatTodayYmd() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return '' + yyyy + mm + dd;
}

function setLoadingState() {
    document.getElementById('breakfast').textContent = '로딩...';
    document.getElementById('lunch').textContent = '로딩...';
    document.getElementById('dinner').textContent = '로딩...';
}

function stripTags(s) {
    return s.replace(/<br\/?\s*>/gi, '\n');
}

function showMealsFromCached(data) {
    const b = (data.breakfast && data.breakfast.ddishNm) ? stripTags(data.breakfast.ddishNm) : '급식 미제공';
    const l = (data.lunch && data.lunch.ddishNm) ? stripTags(data.lunch.ddishNm) : '급식 미제공';
    const dnr = (data.dinner && data.dinner.ddishNm) ? stripTags(data.dinner.ddishNm) : '급식 미제공';
    document.getElementById('breakfast').textContent = b;
    document.getElementById('lunch').textContent = l;
    document.getElementById('dinner').textContent = dnr;
}

function showError(msg) {
    document.getElementById('breakfast').textContent = msg;
    document.getElementById('lunch').textContent = msg;
    document.getElementById('dinner').textContent = msg;
}

async function loadForDate(ymd, office, school) {
    const file = `DB/${ymd}.txt`;
    setLoadingState();
    try {
        const res = await fetch(file, { cache: 'no-store' });
        if (!res.ok) throw new Error('파일을 찾을 수 없음');
        const data = await res.json();
        showMealsFromCached(data);
    } catch (e) {
        showError('정적 캐시 파일을 불러오지 못했습니다. ' + e.message);
    }
}

async function fetchFromNeis(office, school, ymd) {
    setLoadingState();
    // 단순화: 파일 상수 `OPENAPI_KEY`를 기본으로 사용
    const apiKey = OPENAPI_KEY || '';
    if (!apiKey) {
        showError('NEIS API 키가 설정되어 있지 않습니다. index_static.html의 OPENAPI_KEY 상수에 키를 넣어주세요.');
        return;
    }
    const url = `https://open.neis.go.kr/hub/mealServiceDietInfo?KEY=${encodeURIComponent(apiKey)}&Type=json&pIndex=1&pSize=100&ATPT_OFCDC_SC_CODE=${encodeURIComponent(office)}&SD_SCHUL_CODE=${encodeURIComponent(school)}&MLSV_YMD=${encodeURIComponent(ymd)}`;
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error('네트워크 응답 실패: ' + res.status);
        const json = await res.json();
        if (json.mealServiceDietInfo && json.mealServiceDietInfo[1] && json.mealServiceDietInfo[1].row) {
            const rows = json.mealServiceDietInfo[1].row;
            const meals = { breakfast: '', lunch: '', dinner: '' };
            rows.forEach(r => {
                const mName = (r.MMEAL_SC_NM || '') + '';
                const mCode = (r.MMEAL_SC_CODE || '') + '';
                const dd = (r.DDISH_NM || '').replace(/\([^)]+\)/g, '').replace(/<br\/?\s*>/gi, '\n').trim();
                // 판단 우선순위: 코드(MMEAL_SC_CODE) -> 이름(MMEAL_SC_NM) 체크
                if (mCode === '1' || /조식|조\s*식|breakfast/i.test(mName) || /(^|\b)조/i.test(mName)) {
                    meals.breakfast = meals.breakfast ? (meals.breakfast + '\n' + dd) : dd;
                } else if (mCode === '2' || /중식|중\s*식|lunch/i.test(mName) || /(^|\b)중/i.test(mName)) {
                    meals.lunch = meals.lunch ? (meals.lunch + '\n' + dd) : dd;
                } else if (mCode === '3' || /석식|석\s*식|dinner/i.test(mName) || /(^|\b)석/i.test(mName)) {
                    meals.dinner = meals.dinner ? (meals.dinner + '\n' + dd) : dd;
                } else {
                    // 알 수 없는 식사 구분은 중식으로 밀어넣기(보수적으로)
                    meals.lunch = meals.lunch ? (meals.lunch + '\n' + dd) : dd;
                }
            });
            document.getElementById('breakfast').textContent = meals.breakfast || '급식 미제공';
            document.getElementById('lunch').textContent = meals.lunch || '급식 미제공';
            document.getElementById('dinner').textContent = meals.dinner || '급식 미제공';
        } else {
            showError('API 응답에 데이터가 없습니다.');
        }
    } catch (err) {
        showError('NEIS API 호출에 실패했습니다: ' + err.message + '\n\n대체 방법: "API 응답 붙여넣기"나 JSON 파일 업로드를 사용하세요.');
    }
}

async function searchSchools(query) {
    const resultsDiv = document.getElementById('searchResults');
    resultsDiv.innerHTML = '';
    resultsDiv.style.display = 'none'; // Hide by default

    if (!query || query.length < 1) return;
    const q = query.toLowerCase();

    // 1) 로컬 데이터에서 검색 (offline)
    const localMatches = (schoolsData || []).filter(s => (s.name || '').toLowerCase().includes(q)).slice(0, 20);
    if (localMatches.length > 0) {
        resultsDiv.style.display = 'block';
        localMatches.slice(0, 10).forEach(r => {
            const div = document.createElement('div');
            div.textContent = `${r.name}  ·  ${r.office || ''}`;
            div.title = `${r.name} · ${r.office} / ${r.code}`;
            div.onclick = () => {
                currentOffice = r.office || currentOffice;
                currentSchool = r.code || currentSchool;
                document.getElementById('selectedSchool').textContent = `선택됨: ${r.name}`;
                resultsDiv.innerHTML = '';
                resultsDiv.style.display = 'none';
                document.getElementById('schoolSearch').value = '';
            };
            resultsDiv.appendChild(div);
        });
        // show a small note
        const note = document.createElement('div');
        note.style.padding = '6px';
        note.style.fontSize = '12px';
        note.style.color = 'var(--muted)';
        note.textContent = '오프라인 결과입니다.';
        resultsDiv.appendChild(note);
        return;
    }

    // 2) 로컬에 없으면 온라인 검색 시도 (NEIS). 기본 키는 `OPENAPI_KEY` 사용
    const apiKey = OPENAPI_KEY || '';
    if (!apiKey) {
        resultsDiv.style.display = 'block';
        resultsDiv.innerHTML = '<div style="padding:8px">오프라인에 없습니다. `index_static.html`의 OPENAPI_KEY에 키를 넣어주세요.</div>';
        return;
    }
    const onlineDiv = document.createElement('div');
    onlineDiv.style.padding = '8px';
    onlineDiv.textContent = '온라인에서 검색 중...';
    resultsDiv.style.display = 'block';
    resultsDiv.appendChild(onlineDiv);
    try {
        const online = await fetchOnlineSchools(query, apiKey);
        resultsDiv.innerHTML = '';
        if (!online || online.length === 0) {
            resultsDiv.innerHTML = '<div style="padding:8px">온라인 검색 결과 없음</div>';
            return;
        }
        online.slice(0, 10).forEach(r => {
            const div = document.createElement('div');
            div.textContent = `${r.name}  ·  ${r.office || ''}`;
            div.onclick = () => {
                currentOffice = r.office || currentOffice;
                currentSchool = r.code || currentSchool;
                document.getElementById('selectedSchool').textContent = `선택됨: ${r.name} (온라인)`;
                resultsDiv.innerHTML = '';
                resultsDiv.style.display = 'none';
                document.getElementById('schoolSearch').value = '';
            };
            resultsDiv.appendChild(div);
        });
        const note2 = document.createElement('div');
        note2.style.padding = '6px';
        note2.style.fontSize = '12px';
        note2.style.color = 'var(--muted)';
        note2.textContent = '온라인 결과입니다. (로컬 캐시에 저장됨)';
        resultsDiv.appendChild(note2);
    } catch (err) {
        resultsDiv.innerHTML = `<div style="padding:8px">온라인 검색 실패: ${err.message}</div>`;
    }
}

// 온라인으로 NEIS `schoolInfo` 호출
async function fetchOnlineSchools(query, apiKey) {
    const url = `https://open.neis.go.kr/hub/schoolInfo?KEY=${encodeURIComponent(apiKey)}&Type=json&pIndex=1&pSize=100&SCHUL_NM=${encodeURIComponent(query)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('네트워크 응답 실패 ' + res.status);
    const j = await res.json();
    if (!j.schoolInfo || !j.schoolInfo[1] || !j.schoolInfo[1].row) return [];
    const rows = j.schoolInfo[1].row;
    const mapped = rows.map(r => ({
        name: r.SCHUL_NM || '',
        office: r.ATPT_OFCDC_SC_CODE || '',
        code: r.SD_SCHUL_CODE || '',
        type: r.SCHUL_CRSE_SC_NM || '',
        region: r.LCTN_SC_NM || ''
    }));
    // 병합해서 localStorage에 저장
    mergeIntoLocalCache(mapped);
    return mapped;
}

function mergeIntoLocalCache(items) {
    if (!items || items.length === 0) return;
    const raw = localStorage.getItem('schools_cache');
    let c = [];
    try { c = raw ? JSON.parse(raw) : []; } catch (e) { c = []; }
    const byKey = {};
    c.concat(schoolsData || []).forEach(s => { if (s && s.name) byKey[`${s.name}||${s.code}`] = s; });
    items.forEach(i => { byKey[`${i.name}||${i.code}`] = i; });
    const merged = Object.keys(byKey).map(k => byKey[k]);
    localStorage.setItem('schools_cache', JSON.stringify(merged));
    // 메모리도 업데이트
    schoolsData = merged.slice();
}

function exportLocalSchools() {
    const raw = localStorage.getItem('schools_cache');
    const merged = (raw ? JSON.parse(raw) : []).concat(schoolsData || []);
    // dedupe by name+code
    const byKey = {};
    merged.forEach(s => { if (s && s.name) byKey[`${s.name}||${s.code}`] = s; });
    const out = JSON.stringify(Object.values(byKey), null, 2);
    const blob = new Blob([out], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'schools.merged.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

function handleFileInput(file) {
    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const data = JSON.parse(e.target.result);
            showMealsFromCached(data);
        } catch (err) {
            showError('파일 파싱 실패: ' + err.message);
        }
    };
    reader.readAsText(file);
}

function openPasteDialog() {
    const txt = prompt('NEIS API 응답(JSON 또는 XML)을 붙여넣으세요. 긴 텍스트는 에디터에서 복사해 붙여넣으세요.');
    if (!txt) return;
    try {
        const j = JSON.parse(txt);
        if (j.mealServiceDietInfo) {
            const rows = j.mealServiceDietInfo[1] && j.mealServiceDietInfo[1].row ? j.mealServiceDietInfo[1].row : [];
            const meals = { breakfast: '', lunch: '', dinner: '' };
            rows.forEach(r => {
                const mName = (r.MMEAL_SC_NM || '') + '';
                const mCode = (r.MMEAL_SC_CODE || '') + '';
                const dd = (r.DDISH_NM || '').replace(/\([^)]+\)/g, '').replace(/<br\/?\s*>/gi, '\n').trim();
                if (mCode === '1' || /조식|조\s*식|breakfast/i.test(mName) || /(^|\b)조/i.test(mName)) {
                    meals.breakfast = meals.breakfast ? (meals.breakfast + '\n' + dd) : dd;
                } else if (mCode === '2' || /중식|중\s*식|lunch/i.test(mName) || /(^|\b)중/i.test(mName)) {
                    meals.lunch = meals.lunch ? (meals.lunch + '\n' + dd) : dd;
                } else if (mCode === '3' || /석식|석\s*식|dinner/i.test(mName) || /(^|\b)석/i.test(mName)) {
                    meals.dinner = meals.dinner ? (meals.dinner + '\n' + dd) : dd;
                } else {
                    meals.lunch = meals.lunch ? (meals.lunch + '\n' + dd) : dd;
                }
            });
            document.getElementById('breakfast').textContent = meals.breakfast || '급식 미제공';
            document.getElementById('lunch').textContent = meals.lunch || '급식 미제공';
            document.getElementById('dinner').textContent = meals.dinner || '급식 미제공';
            return;
        }
    } catch (e) {/* not json */ }
    try {
        const parser = new DOMParser();
        const xml = parser.parseFromString(txt, 'application/xml');
        const rows = xml.getElementsByTagName('row');
        const meals = { breakfast: '', lunch: '', dinner: '' };
        for (let i = 0; i < rows.length; i++) {
            const r = rows[i];
            const m = r.getElementsByTagName('MMEAL_SC_NM')[0] && r.getElementsByTagName('MMEAL_SC_NM')[0].textContent ? r.getElementsByTagName('MMEAL_SC_NM')[0].textContent : '';
            const dd = r.getElementsByTagName('DDISH_NM')[0] && r.getElementsByTagName('DDISH_NM')[0].textContent ? r.getElementsByTagName('DDISH_NM')[0].textContent.replace(/\([^)]+\)/g, '').replace(/<br\/?\s*>/gi, '\n') : '';
            if (m.indexOf('조식') !== -1) meals.breakfast = dd;
            else if (m.indexOf('중식') !== -1) meals.lunch = dd;
            else if (m.indexOf('석식') !== -1) meals.dinner = dd;
        }
        document.getElementById('breakfast').textContent = meals.breakfast || '급식 미제공';
        document.getElementById('lunch').textContent = meals.lunch || '급식 미제공';
        document.getElementById('dinner').textContent = meals.dinner || '급식 미제공';
        return;
    } catch (e) {
        showError('붙여넣기한 내용을 해석하지 못했습니다.');
    }
}

document.getElementById('loadBtn').addEventListener('click', () => {
    const val = document.getElementById('date').value.trim();
    if (!/^[0-9]{8}$/.test(val)) { alert('YYYYMMDD 형식의 날짜를 입력하세요. 예: 20251125'); return; }
    loadForDate(val, currentOffice, currentSchool);
});

document.getElementById('fetchApiBtn').addEventListener('click', () => {
    const val = document.getElementById('date').value.trim();
    if (!/^[0-9]{8}$/.test(val)) { alert('YYYYMMDD 형식의 날짜를 입력하세요.'); return; }
    fetchFromNeis(currentOffice, currentSchool, val);
});

// 개발자 모드: 직접 입력
document.getElementById('loadBtnDev').addEventListener('click', () => {
    const val = document.getElementById('dateDevMode').value.trim();
    if (!/^[0-9]{8}$/.test(val)) { alert('YYYYMMDD 형식의 날짜를 입력하세요. 예: 20251125'); return; }
    loadForDate(val, document.getElementById('office').value, document.getElementById('school').value);
});

document.getElementById('fetchApiBtnDev').addEventListener('click', () => {
    const val = document.getElementById('dateDevMode').value.trim();
    const office = document.getElementById('office').value.trim();
    const school = document.getElementById('school').value.trim();
    if (!/^[0-9]{8}$/.test(val)) { alert('YYYYMMDD 형식의 날짜를 입력하세요.'); return; }
    if (!office || !school) { alert('교육청 코드와 학교 코드를 입력하세요.'); return; }
    fetchFromNeis(office, school, val);
});

// 개발자 모드 토글
document.getElementById('devModeBtn').addEventListener('click', () => {
    const devModeDiv = document.getElementById('devMode');
    const normalModeDiv = document.getElementById('normalMode');
    devModeDiv.classList.toggle('active');
    if (devModeDiv.classList.contains('active')) {
        normalModeDiv.style.display = 'none';
    } else {
        normalModeDiv.style.display = 'block';
    }
});

// Debounce utility
function debounce(func, wait) {
    let timeout;
    return function (...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}

// 일반 모드: 학교 검색 (Debounce 적용: 500ms)
document.getElementById('schoolSearch').addEventListener('input', debounce((e) => {
    searchSchools(e.target.value);
}, 500));

document.getElementById('fileInput').addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    handleFileInput(f);
});

document.getElementById('pasteBtn').addEventListener('click', () => {
    openPasteDialog();
});

// 페이지 로드 시 기본값: 오늘
const today = formatTodayYmd();
document.getElementById('date').value = today;
document.getElementById('dateDevMode').value = today;

// 학교 데이터 로드
async function initSchools() {
    // 1) 기본 파일에서 로드 시도
    try {
        const res = await fetch('schools.json');
        if (res.ok) {
            const base = await res.json();
            if (Array.isArray(base) && base.length > 0) schoolsData = base.slice();
        }
    } catch (e) {
        console.log('기본 schools.json 로드 실패:', e.message);
    }

    // 2) localStorage 캐시 병합
    try {
        const raw = localStorage.getItem('schools_cache');
        if (raw) {
            const cached = JSON.parse(raw);
            if (Array.isArray(cached) && cached.length > 0) {
                // merge dedupe
                const byKey = {};
                (schoolsData || []).concat(cached).forEach(s => { if (s && s.name) byKey[`${s.name}||${s.code}`] = s; });
                schoolsData = Object.keys(byKey).map(k => byKey[k]);
            }
        }
    } catch (e) { console.log('local cache load failed', e.message); }

    // (더 이상 NEIS 키 입력란이 없습니다.)
    // export 버튼 제거되어 있으므로 내보내기 바인딩을 생략합니다.

    loadForDate(today, currentOffice, currentSchool);
}
initSchools();
