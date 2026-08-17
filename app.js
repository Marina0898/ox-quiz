(function () {
  "use strict";

  const WRONG_KEY = "oxquiz-wrong";
  const BOOKMARK_KEY = "oxquiz-bookmarks";
  const MOCK_WRONG_KEY = "oxquiz-mock-wrong";
  const MOCK_BOOKMARK_KEY = "oxquiz-mock-bookmarks";
  const SESSIONS_KEY = "oxquiz-sessions"; // { [setKey]: session }
  const SUBJECT_LABELS = {
    1: "1과목 · 금융상품 및 세제",
    2: "2과목 · 투자운용 및 전략",
    3: "3과목 · 직무윤리 및 법규",
  };
  const MOCK_EXAM_COUNTS = { 1: 9, 2: 9, 3: 22 }; // 40문항, 문제은행 비중에 비례 배분

  // 고빈출/핵심 개념으로 판단한 섹션(주관적 가중치) — 모의고사 출제 시 우선순위를 준다
  const PRIORITY_TOPICS = new Set([
    "금융상품",
    "리스크관리",
    "자본시장 관련 법규",
    "채권투자운용/투자전략",
    "파생상품투자운용/투자전략",
    "분산투자기법",
    "투자분석기법",
    "직무윤리",
  ]);

  // 구체적 금융/법규 용어 사전 — 문항을 "하나의 개념" 단위로 묶기 위한 태그.
  // topic(섹션)만으로는 너무 뭉뚱그려지므로, 실제 용어가 겹치는 문항끼리만 오답 선지로 쓴다.
  const CONCEPT_TERMS = [
    "ISA", "MMF", "ELS", "ELW", "ABS", "MBS", "CDO", "CDS", "CLN", "TRS", "VaR", "CAPM", "WACC", "EVA",
    "PER", "PBR", "ROE", "듀레이션", "볼록성", "준법감시인", "순자본비율", "리츠", "REITs", "신용공여",
    "환매", "수익자총회", "집합투자재산", "투자일임", "투자신탁", "신탁업자", "기준가격", "증권거래세",
    "양도소득세", "상속세", "증여세", "제척기간", "원천징수", "개인투자용국채", "퇴직연금", "확정급여",
    "확정기여", "IRP", "랩어카운트", "자산유동화증권", "수의상환", "전환사채", "교환사채", "신주인수권부사채",
    "패리티", "유로채", "외국채", "양키본드", "판다본드", "사무라이본드", "딤섬본드", "GDR", "ADR", "EDR",
    "MSCI", "헤지펀드", "사모펀드", "PEF", "합병차익거래", "산업연관표", "허핀달", "HHI", "산업정책",
    "다우이론", "엘리어트", "캔들", "이동평균", "스토캐스틱", "RSI", "VR", "OBV", "MAO", "토빈", "신용리스크",
    "KMV", "부도", "헥셔올린", "리카르도", "제품수명주기", "내부통제위원회", "금융소비자보호", "적합성",
    "적정성", "재산상이익", "투자광고", "투자설명서", "증권신고서", "공개매수", "의결권대리행사", "간주모집",
    "자산건전성", "경영실태평가", "대주주", "투자매매업", "투자중개업", "투자자문업", "투자일임업",
    "집합투자업", "자기계약", "환매조건부", "일반사무관리회사", "한국금융투자협회", "배타적사용권", "조사분석",
    "신상품", "효율적시장가설", "전략적자산배분", "전술적자산배분", "GARCH", "ESG", "인덱스펀드",
    "포트폴리오보험", "CPPI", "저PER", "고배당", "벤치마크", "증권시장선", "자본시장선", "증권특성선",
    "SML", "CML", "SCL", "분산투자", "상관계수", "베타", "무차별곡선", "포뮬러플랜", "샤프비율", "트레이너",
    "젠센", "정보비율", "소티노", "GIPS", "금액가중수익률", "시간가중수익률", "스트래들", "콜옵션", "풋옵션",
    "델타", "감마", "베가", "쎄타", "로우", "블랙숄즈", "선물", "베이시스", "콘탱고", "백워데이션",
    "수익률곡선타기", "면역전략", "채권교체", "시장분할이론", "유동성프리미엄", "불편기대이론", "유동성함정",
    "피구효과", "리카르도불변정리", "BSI", "DI", "경기종합지수", "GDP", "GNI", "환율", "코넥스", "부도거리",
    "기대손실", "컨버전", "최소분산포트폴리오", "효율적포트폴리오", "효율적투자기회선", "위험회피", "지배원리",
    "포트폴리오업그레이딩", "리밸런싱",
  ];

  const byId = Object.fromEntries(QUESTIONS.map((q) => [q.id, q]));
  const byIdMock = Object.fromEntries(MOCK_QUESTIONS.map((q) => [q.id, q]));
  const ALL_QUESTIONS = QUESTIONS.concat(MOCK_QUESTIONS);
  const byIdAll = Object.fromEntries(ALL_QUESTIONS.map((q) => [q.id, q]));

  const views = {
    home: document.getElementById("view-home"),
    quiz: document.getElementById("view-quiz"),
    mock: document.getElementById("view-mock"),
    result: document.getElementById("view-result"),
  };

  // session shapes:
  //   ox:  { key, label, mode: 'ox', pool: 'main'|'mock'|'all', queueIds: [ids], index, correct, wrong: [ids] }
  //   mcq: { key, label, mode: 'mcq', items: [{ qid, choices: [str x5], correctIndex }], index, correct, wrong: [ids] }
  // pool decides which byId map + wrong/bookmark storage a queueIds-based ('ox') session uses.
  // 'all' (개념별 모아보기처럼 두 풀이 섞인 세션)은 문항마다 원래 출처의 저장소에 기록한다.
  let session = null;

  function showView(name) {
    Object.entries(views).forEach(([key, el]) => (el.hidden = key !== name));
  }

  function sessionLength(s) {
    return s.mode === "mcq" ? s.items.length : s.queueIds.length;
  }

  function readIds(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }
  function writeIds(key, ids) {
    localStorage.setItem(key, JSON.stringify(Array.from(new Set(ids))));
  }

  // 문항 id가 어느 풀 소속인지에 따라 오답/저장 기록을 쓸 storage key를 고른다.
  function wrongKeyFor(id) { return byId[id] ? WRONG_KEY : MOCK_WRONG_KEY; }
  function bookmarkKeyFor(id) { return byId[id] ? BOOKMARK_KEY : MOCK_BOOKMARK_KEY; }

  function getWrongIds(key) { return readIds(key || WRONG_KEY); }
  function setWrongIds(ids, key) { writeIds(key || WRONG_KEY, ids); }
  function markWrong(id) {
    const key = wrongKeyFor(id);
    const ids = getWrongIds(key);
    if (!ids.includes(id)) ids.push(id);
    setWrongIds(ids, key);
  }
  function markCorrect(id) {
    const key = wrongKeyFor(id);
    setWrongIds(getWrongIds(key).filter((x) => x !== id), key);
  }

  function getBookmarks(key) { return readIds(key || BOOKMARK_KEY); }
  function setBookmarks(ids, key) { writeIds(key || BOOKMARK_KEY, ids); }
  function isBookmarked(id) { return getBookmarks(bookmarkKeyFor(id)).includes(id); }
  function toggleBookmark(id) {
    const key = bookmarkKeyFor(id);
    const ids = getBookmarks(key);
    const idx = ids.indexOf(id);
    if (idx === -1) ids.push(id); else ids.splice(idx, 1);
    setBookmarks(ids, key);
    return ids.includes(id);
  }

  function subjectWrongIds(subject) {
    return getWrongIds(WRONG_KEY).filter((id) => byId[id] && byId[id].subject === subject);
  }
  function subjectBookmarkIds(subject) {
    return getBookmarks(BOOKMARK_KEY).filter((id) => byId[id] && byId[id].subject === subject);
  }
  function mockWrongIds() {
    return getWrongIds(MOCK_WRONG_KEY).filter((id) => Object.prototype.hasOwnProperty.call(byIdMock, id));
  }
  function mockBookmarkIds() {
    return getBookmarks(MOCK_BOOKMARK_KEY).filter((id) => Object.prototype.hasOwnProperty.call(byIdMock, id));
  }

  // ---- multi-slot session persistence: one saved session per set ----
  function loadAllSessions() {
    try {
      const raw = localStorage.getItem(SESSIONS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }
  function saveActiveSession() {
    if (!session) return;
    const all = loadAllSessions();
    all[session.key] = session;
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(all));
  }
  function clearSession(key) {
    const all = loadAllSessions();
    delete all[key];
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(all));
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // ==================== HOME ====================

  function renderHome() {
    const list = document.getElementById("home-subject-list");
    list.innerHTML = "";

    [1, 2, 3].forEach((subject) => {
      const label = SUBJECT_LABELS[subject].split(" · ")[0];
      const count = QUESTIONS.filter((q) => q.subject === subject).length;
      const wrongIds = subjectWrongIds(subject);
      const bookmarkIds = subjectBookmarkIds(subject);

      const group = document.createElement("div");
      group.className = "subject-group";

      const mainBtn = document.createElement("button");
      mainBtn.className = "card";
      mainBtn.innerHTML = `<span class="card-title">${SUBJECT_LABELS[subject]}</span><span class="card-sub">${count}문제</span>`;
      mainBtn.addEventListener("click", () => {
        startOxSession(`subject-${subject}`, QUESTIONS.filter((q) => q.subject === subject), label);
      });
      group.appendChild(mainBtn);

      if (wrongIds.length > 0 || bookmarkIds.length > 0) {
        const row = document.createElement("div");
        row.className = "subject-secondary";

        if (wrongIds.length > 0) {
          const wrongBtn = document.createElement("button");
          wrongBtn.className = "subject-secondary-btn";
          wrongBtn.textContent = `오답 재도전 (${wrongIds.length})`;
          wrongBtn.addEventListener("click", () => {
            startOxSession(`wrong-retry-${subject}`, wrongIds.map((id) => byId[id]), `${label} · 오답 재도전`);
          });
          row.appendChild(wrongBtn);
        }

        if (bookmarkIds.length > 0) {
          const bookmarkBtn = document.createElement("button");
          bookmarkBtn.className = "subject-secondary-btn";
          bookmarkBtn.textContent = `⭐ 저장 (${bookmarkIds.length})`;
          bookmarkBtn.addEventListener("click", () => {
            startOxSession(`bookmarks-${subject}`, bookmarkIds.map((id) => byId[id]), `${label} · 저장한 문제`);
          });
          row.appendChild(bookmarkBtn);
        }

        group.appendChild(row);
      }

      list.appendChild(group);
    });

    renderRealExamCard();
    renderResumeList();
  }

  function renderRealExamCard() {
    document.getElementById("real-exam-count").textContent = `${MOCK_QUESTIONS.length}문제 · 과목 순서대로`;

    const wrongIds = mockWrongIds();
    const bookmarkIds = mockBookmarkIds();
    const row = document.getElementById("real-exam-secondary");
    row.innerHTML = "";
    row.hidden = wrongIds.length === 0 && bookmarkIds.length === 0;

    if (wrongIds.length > 0) {
      const wrongBtn = document.createElement("button");
      wrongBtn.className = "subject-secondary-btn";
      wrongBtn.textContent = `오답 재도전 (${wrongIds.length})`;
      wrongBtn.addEventListener("click", () => {
        startOxSession("real-exam-wrong-retry", wrongIds.map((id) => byIdMock[id]), "실전 기출문제 · 오답 재도전");
      });
      row.appendChild(wrongBtn);
    }

    if (bookmarkIds.length > 0) {
      const bookmarkBtn = document.createElement("button");
      bookmarkBtn.className = "subject-secondary-btn";
      bookmarkBtn.textContent = `⭐ 저장 (${bookmarkIds.length})`;
      bookmarkBtn.addEventListener("click", () => {
        startOxSession("real-exam-bookmarks", bookmarkIds.map((id) => byIdMock[id]), "실전 기출문제 · 저장한 문제");
      });
      row.appendChild(bookmarkBtn);
    }
  }

  function renderResumeList() {
    const section = document.getElementById("resume-section");
    const list = document.getElementById("resume-list");
    const all = loadAllSessions();
    const entries = Object.entries(all).filter(([, s]) => s && s.index < sessionLength(s));

    if (entries.length === 0) {
      section.hidden = true;
      list.innerHTML = "";
      return;
    }

    section.hidden = false;
    list.innerHTML = "";
    entries.forEach(([key, saved]) => {
      const row = document.createElement("div");
      row.className = "resume-row";
      row.innerHTML = `
        <div class="resume-row-info">
          <div class="resume-row-label">${saved.label}</div>
          <div class="resume-row-progress">${saved.index + 1} / ${sessionLength(saved)}</div>
        </div>
        <button class="resume-row-resume">이어하기</button>
        <button class="resume-row-discard" aria-label="삭제">✕</button>
      `;
      row.querySelector(".resume-row-resume").addEventListener("click", () => resumeSession(key));
      row.querySelector(".resume-row-discard").addEventListener("click", () => {
        clearSession(key);
        renderResumeList();
      });
      list.appendChild(row);
    });
  }

  function resumeSession(key) {
    const all = loadAllSessions();
    const saved = all[key];
    if (!saved) return;
    session = saved;
    if (session.mode === "mcq") {
      showView("mock");
      renderMockQuestion();
    } else {
      showView("quiz");
      renderQuestion();
    }
  }

  function goHome() {
    showView("home");
    renderHome();
  }

  // ==================== OX QUIZ ====================

  function startOxSession(key, questions, label, options) {
    const opts = options || {};
    const ordered = opts.shuffle === false ? questions : shuffle(questions);
    session = {
      key,
      label,
      mode: "ox",
      queueIds: ordered.map((q) => q.id),
      index: 0,
      correct: 0,
      wrong: [],
    };
    saveActiveSession();
    showView("quiz");
    renderQuestion();
  }

  function currentQuestion() {
    return byIdAll[session.queueIds[session.index]];
  }

  function renderQuestion() {
    const q = currentQuestion();
    document.getElementById("quiz-topic").textContent = `${session.label} · ${q.topic}`;
    document.getElementById("quiz-statement").textContent = q.statement;
    document.getElementById("progress-label").textContent = `${session.index + 1} / ${session.queueIds.length}`;
    document.getElementById("progress-fill").style.width = `${(session.index / session.queueIds.length) * 100}%`;

    const bookmarkBtn = document.getElementById("btn-bookmark-toggle");
    bookmarkBtn.textContent = isBookmarked(q.id) ? "★" : "☆";
    bookmarkBtn.classList.toggle("active", isBookmarked(q.id));

    document.getElementById("feedback").hidden = true;

    document.querySelectorAll(".ox-btn").forEach((btn) => {
      btn.disabled = false;
      btn.classList.remove("selected");
    });
  }

  function handleAnswer(userValue) {
    const q = currentQuestion();
    const correct = userValue === q.answer;

    document.querySelectorAll(".ox-btn").forEach((btn) => {
      btn.disabled = true;
      if ((btn.dataset.value === "true") === userValue) btn.classList.add("selected");
    });

    if (correct) {
      session.correct += 1;
      markCorrect(q.id);
    } else {
      session.wrong.push(q.id);
      markWrong(q.id);
    }
    saveActiveSession();

    const banner = document.getElementById("feedback-banner");
    banner.textContent = correct ? "정답이에요" : `오답 — 정답은 ${q.answer ? "O" : "X"}`;
    banner.className = `feedback-banner ${correct ? "correct" : "wrong"}`;
    document.getElementById("feedback-explanation").textContent = q.explanation;
    document.getElementById("feedback").hidden = false;
  }

  // ==================== 모의고사 (5지선다) ====================

  function hasNumber(q) {
    return /\d/.test(q.statement);
  }

  function normalizeForMatch(text) {
    return text.replace(/\s+/g, "").replace(/-/g, "");
  }

  // 문항이 다루는 구체적 개념 태그 — CONCEPT_TERMS 중 이 문항의 문장에 실제로 등장하는 것들.
  const conceptTermCache = new Map();
  function conceptTermsOf(q) {
    if (!conceptTermCache.has(q.id)) {
      const norm = normalizeForMatch(q.statement + q.explanation);
      const hits = CONCEPT_TERMS.filter((term) => norm.includes(normalizeForMatch(term)));
      conceptTermCache.set(q.id, hits);
    }
    return conceptTermCache.get(q.id);
  }

  // 계산형 문항에서 정답 문장 속 핵심 숫자(단위 포함)를 하나 뽑아 빈칸으로 만든다.
  // - (?<!-) : "-1일 때"처럼 부호 있는 숫자(상관계수 등)는 단위 붙은 수량이 아니므로 제외한다.
  // - "일(?!때|경우|것|수|만|치)" : "~일 때/경우"의 "일"(이다 어간)과 "며칠"의 "일"(day)을 구분한다.
  // - \d{1,3}(?:,\d{3})* : "10,000원"처럼 콤마로 묶인 숫자를 하나의 값으로 인식한다.
  const NUMERIC_RE = /(?<!-)(\d{1,3}(?:,\d{3})*(?:\.\d+)?)\s*(%|퍼센트|년|개월|영업일|거래일|주일|일(?!때|경우|것|수|만|치)|배|포인트|건|명|과목|계약|억\s*원|천만\s*원|만\s*원|조\s*원|원|인|가지|종목|좌)/;
  function extractNumericToken(text) {
    const m = text.match(NUMERIC_RE);
    if (!m) return null;
    return { exact: m[0], raw: m[0].replace(/\s+/g, " "), unit: m[2] };
  }

  // 문제은행 전체에서 같은 단위를 쓰는 다른 실제 값들을 모아, 빈칸 문제의 오답 선지(다른 실제 값)로 쓴다.
  let numericValuesByUnit = null;
  function getNumericValuesByUnit() {
    if (!numericValuesByUnit) {
      numericValuesByUnit = new Map();
      QUESTIONS.forEach((q) => {
        [q.statement, q.explanation].forEach((text) => {
          const re = new RegExp(NUMERIC_RE, "g");
          let m;
          while ((m = re.exec(text))) {
            const raw = m[0].replace(/\s+/g, " ");
            const unit = m[2];
            if (!numericValuesByUnit.has(unit)) numericValuesByUnit.set(unit, new Set());
            numericValuesByUnit.get(unit).add(raw);
          }
        });
      });
    }
    return numericValuesByUnit;
  }

  function conceptLabel(q) {
    const terms = conceptTermsOf(q);
    if (terms.length === 0) return q.topic;
    return terms.reduce((longest, t) => (t.length > longest.length ? t : longest), terms[0]);
  }

  // 빈칸(계산/수치) 유형이 가능한지: 정답 문장에서 숫자를 뽑을 수 있고, 같은 단위의 다른 실제 값이 충분히 있는가.
  // answer가 false인 문항은 explanation이 원문 맥락 없이 짧게 정정된 문장인 경우가 많아 빈칸으로 쓰면
  // 무엇에 대한 수치인지 알 수 없게 되므로, 원문 그대로가 참인(answer===true) 문항만 빈칸형으로 쓴다.
  function canBuildBlank(q) {
    if (!q.answer) return false;
    const correctText = q.statement;
    const token = extractNumericToken(correctText);
    if (!token) return false;
    const pool = getNumericValuesByUnit().get(token.unit) || new Set();
    return [...pool].filter((v) => v !== token.raw).length >= 4;
  }

  function pickMockTargets(subject, count) {
    const usedIds = new Set();
    const targets = [];

    // 1) 내 오답노트·저장한 문제를 우선 반영 (최대 60%)
    const priorityIds = shuffle(
      Array.from(new Set([...subjectWrongIds(subject), ...subjectBookmarkIds(subject)]))
    );
    const priorityBudget = Math.ceil(count * 0.6);
    for (const id of priorityIds) {
      if (targets.length >= priorityBudget) break;
      if (usedIds.has(id) || !byId[id]) continue;
      usedIds.add(id);
      targets.push(byId[id]);
    }

    // 2) 나머지는 "빈칸(계산)형"과 "구체 개념형"을 섞어서 채운다 — 계산형이 아무리 풍부해도
    //    한쪽으로 쏠리지 않도록 목표 비중(약 40%)만큼만 빈칸형을 뽑고 나머지는 개념형으로 채운다.
    const remaining = count - targets.length;
    const blankBudget = Math.round(remaining * 0.4);

    const remainingPool = QUESTIONS.filter((q) => q.subject === subject && !usedIds.has(q.id));
    const blankCandidates = shuffle(remainingPool.filter(canBuildBlank));
    const conceptScore = (q) => (conceptTermsOf(q).length > 0 ? 2 : 0) + (PRIORITY_TOPICS.has(q.topic) ? 1 : 0);
    const conceptCandidates = shuffle(remainingPool.filter((q) => !canBuildBlank(q))).sort(
      (a, b) => conceptScore(b) - conceptScore(a)
    );

    let blankTaken = 0;
    for (const q of blankCandidates) {
      if (blankTaken >= blankBudget || targets.length >= count) break;
      usedIds.add(q.id);
      targets.push(q);
      blankTaken++;
    }
    for (const q of conceptCandidates) {
      if (targets.length >= count) break;
      usedIds.add(q.id);
      targets.push(q);
    }
    // 개념형 후보가 모자라면 남은 빈칸형 후보로 채운다
    for (const q of blankCandidates) {
      if (targets.length >= count) break;
      if (usedIds.has(q.id)) continue;
      usedIds.add(q.id);
      targets.push(q);
    }

    return targets.slice(0, count);
  }

  // 빈칸(계산)형: 정답 문장의 핵심 숫자를 ( )로 가리고, 문제은행 속 같은 단위의 다른 실제 값들을 오답 선지로 쓴다.
  function buildBlankMcq(q) {
    const correctText = q.statement; // canBuildBlank()가 answer===true인 문항만 통과시킨다
    const token = extractNumericToken(correctText);
    const altPool = shuffle([...getNumericValuesByUnit().get(token.unit)].filter((v) => v !== token.raw));
    const distractors = altPool.slice(0, 4);
    const choices = shuffle([token.raw, ...distractors]);
    return {
      stem: correctText.replace(token.exact, "( )"),
      choices,
      correctIndex: choices.indexOf(token.raw),
    };
  }

  // 개념형: 같은 구체 용어(예: 준법감시인)를 다루는 다른 문항들 중 틀린 설명들을 오답 선지로 쓴다.
  function buildConceptMcq(q, globalUsedIds) {
    const correctText = q.answer ? q.statement : q.explanation;
    const terms = conceptTermsOf(q);

    let pool = [];
    if (terms.length > 0) {
      pool = QUESTIONS.filter(
        (r) => r.answer === false && r.id !== q.id && !globalUsedIds.has(r.id) && conceptTermsOf(r).some((t) => terms.includes(t))
      );
      pool.sort((a, b) => {
        const sameSubjectBonus = (r) => (r.subject === q.subject ? 1 : 0);
        return (conceptTermsOf(b).filter((t) => terms.includes(t)).length + sameSubjectBonus(b)) -
          (conceptTermsOf(a).filter((t) => terms.includes(t)).length + sameSubjectBonus(a));
      });
    }

    const label = terms.length > 0 && pool.length >= 4 ? conceptLabel(q) : q.topic;
    if (pool.length < 4) {
      const sameTopic = shuffle(
        QUESTIONS.filter((r) => r.subject === q.subject && r.topic === q.topic && r.answer === false && r.id !== q.id && !globalUsedIds.has(r.id))
      );
      const anySubject = shuffle(
        QUESTIONS.filter((r) => r.answer === false && r.id !== q.id && !globalUsedIds.has(r.id))
      );
      pool = [...pool, ...sameTopic, ...anySubject];
    }

    const distractors = [];
    const seenText = new Set([correctText]);
    for (const r of pool) {
      if (distractors.length >= 4) break;
      if (seenText.has(r.statement)) continue;
      seenText.add(r.statement);
      distractors.push(r.statement);
      globalUsedIds.add(r.id);
    }

    const choices = shuffle([correctText, ...distractors]);
    return {
      stem: `다음 중 '${label}'에 대한 설명으로 옳은 것은?`,
      choices,
      correctIndex: choices.indexOf(correctText),
    };
  }

  function buildChoicesForTarget(q, globalUsedIds) {
    const built = canBuildBlank(q) ? buildBlankMcq(q) : buildConceptMcq(q, globalUsedIds);
    return { qid: q.id, stem: built.stem, choices: built.choices, correctIndex: built.correctIndex };
  }

  function buildMockExam() {
    const targets = shuffle([1, 2, 3].flatMap((subject) => pickMockTargets(subject, MOCK_EXAM_COUNTS[subject])));
    const globalUsedIds = new Set(targets.map((q) => q.id));
    return targets.map((q) => buildChoicesForTarget(q, globalUsedIds));
  }

  function startMockExam() {
    session = {
      key: "mock-exam",
      label: "투운사 모의고사",
      mode: "mcq",
      items: buildMockExam(),
      index: 0,
      correct: 0,
      wrong: [],
    };
    saveActiveSession();
    showView("mock");
    renderMockQuestion();
  }

  function currentMockItem() {
    return session.items[session.index];
  }
  function currentMockQuestion() {
    return byId[currentMockItem().qid];
  }

  function renderMockQuestion() {
    const item = currentMockItem();
    const q = currentMockQuestion();

    document.getElementById("mock-topic").textContent = `${session.label} · ${q.topic}`;
    document.getElementById("mock-progress-label").textContent = `${session.index + 1} / ${session.items.length}`;
    document.getElementById("mock-progress-fill").style.width = `${(session.index / session.items.length) * 100}%`;

    const bookmarkBtn = document.getElementById("btn-mock-bookmark-toggle");
    bookmarkBtn.textContent = isBookmarked(q.id) ? "★" : "☆";
    bookmarkBtn.classList.toggle("active", isBookmarked(q.id));

    document.getElementById("mock-stem").textContent = item.stem;

    const choicesEl = document.getElementById("mcq-choices");
    choicesEl.innerHTML = "";
    const labels = ["①", "②", "③", "④", "⑤"];
    item.choices.forEach((text, i) => {
      const btn = document.createElement("button");
      btn.className = "mcq-btn";
      btn.dataset.index = String(i);
      btn.innerHTML = `<span class="mcq-btn-index">${labels[i]}</span><span>${text}</span>`;
      choicesEl.appendChild(btn);
    });

    document.getElementById("mock-feedback").hidden = true;
  }

  function handleMockAnswer(selectedIndex) {
    const item = currentMockItem();
    const q = currentMockQuestion();
    const correct = selectedIndex === item.correctIndex;

    document.querySelectorAll("#mcq-choices .mcq-btn").forEach((btn) => {
      const i = Number(btn.dataset.index);
      btn.disabled = true;
      if (i === item.correctIndex) btn.classList.add("correct");
      else if (i === selectedIndex) btn.classList.add("wrong-selected");
    });

    if (correct) {
      session.correct += 1;
      markCorrect(q.id);
    } else {
      session.wrong.push(q.id);
      markWrong(q.id);
    }
    saveActiveSession();

    const banner = document.getElementById("mock-feedback-banner");
    banner.textContent = correct ? "정답이에요" : "오답이에요";
    banner.className = `feedback-banner ${correct ? "correct" : "wrong"}`;
    const isBlank = item.stem.includes("( )");
    const explanationText = isBlank
      ? `정답: ${item.stem.replace("( )", item.choices[item.correctIndex])}`
      : `정답: ${item.choices[item.correctIndex]}`;
    document.getElementById("mock-feedback-explanation").textContent = explanationText;
    document.getElementById("mock-feedback").hidden = false;
  }

  // ==================== 결과 & 진행 ====================

  function nextStep() {
    session.index += 1;
    if (session.index >= sessionLength(session)) {
      clearSession(session.key);
      renderResult();
    } else {
      saveActiveSession();
      if (session.mode === "mcq") renderMockQuestion(); else renderQuestion();
    }
  }

  function renderResult() {
    showView("result");
    const total = sessionLength(session);
    document.getElementById("result-score").textContent = `${session.correct} / ${total} 정답`;

    const breakdownEl = document.getElementById("result-subject-breakdown");
    if (session.mode === "mcq") {
      const totalBySubject = { 1: 0, 2: 0, 3: 0 };
      const wrongBySubject = { 1: 0, 2: 0, 3: 0 };
      session.items.forEach((item) => { totalBySubject[byId[item.qid].subject] += 1; });
      session.wrong.forEach((id) => { wrongBySubject[byId[id].subject] += 1; });
      breakdownEl.hidden = false;
      breakdownEl.innerHTML = [1, 2, 3].map((s) => {
        const t = totalBySubject[s];
        const c = t - wrongBySubject[s];
        return `<div class="breakdown-row"><span>${SUBJECT_LABELS[s].split(" · ")[0]}</span><span>${c} / ${t}</span></div>`;
      }).join("");
    } else {
      breakdownEl.hidden = true;
      breakdownEl.innerHTML = "";
    }

    const conceptCounts = {};
    session.wrong.forEach((id) => {
      const label = conceptLabel(byIdAll[id]);
      conceptCounts[label] = (conceptCounts[label] || 0) + 1;
    });
    const sortedConcepts = Object.entries(conceptCounts).sort((a, b) => b[1] - a[1]);

    const wrongHeading = document.getElementById("result-wrong-heading");
    wrongHeading.hidden = sortedConcepts.length === 0;
    const tagsEl = document.getElementById("result-wrong-topics");
    tagsEl.innerHTML = "";
    sortedConcepts.forEach(([label, n]) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "tag";
      btn.textContent = `${label} (${n})`;
      btn.addEventListener("click", () => startConceptSession(label));
      tagsEl.appendChild(btn);
    });

    const retryBtn = document.getElementById("btn-retry-from-result");
    if (session.wrong.length > 0) {
      retryBtn.hidden = false;
      retryBtn.onclick = () => startOxSession("wrong-retry", session.wrong.map((id) => byIdAll[id]), "오답 재도전");
    } else {
      retryBtn.hidden = true;
    }
  }

  // 개념 태그(용어 또는 topic 폴백) 하나를 다루는 전체 문항(기존+실전 기출, 정답+오답)을 모아 새 세션을 시작한다.
  function startConceptSession(label) {
    const isTerm = CONCEPT_TERMS.includes(label);
    const matches = isTerm
      ? ALL_QUESTIONS.filter((q) => conceptTermsOf(q).includes(label))
      : ALL_QUESTIONS.filter((q) => q.topic === label);
    if (matches.length === 0) return;
    startOxSession(`concept-${label}`, matches, `개념 · ${label}`);
  }

  // ==================== 이벤트 바인딩 ====================

  document.getElementById("ox-buttons").addEventListener("click", (e) => {
    const btn = e.target.closest(".ox-btn");
    if (!btn || btn.disabled) return;
    handleAnswer(btn.dataset.value === "true");
  });
  document.getElementById("btn-next").addEventListener("click", nextStep);
  document.getElementById("btn-back-quiz").addEventListener("click", goHome);

  document.getElementById("btn-bookmark-toggle").addEventListener("click", () => {
    const q = currentQuestion();
    const active = toggleBookmark(q.id);
    const btn = document.getElementById("btn-bookmark-toggle");
    btn.textContent = active ? "★" : "☆";
    btn.classList.toggle("active", active);
  });

  document.getElementById("mcq-choices").addEventListener("click", (e) => {
    const btn = e.target.closest(".mcq-btn");
    if (!btn || btn.disabled) return;
    handleMockAnswer(Number(btn.dataset.index));
  });
  document.getElementById("btn-mock-next").addEventListener("click", nextStep);
  document.getElementById("btn-back-mock").addEventListener("click", goHome);

  document.getElementById("btn-mock-bookmark-toggle").addEventListener("click", () => {
    const q = currentMockQuestion();
    const active = toggleBookmark(q.id);
    const btn = document.getElementById("btn-mock-bookmark-toggle");
    btn.textContent = active ? "★" : "☆";
    btn.classList.toggle("active", active);
  });

  document.getElementById("btn-mock-exam").addEventListener("click", startMockExam);

  document.getElementById("btn-real-exam").addEventListener("click", () => {
    startOxSession("real-exam", MOCK_QUESTIONS, "실전 기출문제", { shuffle: false });
  });

  document.getElementById("btn-home").addEventListener("click", goHome);

  renderHome();
  showView("home");
})();
