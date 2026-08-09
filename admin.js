/* ==========================================================
   単語管理画面ロジック (admin.js)
   - data.json を読み込み、追加・編集・削除した上で
     新しい data.json として書き出す
   ========================================================== */

let WORDS = [];

const tbody = document.getElementById("wordTableBody");
const loadStatus = document.getElementById("loadStatus");
const countLabel = document.getElementById("countLabel");
const categoryListEl = document.getElementById("categoryList");
const searchBox = document.getElementById("searchBox");

function showStatus(msg, ok = true) {
  loadStatus.style.display = "block";
  loadStatus.className = "status-msg " + (ok ? "ok" : "err");
  loadStatus.textContent = msg;
}

async function loadCurrentData() {
  try {
    const res = await fetch("data.json", { cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    WORDS = await res.json();
    showStatus(`data.json を読み込みました(${WORDS.length}件)。`, true);
    renderTable();
  } catch (err) {
    showStatus(
      "data.json の読み込みに失敗しました。file:// で直接開いている場合はローカルサーバー経由で開くか、下の「JSONファイルを選んで読み込む」を利用してください。",
      false
    );
    console.error(err);
  }
}

function loadFromFile(file) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const parsed = JSON.parse(e.target.result);
      if (!Array.isArray(parsed)) throw new Error("配列形式のJSONではありません");
      WORDS = parsed;
      showStatus(`ファイル「${file.name}」を読み込みました(${WORDS.length}件)。`, true);
      renderTable();
    } catch (err) {
      showStatus("JSONの読み込みに失敗しました: " + err.message, false);
    }
  };
  reader.readAsText(file, "UTF-8");
}

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, s => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[s]));
}

function updateCategoryList() {
  const cats = [...new Set(WORDS.map(w => w["カテゴリ"]))];
  categoryListEl.innerHTML = cats.map(c => `<option value="${escapeHtml(c)}">`).join("");
}

function renderTable(filterText = "") {
  countLabel.textContent = WORDS.length;
  updateCategoryList();

  const rows = WORDS
    .map((w, idx) => ({ w, idx }))
    .filter(({ w }) => {
      if (!filterText) return true;
      const t = filterText.toLowerCase();
      return (
        String(w["語句"]).toLowerCase().includes(t) ||
        String(w["意味"]).toLowerCase().includes(t) ||
        String(w["カテゴリ"]).toLowerCase().includes(t)
      );
    });

  tbody.innerHTML = rows
    .map(({ w, idx }) => `
      <tr data-idx="${idx}">
        <td>${w["ID"]}</td>
        <td><input type="text" data-field="カテゴリ" value="${escapeHtml(w["カテゴリ"])}"></td>
        <td><input type="text" data-field="語句" value="${escapeHtml(w["語句"])}"></td>
        <td><input type="text" data-field="読み" value="${escapeHtml(w["読み"])}"></td>
        <td>
          <select data-field="頻出度">
            <option value="A" ${w["頻出度"] === "A" ? "selected" : ""}>A</option>
            <option value="B" ${w["頻出度"] === "B" ? "selected" : ""}>B</option>
            <option value="C" ${w["頻出度"] === "C" ? "selected" : ""}>C</option>
          </select>
        </td>
        <td><textarea data-field="意味">${escapeHtml(w["意味"])}</textarea></td>
        <td><textarea data-field="例文">${escapeHtml(w["例文"])}</textarea></td>
        <td><button class="danger delete-btn" data-idx="${idx}">削除</button></td>
      </tr>
    `)
    .join("");

  // 編集イベント
  tbody.querySelectorAll("tr").forEach(tr => {
    const idx = Number(tr.dataset.idx);
    tr.querySelectorAll("[data-field]").forEach(input => {
      input.addEventListener("change", () => {
        WORDS[idx][input.dataset.field] = input.value;
      });
    });
  });

  // 削除イベント
  tbody.querySelectorAll(".delete-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.dataset.idx);
      if (confirm(`「${WORDS[idx]["語句"]}」を削除しますか?`)) {
        WORDS.splice(idx, 1);
        renderTable(searchBox.value);
      }
    });
  });
}

function addWord() {
  const category = document.getElementById("newCategory").value.trim();
  const word = document.getElementById("newWord").value.trim();
  const reading = document.getElementById("newReading").value.trim();
  const freq = document.getElementById("newFreq").value;
  const meaning = document.getElementById("newMeaning").value.trim();
  const example = document.getElementById("newExample").value.trim();

  if (!category || !word || !reading || !meaning) {
    alert("カテゴリ・語句・読み・意味は必須項目です。");
    return;
  }

  const nextId = WORDS.length > 0 ? Math.max(...WORDS.map(w => Number(w["ID"]) || 0)) + 1 : 1;

  WORDS.push({
    ID: nextId,
    "カテゴリ": category,
    "語句": word,
    "読み": reading,
    "意味": meaning,
    "例文": example,
    "頻出度": freq
  });

  ["newCategory", "newWord", "newReading", "newMeaning", "newExample"].forEach(id => {
    document.getElementById(id).value = "";
  });

  renderTable(searchBox.value);
  showStatus(`「${word}」を追加しました。忘れずに data.json を書き出してください。`, true);
}

function exportData() {
  // ID を振り直して連番に整える
  WORDS.forEach((w, i) => (w.ID = i + 1));
  const json = JSON.stringify(WORDS, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "data.json";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  renderTable(searchBox.value);
}

document.getElementById("loadCurrentBtn").addEventListener("click", loadCurrentData);
document.getElementById("fileInput").addEventListener("change", e => {
  if (e.target.files[0]) loadFromFile(e.target.files[0]);
});
document.getElementById("addWordBtn").addEventListener("click", addWord);
document.getElementById("exportBtn").addEventListener("click", exportData);
searchBox.addEventListener("input", () => renderTable(searchBox.value));

loadCurrentData();
