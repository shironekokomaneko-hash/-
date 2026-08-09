/* ==========================================================
   現代文重要語句 出題ロジック (quiz.js)
   - data.json を読み込み、設定に応じて問題用紙・解答用紙を生成する
   ========================================================== */

let WORD_DATA = [];

const dataStatusEl = document.getElementById("dataStatus");
const categoryFilterEl = document.getElementById("categoryFilter");

async function loadData() {
  const warningEl = document.getElementById("fileProtocolWarning");

  if (location.protocol === "file:") {
    // file:// で直接開いている場合、多くのブラウザは fetch("data.json") を
    // セキュリティ上ブロックするため、事前に分かりやすい案内を表示する。
    if (warningEl) warningEl.style.display = "block";
  }

  try {
    const res = await fetch("data.json", { cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    WORD_DATA = await res.json();
    dataStatusEl.textContent = `語句データ ${WORD_DATA.length} 件を読み込みました。`;
    if (warningEl) warningEl.style.display = "none"; // 読み込めた場合は警告を隠す
    buildCategoryFilter();
  } catch (err) {
    dataStatusEl.textContent =
      "data.json の読み込みに失敗しました。ローカルで開いている場合は、簡易サーバー(例: python3 -m http.server)経由で開いてください。";
    if (warningEl) warningEl.style.display = "block";
    console.error(err);
  }
}

function buildCategoryFilter() {
  const categories = [...new Set(WORD_DATA.map(w => w["カテゴリ"]))];
  categoryFilterEl.innerHTML = categories
    .map(
      c =>
        `<label><input type="checkbox" class="cat-check" value="${escapeHtml(c)}"> ${escapeHtml(c)}</label>`
    )
    .join("");
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, s => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[s]));
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getFilteredPool() {
  const freqChecked = [...document.querySelectorAll("#freqFilter input:checked")].map(el => el.value);
  const catChecked = [...document.querySelectorAll(".cat-check:checked")].map(el => el.value);

  return WORD_DATA.filter(w => {
    const freqOk = freqChecked.length === 0 || freqChecked.includes(w["頻出度"]);
    const catOk = catChecked.length === 0 || catChecked.includes(w["カテゴリ"]);
    return freqOk && catOk;
  });
}

function buildChoices(correctWord, pool) {
  // 正解以外からダミーの意味を3つ選ぶ(同じ意味文にならないよう重複除去)
  const others = pool.filter(w => w["ID"] !== correctWord["ID"]);
  const shuffledOthers = shuffle(others);
  const distractors = [];
  for (const w of shuffledOthers) {
    if (distractors.length >= 3) break;
    if (w["意味"] !== correctWord["意味"]) distractors.push(w);
  }
  // プールが小さすぎる場合は全体から補充
  if (distractors.length < 3) {
    const fallbackPool = shuffle(WORD_DATA.filter(w => w["ID"] !== correctWord["ID"]));
    for (const w of fallbackPool) {
      if (distractors.length >= 3) break;
      if (!distractors.find(d => d["ID"] === w["ID"]) && w["意味"] !== correctWord["意味"]) {
        distractors.push(w);
      }
    }
  }
  const choices = shuffle([correctWord, ...distractors]);
  const correctIndex = choices.findIndex(c => c["ID"] === correctWord["ID"]);
  return { choices, correctIndex };
}

function generateQuiz() {
  if (WORD_DATA.length === 0) {
    const hint =
      location.protocol === "file:"
        ? "file:// で直接開いているため data.json を読み込めていません。画面上部の案内に従い、簡易サーバー経由で開いてください。"
        : "語句データがまだ読み込まれていません。ページを再読み込みするか、data.json が正しい場所にあるか確認してください。";
    alert(hint);
    return;
  }

  const num = Math.max(1, parseInt(document.getElementById("numQuestions").value, 10) || 20);
  const qtype = document.querySelector('input[name="qtype"]:checked').value;
  const order = document.querySelector('input[name="order"]:checked').value;
  const title = document.getElementById("sheetTitle").value || "現代文重要語句テスト";

  let pool = getFilteredPool();
  if (pool.length === 0) pool = WORD_DATA;

  let selected;
  if (order === "random") {
    selected = shuffle(pool).slice(0, Math.min(num, pool.length));
  } else {
    selected = pool
      .slice()
      .sort((a, b) => a["ID"] - b["ID"])
      .slice(0, Math.min(num, pool.length));
  }

  if (selected.length < num) {
    dataStatusEl.textContent = `※条件に合う語句が ${selected.length} 件のみのため、${selected.length} 問で作成しました。`;
  }

  renderSheets(selected, qtype, title, pool);

  const resultArea = document.getElementById("resultArea");
  resultArea.style.display = "block";
  if (typeof resultArea.scrollIntoView === "function") {
    resultArea.scrollIntoView({ behavior: "smooth" });
  }
}

function renderSheets(selected, qtype, title, pool) {
  const dateStr = new Date().toLocaleDateString("ja-JP");
  const qSheet = document.getElementById("questionSheet");
  const aSheet = document.getElementById("answerSheet");

  let qHeader = `
    <div class="sheet-header">
      <h2>${escapeHtml(title)}</h2>
      <div class="sheet-meta">作成日: ${dateStr} ｜ 全${selected.length}問</div>
    </div>
    <div class="sheet-fillin">
      <div>クラス・学年: <span>&nbsp;</span></div>
      <div>氏名: <span>&nbsp;</span></div>
      <div>得点: <span>&nbsp;</span> / ${selected.length}</div>
    </div>
  `;

  let answers = [];
  let qBody = "";

  if (qtype === "choice") {
    qBody += `<div class="questions-2col">`;
    selected.forEach((w, i) => {
      const { choices, correctIndex } = buildChoices(w, pool);
      const labels = ["ア", "イ", "ウ", "エ"];
      qBody += `
        <div class="q-item">
          <div class="q-word"><span class="q-num">問${i + 1}.</span>${escapeHtml(w["語句"])}</div>
          <ul class="q-choices">
            ${choices.map((c, idx) => `<li>${labels[idx]}. ${escapeHtml(c["意味"])}</li>`).join("")}
          </ul>
        </div>
      `;
      answers.push(`問${i + 1}: ${labels[correctIndex]}(${escapeHtml(w["語句"])})`);
    });
    qBody += `</div>`;
  } else {
    // 記述式(意味→語句)
    qBody += `<div class="questions-1col">`;
    selected.forEach((w, i) => {
      qBody += `
        <div class="q-item">
          <span class="q-num">問${i + 1}.</span>
          ${escapeHtml(w["意味"])}
          &nbsp;→&nbsp; <span class="q-blank"></span>
        </div>
      `;
      answers.push(`問${i + 1}: ${escapeHtml(w["語句"])}(${escapeHtml(w["読み"])})`);
    });
    qBody += `</div>`;
  }

  qSheet.innerHTML = qHeader + qBody;

  aSheet.innerHTML = `
    <div class="sheet-header">
      <h2>${escapeHtml(title)} ― 解答</h2>
      <div class="sheet-meta">作成日: ${dateStr}</div>
    </div>
    <div class="answer-list">
      ${answers.map(a => `<div>${a}</div>`).join("")}
    </div>
  `;
}

document.getElementById("generateBtn").addEventListener("click", generateQuiz);
document.getElementById("regenerateBtn").addEventListener("click", generateQuiz);
document.getElementById("printBtn").addEventListener("click", () => window.print());

loadData();
