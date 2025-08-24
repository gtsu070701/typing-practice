import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

/* ===== i18n ===== */
const I18N = {
  ko: {
    title: "영어 타자 연습",
    subtitle: "자리익히기 → 문장연습 · 반응형",
    modePosition: "자리익히기",
    modeSentence: "문장 연습",
    difficulty: "난이도",
    time: "Time",
    wpm: "WPM",
    accuracy: "Accuracy",
    next: "다음 과제",
    restart: "처음부터",
    sentenceLabel: "문장 연습",
    placeholder: "여기에 입력을 시작하세요",
  },
  en: {
    title: "Simple English Typing Practice",
    subtitle: "Position → Sentence · Responsive",
    modePosition: "Position",
    modeSentence: "Sentences",
    difficulty: "Difficulty",
    time: "Time",
    wpm: "WPM",
    accuracy: "Accuracy",
    next: "Next Task",
    restart: "Restart",
    sentenceLabel: "Sentence Practice",
    placeholder: "Start typing here",
  },
};

/* ===== 데이터 (기본) ===== */
const DEFAULT_DATA = {
  positions: {
    home: ["f","j","f","j","f","j","f","j","f","j","f","j","f","j","f","j","f","j"],
    leftTop: ["q","w","e","r","t"],
    leftBottom: ["z","x","c","v","b"],
    center: ["g","h"],
    rightTop: ["y","u","i","o","p"],
    rightBottom: ["n","m",",","."],
    // all 은 아래에서 '키보드 전체'로 대체
    all: ["a","s","d","f","j","k","l",";"], 
    number: ["1","2","3","4","5","6","7","8","9","0"],
  },
  sentences: [
    { text: "The quick brown fox jumps over the lazy dog.", level: "easy" },
    { text: "Practice makes progress, not perfection.", level: "easy" },
    { text: "Typing every day improves speed and accuracy.", level: "medium" },
    { text: "Focus on steady rhythm and clean keystrokes.", level: "medium" },
    { text: "Small steps, big gains: keep going!", level: "easy" },
    { text: "Accuracy builds confidence, and confidence builds speed.", level: "hard" },
  ],
};

const POSITION_LABELS = {
  home: "기본자리",
  leftTop: "왼손 윗자리",
  leftBottom: "왼손 아랫자리",
  center: "가운데자리",
  rightTop: "오른손 윗자리",
  rightBottom: "오른손 아랫자리",
  all: "전체자리",
  number: "숫자자리",
};

/* ===== 유틸 ===== */
const pad = (n) => String(n).padStart(2, "0");
const fmtTime = (ms) => {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${pad(m)}:${pad(s % 60)}`;
};
const calcWPM = (correct, ms) => {
  if (!ms) return 0;
  return Math.max(0, Math.round((correct / 5) / (ms / 60000)));
};
const calcACC = (correct, wrong) => {
  const t = correct + wrong;
  return (t ? Math.round((correct / t) * 100) : 100) + "%";
};
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const makeSeq = (keys, len = 34) => {
  let out = "";
  while (out.length < len) {
    const ch = pick(keys);
    out += Math.random() < 0.18 ? ch + " " : ch;
  }
  return out.trim();
};

/* ===== 키보드 배열 (큰 자판) ===== */
const KBD_ROWS = [
  ["`","1","2","3","4","5","6","7","8","9","0","-","="],
  ["q","w","e","r","t","y","u","i","o","p","[","]","\\"],
  ["a","s","d","f","g","h","j","k","l",";","'"],
  ["z","x","c","v","b","n","m",",",".","/"],
];

// 전체 자리용 키 세트 (알파벳+숫자+기호)
const ALL_KEYS = Array.from(new Set(KBD_ROWS.flat()));

