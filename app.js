const $ = (selector) => document.querySelector(selector);
const app = $("#app");
const STORAGE_KEY = "rechtLernAppV1";

const defaultState = { reviewed: {}, correct: {}, seen: {}, customCards: [] };
let state = loadState();
let currentCards = [];
let cardIndex = 0;
let answerVisible = false;
let quizQuestions = [];
let quizIndex = 0;
let quizScore = 0;
let examActive = false;

function loadState() {
  try { return { ...defaultState, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") }; }
  catch { return structuredClone(defaultState); }
}
function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function allCards() {
  return [...studyCards.map((c, i) => ({ id: `base-${i}`, topic: c[0], question: c[1], answer: c[2] })),
    ...state.customCards];
}

function setView(view) {
  document.querySelectorAll(".nav-item").forEach(b => b.classList.toggle("active", b.dataset.view === view));
  const titles = { dashboard: "Übersicht", cards: "Karteikarten", quiz: "Multiple Choice", exam: "Prüfungsmodus", topics: "Themen" };
  $("#pageTitle").textContent = titles[view];
  if (view === "dashboard") renderDashboard();
  if (view === "cards") renderCards();
  if (view === "quiz") renderQuiz();
  if (view === "exam") startExam();
  if (view === "topics") renderTopics();
}

function renderDashboard() {
  const cards = allCards();
  const reviewed = Object.values(state.reviewed).filter(Boolean).length;
  const percent = cards.length ? Math.round(reviewed / cards.length * 100) : 0;
  app.innerHTML = `
    <div class="grid grid-3">
      <div class="card metric"><div class="metric-label">Gesamtfortschritt</div><div class="metric-value">${percent}%</div><div class="progress"><div style="width:${percent}%"></div></div></div>
      <div class="card metric"><div class="metric-label">Gelernt heute</div><div class="metric-value">${Object.keys(state.seen).length}</div></div>
      <div class="card metric"><div class="metric-label">Richtige Antworten</div><div class="metric-value">${Object.values(state.correct).filter(v => v > 0).length}</div></div>
    </div>
    <div class="panel" style="margin-top:16px">
      <h2>Weiterlernen</h2>
      <div class="action-grid">
        <button class="action" data-go="cards"><span class="icon">▤</span><strong>Karteikarten</strong><span>${cards.length} Karten wiederholen</span></button>
        <button class="action" data-go="quiz"><span class="icon">A</span><strong>Multiple Choice</strong><span>Mit gezielten Fragen üben</span></button>
        <button class="action" data-go="exam"><span class="icon">✓</span><strong>Prüfungsmodus</strong><span>Gemischten Wissenstest starten</span></button>
      </div>
    </div>`;
  document.querySelectorAll("[data-go]").forEach(b => b.onclick = () => setView(b.dataset.go));
}

function renderCards(topic = "Alle") {
  const cards = allCards().filter(c => topic === "Alle" || c.topic === topic);
  currentCards = cards;
  cardIndex = 0;
  answerVisible = false;
  const topics = ["Alle", ...new Set(allCards().map(c => c.topic))];
  app.innerHTML = `
    <div class="toolbar">
      <select id="topicFilter">${topics.map(t => `<option ${t === topic ? "selected" : ""}>${t}</option>`).join("")}</select>
      <button class="primary" id="addCard">Neue Karte</button>
    </div>
    <div id="flashcardArea"></div>`;
  $("#topicFilter").onchange = (e) => renderCards(e.target.value);
  $("#addCard").onclick = () => $("#cardDialog").showModal();
  renderCard();
}

function renderCard() {
  if (!currentCards.length) { $("#flashcardArea").innerHTML = "<div class='panel'>Keine Karten gefunden.</div>"; return; }
  const card = currentCards[cardIndex];
  state.seen[card.id] = true;
  saveState();
  $("#flashcardArea").innerHTML = `
    <div class="flashcard-wrap">
      <div class="flashcard" id="flashcard">
        <div class="topic-label">${card.topic}</div>
        <h2>${card.question}</h2>
        ${answerVisible ? `<div class="answer">${card.answer}</div>` : `<div class="answer">Tippe auf die Karte, um die Antwort zu sehen</div>`}
      </div>
      ${answerVisible ? `
        <div class="rate-controls">
          <button class="again" data-rate="again">Nochmal</button>
          <button class="good" data-rate="good">Gut</button>
          <button class="easy" data-rate="easy">Leicht</button>
        </div>` : ""}
      <div class="card-controls">
        <button id="prevCard">Zurück</button>
        <span>${cardIndex + 1} / ${currentCards.length}</span>
        <button id="nextCard">Weiter</button>
      </div>
    </div>`;
  $("#flashcard").onclick = () => { answerVisible = !answerVisible; renderCard(); };
  $("#prevCard").onclick = (e) => { e.stopPropagation(); cardIndex = (cardIndex - 1 + currentCards.length) % currentCards.length; answerVisible = false; renderCard(); };
  $("#nextCard").onclick = (e) => { e.stopPropagation(); cardIndex = (cardIndex + 1) % currentCards.length; answerVisible = false; renderCard(); };
  document.querySelectorAll("[data-rate]").forEach(b => b.onclick = (e) => {
    e.stopPropagation();
    if (b.dataset.rate !== "again") state.reviewed[card.id] = true;
    else state.reviewed[card.id] = false;
    saveState();
    cardIndex = (cardIndex + 1) % currentCards.length;
    answerVisible = false;
    renderCard();
  });
}

function shuffle(items) {
  return [...items].sort(() => Math.random() - .5);
}

function makeQuiz(count = 10) {
  const cards = allCards();
  return shuffle(cards).slice(0, Math.min(count, cards.length)).map(card => {
    const wrongAnswers = shuffle(cards.filter(c => c.answer !== card.answer)).slice(0, 3).map(c => c.answer);
    return { card, options: shuffle([card.answer, ...wrongAnswers]) };
  });
}

function renderQuiz() {
  quizQuestions = makeQuiz(10);
  quizIndex = 0;
  quizScore = 0;
  renderQuizQuestion();
}
function renderQuizQuestion() {
  if (quizIndex >= quizQuestions.length) {
    app.innerHTML = `<div class="panel quiz-card"><h2>Ergebnis: ${quizScore} von ${quizQuestions.length}</h2><p>${Math.round(quizScore / quizQuestions.length * 100)} % richtig.</p><button class="primary" id="againQuiz">Nochmal</button></div>`;
    $("#againQuiz").onclick = renderQuiz;
    return;
  }
  const q = quizQuestions[quizIndex];
  app.innerHTML = `
    <div class="panel quiz-card">
      <div class="exam-stats"><span>${q.card.topic}</span><span>${quizIndex + 1} / ${quizQuestions.length}</span></div>
      <h2>${q.card.question}</h2>
      <div class="options">${q.options.map((o, i) => `<button class="option" data-option="${i}">${o}</button>`).join("")}</div>
      <div class="quiz-feedback" id="feedback"></div>
    </div>`;
  document.querySelectorAll("[data-option]").forEach(button => button.onclick = () => answerQuiz(button));
}
function answerQuiz(button) {
  const q = quizQuestions[quizIndex];
  const selected = q.options[Number(button.dataset.option)];
  document.querySelectorAll(".option").forEach(b => {
    b.disabled = true;
    if (q.options[Number(b.dataset.option)] === q.card.answer) b.classList.add("correct");
  });
  if (selected === q.card.answer) {
    quizScore++;
    state.correct[q.card.id] = (state.correct[q.card.id] || 0) + 1;
    state.reviewed[q.card.id] = true;
    $("#feedback").textContent = "Richtig.";
  } else {
    button.classList.add("wrong");
    $("#feedback").textContent = `Nicht ganz. Richtige Antwort: ${q.card.answer}`;
  }
  saveState();
  setTimeout(() => { quizIndex++; renderQuizQuestion(); }, 1500);
}

function startExam() {
  examActive = true;
  renderQuiz();
  $(".quiz-card")?.classList.add("exam");
}

function renderTopics() {
  const cards = allCards();
  const topics = [...new Set(cards.map(c => c.topic))];
  app.innerHTML = `<div class="topic-grid">${topics.map(topic => {
    const count = cards.filter(c => c.topic === topic).length;
    const reviewed = cards.filter(c => c.topic === topic && state.reviewed[c.id]).length;
    return `<button class="topic-button" data-topic="${topic}"><strong>${topic}</strong><span>${count} Karten · ${reviewed} gelernt</span></button>`;
  }).join("")}</div>`;
  document.querySelectorAll("[data-topic]").forEach(b => b.onclick = () => setView("cards") || renderCards(b.dataset.topic));
  document.querySelectorAll("[data-topic]").forEach(b => b.onclick = () => renderCards(b.dataset.topic));
}

document.querySelectorAll(".nav-item").forEach(button => button.onclick = () => setView(button.dataset.view));
$("#resetProgress").onclick = () => {
  if (confirm("Den gesamten Lernfortschritt zurücksetzen?")) {
    state = structuredClone(defaultState);
    saveState();
    renderDashboard();
  }
};

$("#cardForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const form = new FormData(event.target);
  state.customCards.push({
    id: `custom-${Date.now()}`,
    topic: form.get("topic").trim(),
    question: form.get("question").trim(),
    answer: form.get("answer").trim()
  });
  saveState();
  $("#cardDialog").close();
  event.target.reset();
  renderCards();
});

setView("dashboard");