/* ===== 미니 키보드 컴포넌트 ===== */
function Keyboard({ activeSet, expected }) {
  return (
    <div className="kbd">
      {KBD_ROWS.map((row, ri) => (
        <div className="kbd-row" key={ri}>
          {row.map((k) => {
            const lower = k.toLowerCase();
            const isActive = activeSet.has(lower);
            const isExpected = expected && lower === expected.toLowerCase();
            return (
              <div
                key={k}
                className={[
                  "key",
                  isExpected ? "key-expected" : isActive ? "key-active" : ""
                ].join(" ")}
                title={k}
              >
                {k}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/* ===== 메인 App ===== */
export default function App() {
  const [lang, setLang] = useState("ko");
  const T = I18N[lang];

  const [data, setData] = useState(DEFAULT_DATA);

  const [mode, setMode] = useState("position"); // 'position' | 'sentence'
  const [targetKey, setTargetKey] = useState("home");
  const [level, setLevel] = useState("all");    // easy|medium|hard|all

  const [text, setText] = useState("");
  const [value, setValue] = useState("");
  const [cursor, setCursor] = useState(0);

  // stats
  const [correct, setCorrect] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [startAt, setStartAt] = useState(null);
  const [elapsed, setElapsed] = useState(0);

  const inputRef = useRef(null);

  /* --- 외부 데이터 (optional) --- */
  useEffect(() => {
    const load = async () => {
      try {
        const isHttp = /^https?/.test(location.protocol);
        if (!isHttp) return;
        // const res = await fetch("/data/typing.json", { cache: "no-store" }); //github 올리면서 이 코드는 삭제, 아래 코드는 추가
        const res = await fetch(import.meta.env.BASE_URL + "data/typing.json", { cache: "no-store" }); 
        if (res.ok) {
          const j = await res.json();
          if (j.positions && j.sentences) setData(j);
        }
      } catch {}
    };
    load();
  }, []);

  /* --- 타이머 --- */
  useEffect(() => {
    if (!startAt) return;
    let r;
    const tick = () => {
      setElapsed(performance.now() - startAt);
      r = requestAnimationFrame(tick);
    };
    r = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(r);
  }, [startAt]);

  /* --- 파생 값 --- */
  const activeSet = useMemo(
    () =>
      new Set(
        mode === "position"
          ? (targetKey === "all" ? ALL_KEYS : data.positions[targetKey] || []).map((k) =>
              k.toLowerCase()
            )
          : []
      ),
    [mode, targetKey, data]
  );
  const expected = text[cursor] || "";

  /* --- 포커스 헬퍼 --- */
  const focusInput = () => setTimeout(() => inputRef.current?.focus(), 0);

  /* --- 과제 로딩 --- */
  const resetStats = () => {
    setValue("");
    setCursor(0);
    setCorrect(0);
    setWrong(0);
    setElapsed(0);
    setStartAt(null);
  };

  const loadPosition = (k) => {
    setMode("position");
    setTargetKey(k);
    const keys = k === "all" ? ALL_KEYS : data.positions[k];
    setText(makeSeq(keys, 34));
    resetStats();
    focusInput(); // (요청 2,3) 메뉴/다음 과제 시 포커스
  };

  const filteredSentences = () =>
    level === "all" ? data.sentences : data.sentences.filter((s) => (s.level || "easy") === level);

  const loadSentence = () => {
    setMode("sentence");
    const it = pick(filteredSentences());
    setText(typeof it === "string" ? it : it.text);
    resetStats();
    focusInput(); // (요청 2,3)
  };

  // 초기
  useEffect(() => {
    loadPosition("home");
    // eslint-disable-next-line
  }, []);

  /* --- 최고 기록 --- */
  const LS_KEY = "typing_best_v1";
  const updateBest = () => {
    const w = calcWPM(correct, elapsed);
    const a = parseInt(calcACC(correct, wrong));
    const prev = JSON.parse(localStorage.getItem(LS_KEY) || "{}");
    const slot = mode === "position" ? "position" : "sentence";
    const cur = prev[slot] || { wpm: 0, acc: 0 };
    if (w > (cur.wpm || 0)) cur.wpm = w;
    if (a > (cur.acc || 0)) cur.acc = a;
    const next = { ...prev, [slot]: cur };
    localStorage.setItem(LS_KEY, JSON.stringify(next));
  };

  const best = (() => {
    const b = JSON.parse(localStorage.getItem(LS_KEY) || "{}");
    const slot = mode === "position" ? "position" : "sentence";
    return b[slot] || { wpm: 0, acc: 0 };
  })();

  /* --- 다음 과제 공통 --- */
  const nextTask = () => {
    if (mode === "position") loadPosition(targetKey);
    else loadSentence();
    focusInput(); // (요청 2) 명확한 커서 위치
  };

  /* --- 입력 제약 & 비교 --- */
  function onChange(e) {
    const v = e.target.value;

    // (요청 4) 뒤로 이동/삭제 금지: 길이가 줄어드는 변경은 무시
    if (v.length < value.length) {
      // 이전 값으로 복구
      e.target.value = value;
      // 커서를 항상 끝으로 유지
      focusInput();
      return;
    }

    if (!startAt && v.length > 0) setStartAt(performance.now());

    // 범위 초과 방지
    const idx = v.length - 1;
    if (idx >= text.length) {
      e.target.value = value; // 초과 입력 무시
      return;
    }

    // 새로 입력된 1글자만 판정
    if (v.length > value.length) {
      const exp = text[idx];
      const given = v[idx];
      if (given === exp) setCorrect((x) => x + 1);
      else setWrong((x) => x + 1);
    }

    setValue(v);
    setCursor(v.length);

    // 완료 → 최고기록 갱신
    if (v.length === text.length) {
      updateBest();
    }
  }

  /* --- 키다운: 엔터/백스페이스/좌측 이동 제약 --- */
  function onKeyDown(e) {
    // (요청 1) 완료 상태에서 Enter = 다음 과제
    if (e.key === "Enter" && value.length === text.length) {
      e.preventDefault();
      nextTask();
      return;
    }
    // (요청 4) 수정 금지: 뒤로/삭제/홈 이동 차단
    const block = ["Backspace", "Delete", "ArrowLeft", "ArrowUp", "Home"];
    if (block.includes(e.key)) {
      e.preventDefault();
      focusInput();
    }
  }

  // 마우스로 커서 이동 시 항상 끝으로 (요청 4)
  function forceCaretToEnd(e) {
    const el = e.target;
    requestAnimationFrame(() => {
      el.selectionStart = el.selectionEnd = el.value.length;
    });
  }

  return (
    <div className="page">
      <header className="top">
        <div className="brand">
          <div>
            <h1>{I18N[lang].title}</h1>
            <p>{I18N[lang].subtitle}</p>
          </div>
          <div className="right">
            <div className="best">
              🏆 Best — WPM <b>{best.wpm || 0}</b> · ACC <b>{(best.acc || 0) + "%"}</b>
            </div>
            <button className="btn sm" onClick={() => { setLang((l) => (l === "ko" ? "en" : "ko")); focusInput(); }}>
              {lang === "ko" ? "EN" : "KO"}
            </button>
          </div>
        </div>
      </header>

      <main>
        <section className="card">
          {/* 모드/필터 */}
          <div className="row between">
            <div className="row">
              <button
                className={`btn ${mode === "position" ? "primary" : ""}`}
                onClick={() => { loadPosition(targetKey); focusInput(); }}   // (요청 3)
              >
                {I18N[lang].modePosition}
              </button>
              <button
                className={`btn ${mode === "sentence" ? "primary" : ""}`}
                onClick={() => { loadSentence(); focusInput(); }}            // (요청 3)
              >
                {I18N[lang].modeSentence}
              </button>
            </div>

            {mode === "position" ? (
              <div className="chips">
                {Object.keys(POSITION_LABELS).map((k) => (
                  <button
                    key={k}
                    className={`chip ${k === targetKey ? "chip-on" : ""}`}
                    onClick={() => { loadPosition(k); focusInput(); }}       // (요청 3)
                  >
                    {POSITION_LABELS[k]}
                  </button>
                ))}
              </div>
            ) : (
              <div className="row">
                <span className="meta">{I18N[lang].difficulty}</span>
                <select
                  className="btn sm"
                  value={level}
                  onChange={(e) => { setLevel(e.target.value); setTimeout(() => { loadSentence(); focusInput(); }, 0); }}
                >
                  <option value="all">All</option>
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>
            )}
          </div>

          {/* 목표 텍스트 / 입력 */}
          <div className="panel">
            <div className="meta">
              {mode === "position" ? `자리익히기 · ${POSITION_LABELS[targetKey]}` : I18N[lang].sentenceLabel}
            </div>

            <div className="target">
              {text.split("").map((ch, i) => (
                <span
                  key={i}
                  className={[
                    i < value.length ? (value[i] === ch ? "ok" : "err") : "",
                    i === cursor ? "current" : "",
                  ].join(" ")}
                >
                  {ch}
                </span>
              ))}
            </div>

            <input
              ref={inputRef}
              className="input"
              type="text"
              value={value}
              onChange={onChange}
              onKeyDown={onKeyDown}
              onClick={forceCaretToEnd}
              onSelect={forceCaretToEnd}
              placeholder={I18N[lang].placeholder}
              spellCheck="false"
              autoComplete="off"
            />

            {/* 큰 키보드 */}
            <Keyboard activeSet={activeSet} expected={text[cursor] || ""} />

            {/* 지표 */}
            <div className="stats">
              <div className="stat">⏱ {I18N[lang].time} <strong>{fmtTime(elapsed)}</strong></div>
              <div className="stat">⌨ {I18N[lang].wpm} <strong>{calcWPM(correct, elapsed)}</strong></div>
              <div className="stat">🎯 {I18N[lang].accuracy} <strong>{calcACC(correct, wrong)}</strong></div>
              <div className="spacer" />
              <button className="btn" onClick={nextTask}>{I18N[lang].next}</button>
              <button className="btn ghost" onClick={() => { loadPosition("home"); focusInput(); }}>
                {I18N[lang].restart}
              </button>
            </div>
            {/* 지표 */}
            <div className="stats">
              ...
            </div>

            {/* 광고 라인 */}
            <p className="adline">
              <strong>AICE 공인교육기관 더에이아이랩</strong>
            </p>

          </div>
        </section>

        <p className="madeby">더에이아이랩 주식회사 by sanders.lee /w chatGPT 5</p>
      </main>
    </div>
  );
}
