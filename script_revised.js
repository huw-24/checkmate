/*
  CHECKMATE — MATCH RECORD

  0번 질문은 도입 질문입니다. 답변 후 MOVE LIST에 남지 않습니다.
  1~10번 질문이 실제 체스 진행입니다.

  질문이 시작되면 BLACK이 먼저 움직이고,
  답변을 제출하면 WHITE가 움직입니다.

  10번 질문에서는 BLACK의 마지막 수가 CHECKMATE가 됩니다.
  10번 답변 제출 후, 지금까지의 모든 수를 역순으로 되감아
  체스판을 정확히 시작 상태로 복원합니다.
*/

const PIECE_IMAGES = {
  white: {
    pawn: "./svg/wpawn.svg",
    rook: "./svg/wrook.svg",
    knight: "./svg/wknight.svg",
    bishop: "./svg/wbishop.svg",
    queen: "./svg/wqueen.svg",
    king: "./svg/wking.svg"
  },
  black: {
    pawn: "./svg/bpawn.svg",
    rook: "./svg/brook.svg",
    knight: "./svg/bknight.svg",
    bishop: "./svg/bbishop.svg",
    queen: "./svg/bqueen.svg",
    king: "./svg/bking.svg"
  }
};

const QUESTIONS = [
  "누군가를 미워한 적이 있나요? (이름이나 별명)",
  "그 사람을 떠올리면 가장 먼저 드는 생각은 무엇인가요?",
  "그 사람을 한 단어로 표현한다면? (~한 사람)",
  "그 사람의 어떤 모습이 그런 판단을 만들었나요?",
  "당신도 누군가에게 비슷한 모습으로 보인 적이 있을까요?",
  "그렇다면 당신은 왜 그런 모습을 보였나요?",
  "그 사람이 자신의 행동을 변명한다면, 뭐라고 말할까요?",
  "그 말을 들은 당신은 어떤 생각이 들까요?",
  "그 사람들이 당신을 한 단어로 표현한다면? (~한 사람)",
  "당신이 누군가를 판단하는 기준과, 누군가 당신을 판단하는 기준은 얼마나 닮아 있을까요? (0~100%)",
  "" // 10번 질문은 2번 답변을 넣어 아래 함수에서 만듭니다.
];

function questionForTurn(index) {
  if (index !== 10) return QUESTIONS[index];
  const previousAnswer = String(answers[2] || "").trim();
  if (!previousAnswer) {
    return "당신이 그 사람에게 붙인 표현은 정말 그 사람만을 설명하나요?";
  }
  const last = Array.from(previousAnswer).at(-1) || "";
  const code = last.charCodeAt(0);
  const hasBatchim = code >= 0xAC00 && code <= 0xD7A3 && (code - 0xAC00) % 28 !== 0;
  return `${previousAnswer}${hasBatchim ? "이란" : "란"} 단어는 정말 그 사람만을 설명하나요?`;
}

/*
  시작 배치.
  정석 시작 포지션이 아니라 작품의 시안처럼 이미 진행된 상태입니다.

  보드의 화면상 좌표는 A~H가 세로, 1~8이 가로입니다.
  내부에서는 아래의 좌표를 그대로 사용합니다.
*/
const START_POSITION = [
  // BLACK
  { color: "black", type: "king", square: "g8" },
  { color: "black", type: "bishop", square: "b7" },
  { color: "black", type: "queen", square: "f7" },
  { color: "black", type: "pawn", square: "g7" },
  { color: "black", type: "rook", square: "e5" },
  { color: "black", type: "pawn", square: "h5" },
  { color: "black", type: "pawn", square: "c3" },

  // WHITE
  { color: "white", type: "pawn", square: "b4" },
  { color: "white", type: "queen", square: "d4" },
  { color: "white", type: "pawn", square: "g4" },
  { color: "white", type: "pawn", square: "h3" },
  { color: "white", type: "king", square: "h2" },
  { color: "white", type: "bishop", square: "d1" },
  { color: "white", type: "rook", square: "g1" }
];

/*
  1~10번 질문의 실제 진행.

  질문 → BLACK
  답변 → WHITE

  백은 흑의 폰을 연속해서 잡으며 점점 우세해 보입니다.
  10번 질문에서 BLACK Qg2#가 들어갑니다.

  중요한 점:
  이 수순은 현재 사이트의 좌표 체계에서도 실제 이동 가능한 수순이며,
  마지막 Qg2는 h1의 백 킹에 체크메이트를 만듭니다.
*/
const TURN_MOVES = [
  { black: ["f7", "c7"], white: ["d1", "b3"] },
  { black: ["g8", "h8"], white: ["h2", "g3"] },
  { black: ["e5", "d5"], white: ["g3", "h4"] },
  { black: ["c7", "e7"], white: ["g4", "g5"] },
  { black: ["d5", "d4"], white: ["g1", "g4"] },
  { black: ["h5", "g4"], white: ["b3", "d5"] },
  { black: ["b7", "d5"], white: ["h3", "g4"] },
  { black: ["e7", "e1"], white: ["h4", "h5"] },
  { black: ["e1", "h1"], white: ["h5", "g6"] },
  { black: ["h1", "h7"], white: null, mate: true }
];

const board = document.getElementById("chessBoard");
const moveList = document.getElementById("moveList");
const timer = document.getElementById("timer");
const progress = document.getElementById("progress");
const boardHeading = document.getElementById("boardHeading");
const blackPlayerAnswer = document.querySelector(".player.black span");
const timerUnit = document.getElementById("timerUnit");

const position = new Map();
const initialPositionSnapshot = START_POSITION.map(piece => ({ ...piece }));

let captured = { white: [], black: [] };
let currentQuestion = 0;
let answers = Array(QUESTIONS.length).fill("");
let moveHistory = [];
let advancing = false;
let rollingBack = false;
let typingTimer = null;
let typingToken = 0;

START_POSITION.forEach(piece => position.set(piece.square, { ...piece }));


/* ---------------- LOCAL RECEIPT SUMMARY (NO API) ---------------- */
// No external requests, API keys, or character-prefix truncation.
// The summary is rule-based: it cannot understand every free-form Korean sentence.
const RECEIPT_MAX_CHARS = 10;
let receiptSummary = null;
let receiptSummaryPromise = null;

function cleanReceiptInput(value) {
  return String(value ?? "").normalize("NFKC")
    .replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim();
}
function countReceiptChars(value) { return Array.from(String(value ?? "")).length; }
function extractPosition(value) {
  const match = cleanReceiptInput(value).match(/(?:100|[0-9]{1,2})\s*%?/);
  return match ? `${Number(match[0].replace(/[^0-9]/g, ""))}%` : "-";
}

// Match semantic clues across the WHOLE answer, not only its first characters.
// More specific expressions come before general ones.
const RECEIPT_PATTERNS = {
  named: [
    [/이기적|자기중심|자기\s*생각만|자기밖에|본인밖에/, "자기중심적인 사람"],
    [/무책임|책임\s*(?:회피|전가)|남\s*탓/, "무책임한 사람"],
    [/거짓말|거짓|속이|기만/, "거짓된 사람"],
    [/무례|예의\s*없|버릇없|막말/, "무례한 사람"],
    [/고집|독선|우기/, "고집 센 사람"],
    [/차갑|냉정|냉담|무심/, "냉담한 사람"],
    [/예민|까다롭|날카롭/, "예민한 사람"],
    [/오만|거만|잘난\s*척/, "오만한 사람"],
    [/질투|시기/, "질투하는 사람"],
    [/불친절|불친절/, "불친절한 사람"],
    [/배려\s*없|배려하지|배려가\s*없/, "배려 없는 사람"],
    [/회피|피하|도망/, "회피하는 사람"],
    [/소심|겁이\s*많/, "소심한 사람"],
    [/위선|가식|앞뒤가\s*다르/, "가식적인 사람"],
  ],
  opening: [
    [/말\s*끊|말을\s*끊/, "말 끊는 태도"],
    [/말투|말\s*투|말을\s*세게|막말|험한\s*말/, "날 선 말투"],
    [/무시|깔보|업신여/, "반복된 무시"],
    [/남\s*탓|책임\s*전가|핑계/, "책임 회피"],
    [/약속.*(?:안|못|어기)|약속\s*어기/, "지키지 않은 약속"],
    [/거짓말|거짓|속였|속이/, "거짓된 말"],
    [/뒷담|험담|뒤에서/, "뒤에서 한 말"],
    [/자기\s*생각만|자기\s*말만|자기밖에/, "일방적인 태도"],
    [/비난|욕설|욕을|욕했/, "공격적인 말"],
    [/비교|차별|편애/, "차별적인 태도"],
    [/연락.*(?:없|안|끊)|잠수/, "끊어진 연락"],
    [/배려|양보/, "부족한 배려"],
    [/화\s*내|화를\s*내|짜증/, "감정적인 반응"],
    [/눈치|시선/, "타인의 시선"],
    [/태도|행동/, "그 사람의 태도"],
  ],
  mirror: [
    [/무서|두려|겁이|불안/, "두려움"],
    [/상처|아팠|서운/, "상처받은 마음"],
    [/억울|오해/, "억울한 마음"],
    [/화가|화났|분노|짜증/, "쌓인 감정"],
    [/지치|힘들|피곤|스트레스/, "지친 마음"],
    [/방어|지키려|보호|상처받기\s*싫/, "자기방어"],
    [/인정받|잘\s*보이|칭찬/, "인정받고 싶은 마음"],
    [/눈치|시선|평가/, "타인의 시선"],
    [/질투|부러|시기/, "질투심"],
    [/외로|혼자|고립/, "외로움"],
    [/급했|바빴|시간\s*없/, "급했던 상황"],
    [/몰랐|모르겠|미숙/, "서툰 판단"],
    [/귀찮|관심\s*없/, "무관심"],
    [/그냥|이유\s*없|딱히/, "뚜렷하지 않은 이유"],
  ],
  returned: [
    [/예민|까다롭|날카롭/, "예민한 사람"],
    [/이기적|자기중심|자기밖에/, "자기중심적인 사람"],
    [/차갑|냉정|무심/, "차가운 사람"],
    [/무례|예의\s*없/, "무례한 사람"],
    [/소심|겁이\s*많/, "소심한 사람"],
    [/고집|독선/, "고집 센 사람"],
    [/무책임|남\s*탓/, "무책임한 사람"],
    [/착하|친절|다정/, "다정한 사람"],
    [/조용|말이\s*없/, "조용한 사람"],
    [/성급|급하|조급/, "성급한 사람"],
    [/까칠|퉁명/, "까칠한 사람"],
    [/완벽|꼼꼼/, "꼼꼼한 사람"],
    [/우유부단|결정\s*못/, "망설이는 사람"],
    [/무관심|관심\s*없/, "무관심한 사람"],
  ]
};

const RECEIPT_STOPWORDS = new Set([
  "그", "그냥", "사람", "그사람", "저", "나", "내", "제가", "나는", "내가", "그는", "그녀", "너무", "정말", "항상", "맨날", "자꾸", "많이", "조금", "약간", "뭔가", "같아", "같아요", "때문에", "그래서", "그런", "이런", "것", "거", "없어요", "있어요", "했어요", "합니다", "하는", "하고", "해서", "했는데", "아니", "아니요", "네", "예", "모르겠어요"
]);
function extractMeaningfulPhrase(raw) {
  const input = cleanReceiptInput(raw);
  if (!input) return "-";
  // Preserve a complete, short answer. Never take a prefix of a long sentence.
  if (countReceiptChars(input) <= RECEIPT_MAX_CHARS && !/[.!?]$/.test(input)) return input;
  const clauses = input.split(/[,.!?;:，。！？]|(?:하지만|그런데|그리고|그래서)/)
    .map(s => s.trim()).filter(Boolean);
  const chunks = [];
  for (const clause of clauses) {
    const stripped = clause.replace(/^(?:저는|제가|나는|내가|그 사람은|그사람은|항상|그냥)\s*/g, "")
      .replace(/(?:라고\s*생각해요|라고\s*생각합니다|인\s*것\s*같아요|인\s*것\s*같습니다|것\s*같아요|것\s*같습니다|했어요|합니다|이에요|예요|입니다|거든요|때문이에요|때문입니다)[.!?]*$/g, "")
      .trim();
    if (stripped && countReceiptChars(stripped) <= RECEIPT_MAX_CHARS && !RECEIPT_STOPWORDS.has(stripped)) chunks.push(stripped);
  }
  if (chunks.length) return chunks.sort((a,b) => countReceiptChars(b)-countReceiptChars(a))[0];
  const words = input.match(/[가-힣A-Za-z0-9]+/g) || [];
  const candidates = words.filter(w => w.length >= 2 && w.length <= RECEIPT_MAX_CHARS && !RECEIPT_STOPWORDS.has(w));
  // A single word is an honest extraction, not a fabricated interpretation.
  return candidates.sort((a,b) => b.length-a.length)[0] || "-";
}
function localReceiptPhrase(raw, field) {
  const input = cleanReceiptInput(raw);
  if (!input) return "-";
  for (const [pattern, phrase] of (RECEIPT_PATTERNS[field] || [])) {
    if (pattern.test(input)) return phrase;
  }
  return extractMeaningfulPhrase(input);
}
function generateReceiptSummary() {
  return {
    opponent: cleanReceiptInput(answers[0]) || "-",
    named: localReceiptPhrase(answers[2], "named"),
    opening: localReceiptPhrase(answers[3], "opening"),
    mirror: localReceiptPhrase(answers[5], "mirror"),
    returned: localReceiptPhrase(answers[8], "returned"),
    position: extractPosition(answers[9]),
    aiGenerated: false,
    localGenerated: true
  };
}
function normalizeReceiptSummary(summary) {
  return {
    opponent: cleanReceiptInput(summary?.opponent) || "-",
    named: cleanReceiptInput(summary?.named) || "-",
    opening: cleanReceiptInput(summary?.opening) || "-",
    mirror: cleanReceiptInput(summary?.mirror) || "-",
    returned: cleanReceiptInput(summary?.returned) || "-",
    position: cleanReceiptInput(summary?.position) || "-",
    aiGenerated: false,
    localGenerated: true
  };
}
function startReceiptSummaryGeneration() {
  if (receiptSummaryPromise) return receiptSummaryPromise;
  receiptSummaryPromise = Promise.resolve().then(() => {
    receiptSummary = normalizeReceiptSummary(generateReceiptSummary());
    window.latestReceiptData = receiptSummary;
    window.latestReceiptError = null;
    try { sessionStorage.setItem("matchReceiptSummary", JSON.stringify(receiptSummary)); } catch (_) {}
    return receiptSummary;
  });
  return receiptSummaryPromise;
}

/* ---------------- NIIMBOT B1 PRINT ---------------- */

// NIIMBOT B1 (203 dpi) + 50×80 mm label.
// The B1 printhead is 384 dots wide (about 48 mm); use the full printable width
// and 640 px height for an 80 mm-long label at 203 dpi.
const B1_MODEL = {
  name_prefixes: ["B1"],
  task: "b1",
  density: 3,
  label_type: 1,
  speed: 1
};
const B1_LABEL = {
  w_px: 384,
  h_px: 640,
  offset_y_px: 4,
  dpi: 203
};

let b1Connected = false;
let b1Printing = false;

const b1ConnectButton = document.getElementById("b1ConnectButton");
const b1Status = document.getElementById("b1Status");

function setB1Status(message, connected = b1Connected) {
  if (b1Status) {
    b1Status.textContent = message;
    // Hide the small status label after the printer connects.
    b1Status.style.display = connected ? "none" : "";
  }
  if (b1ConnectButton) {
    b1ConnectButton.classList.toggle("connected", connected);
    b1ConnectButton.textContent = connected ? "B1 CONNECTED" : "CONNECT B1";
    // Only show the connect button while the printer is not connected.
    b1ConnectButton.hidden = Boolean(connected);
  }
}

async function connectB1() {
  if (!window.Niimbot) {
    throw new Error("NIIMBOT driver를 불러오지 못했습니다. 인터넷 연결을 확인하세요.");
  }
  if (!Niimbot.isSupported()) {
    throw new Error("Web Bluetooth를 사용할 수 없습니다. Chrome/Edge에서 localhost로 실행하세요.");
  }

  setB1Status("SELECT B1…", false);
  const info = await Niimbot.identify(B1_MODEL);
  if (info?.modelId != null && info.modelId !== 4096) {
    await Niimbot.disconnect();
    throw new Error(`연결된 기기가 B1이 아닙니다: ${info.label || info.modelId}`);
  }
  b1Connected = true;
  setB1Status(`READY · ${info?.label || "NIIMBOT B1"}`, true);
  console.log("B1 CONNECTED", info);
  window.dispatchEvent(new Event("match-printer-connected"));
}

if (b1ConnectButton) {
  b1ConnectButton.addEventListener("click", async () => {
    if (b1Printing) return;
    b1ConnectButton.disabled = true;
    try {
      await connectB1();
    } catch (error) {
      b1Connected = false;
      setB1Status("B1 ERROR · CHECK CONSOLE", false);
      console.error("B1 connection failed:", error);
    } finally {
      b1ConnectButton.disabled = false;
    }
  });
}

function buildReceiptData(summary) {
  // Layout is fixed. Local summarizer supplies these five values; opponent is Q0 verbatim.
  return {
    opponent: String(answers[0] || summary?.opponent || "-").trim(),
    named: String(summary?.named || "").trim(),
    opening: String(summary?.opening || "").trim(),
    mirror: String(summary?.mirror || "").trim(),
    returned: String(summary?.returned || "").trim(),
    position: String(summary?.position || "").trim()
  };
}

function fitCanvasText(ctx, text, maxWidth, startSize, minSize = 10, weight = 700) {
  const value = String(text || "-").trim() || "-";
  let size = startSize;
  do {
    ctx.font = `${weight} ${size}px Arial, "Noto Sans KR", sans-serif`;
    if (ctx.measureText(value).width <= maxWidth || size <= minSize) break;
    size -= 1;
  } while (size > minSize);
  return { value, size };
}

async function renderReceiptToDataURL(receipt) {
  const canvas = document.createElement("canvas");
  canvas.width = B1_LABEL.w_px;
  canvas.height = B1_LABEL.h_px;
  const ctx = canvas.getContext("2d");

  // 50×80 mm label: 384×640 dots, with a safe margin on both sides.
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#000";
  ctx.textBaseline = "alphabetic";

  const left = 30;
  const right = canvas.width - 30;
  const maxContentWidth = right - left;

  // Header with clear breathing room above the names.
  ctx.font = '800 22px Arial, "Noto Sans KR", sans-serif';
  ctx.fillText("MATCH RECORD", left, 82);
  ctx.font = '500 15px Arial, "Noto Sans KR", sans-serif';
  ctx.fillText("WHITE :: ME", left, 120);
  const opponent = fitCanvasText(ctx, `BLACK :: ${receipt.opponent}`, maxContentWidth, 15, 10, 500);
  ctx.font = `500 ${opponent.size}px Arial, "Noto Sans KR", sans-serif`;
  ctx.fillText(opponent.value, left, 143);

  ctx.setLineDash([5, 5]);
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(left, 174); ctx.lineTo(right, 174); ctx.stroke();
  ctx.setLineDash([]);

  const rows = [
    ["01", "NAMED", String(receipt.named || "-")],
    ["02", "OPENING", String(receipt.opening || "-")],
    ["03", "MIRROR", String(receipt.mirror || "-")],
    ["04", "RETURNED", String(receipt.returned || "-")],
    ["05", "POSITION", String(receipt.position || "-")]
  ];
  // Compact, evenly spaced rows. Fit text to the remaining width rather than
  // slicing it at an arbitrary character count (which made phrases look cut off).
  const ys = [218, 260, 302, 344, 386];
  rows.forEach(([num, label, value], i) => {
    const y = ys[i];
    ctx.font = '500 13px Arial, "Noto Sans KR", sans-serif';
    ctx.fillText(num, left, y);
    ctx.fillText(label, 76, y);
    ctx.fillText("···", 166, y);
    const fitted = fitCanvasText(ctx, value, right - 204, 14, 8, 500);
    ctx.font = `500 ${fitted.size}px Arial, "Noto Sans KR", sans-serif`;
    ctx.fillText(fitted.value, 204, y);
  });

  ctx.setLineDash([5, 5]);
  ctx.beginPath(); ctx.moveTo(left, 416); ctx.lineTo(right, 416); ctx.stroke();
  ctx.setLineDash([]);

  // Status is one line, followed by a deliberate two-line gap and the caption.
  const status = fitCanvasText(ctx, "MATCH :: NO WINNER", maxContentWidth, 15, 10, 800);
  ctx.font = `800 ${status.size}px Arial, "Noto Sans KR", sans-serif`;
  ctx.fillText(status.value, left, 452);

  ctx.font = '700 14px Arial, "Noto Sans KR", sans-serif';
  ctx.fillText("All Moves Lead Back", left, 500);

  // Three user-provided black chess SVGs, bottom-aligned and right-aligned.
  // Sizes are relative to the knight: pawn smaller, queen larger.
  // Leave about 1.5 mm (~9 printer dots) between each image.
  // Paths are relative to index.html; keep the user's ./svg files in place.
  const pieceBottom = 602;
  const pieces = [
    { src: "./svg/bpawn.svg", x: 218, width: 30, height: 50 },
    { src: "./svg/bknight.svg", x: 257, width: 40, height: 66 },
    { src: "./svg/bqueen.svg", x: 306, width: 48, height: 80 }
  ];
  await Promise.all(pieces.map(async ({ src, x, width, height }) => {
    try {
      const img = new Image();
      img.src = src;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });
      ctx.drawImage(img, x, pieceBottom - height, width, height);
    } catch (error) {
      console.warn(`Could not load ${src} for the receipt footer.`, error);
    }
  }));

  return canvas.toDataURL("image/png");
}

async function printReceiptToB1(receipt) {
  if (!b1Connected) {
    console.warn("B1 is not connected. Click CONNECT B1 once before starting the match.");
    setB1Status("NOT PRINTED · CONNECT B1", false);
    return false;
  }
  if (!window.Niimbot) return false;

  const imageUrl = await renderReceiptToDataURL(receipt);
  b1Printing = true;
  if (b1ConnectButton) b1ConnectButton.disabled = true;
  try {
    await Niimbot.printImage(imageUrl, {
      model: B1_MODEL,
      size: B1_LABEL,
      density: 3,
      copies: 1,
      onProgress: status => setB1Status(`B1 · ${String(status).toUpperCase()}`, true)
    });
    setB1Status("PRINT COMPLETE", true);
    console.log("B1 PRINT COMPLETE", receipt);
    return true;
  } catch (error) {
    console.error("B1 print failed:", error);
    b1Connected = false;
    window.dispatchEvent(new Event("match-printer-disconnected"));
    setB1Status("PRINT ERROR · CHECK CONSOLE", true);
    return false;
  } finally {
    b1Printing = false;
    if (b1ConnectButton) b1ConnectButton.disabled = false;
  }
}

// The receipt prints automatically after the final answer; no preview dialog.
async function triggerReceiptPrint(summary) {
  if (!summary || summary.localGenerated !== true) {
    console.error("Receipt not printed: local summary unavailable", window.latestReceiptError);
    return;
  }
  const receipt = buildReceiptData(normalizeReceiptSummary(summary));
  receipt.localGenerated = true;
  window.latestReceiptData = receipt;
  window.dispatchEvent(new CustomEvent('match-receipt-ready', { detail: receipt }));
  if (!window.matchDevicesReady) {
    setB1Status('NOT PRINTED · DEVICES OFFLINE', false);
    return;
  }
  try { await printReceiptToB1(receipt); }
  catch (error) { console.error('Receipt print flow failed:', error); }
}


/* ---------------- BOARD ---------------- */

function squareToCoord(square) {
  return {
    row: square.charCodeAt(0) - 97,
    col: Number(square[1]) - 1
  };
}

function coordToSquare(row, col) {
  return String.fromCharCode(97 + row) + (col + 1);
}

function getPiece(square) {
  return position.get(square);
}

function renderBoard() {
  board.innerHTML = "";

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const squareName = coordToSquare(row, col);
      const cell = document.createElement("div");
      cell.className = "square " + ((row + col) % 2 === 0 ? "light" : "dark");
      cell.dataset.square = squareName;

      const piece = getPiece(squareName);
      if (piece) {
        const image = document.createElement("img");
        image.className = "piece";
        image.src = PIECE_IMAGES[piece.color][piece.type];
        image.alt = `${piece.color} ${piece.type}`;
        image.draggable = false;
        cell.appendChild(image);
      }

      board.appendChild(cell);
    }
  }
}

function pathClear(a, b) {
  const stepR = Math.sign(b.row - a.row);
  const stepC = Math.sign(b.col - a.col);
  let row = a.row + stepR;
  let col = a.col + stepC;

  while (row !== b.row || col !== b.col) {
    if (getPiece(coordToSquare(row, col))) return false;
    row += stepR;
    col += stepC;
  }
  return true;
}

/*
  현재 보드의 좌표 체계는 A~H가 세로, 1~8이 가로이므로
  pawn의 전진 방향은 row가 아니라 rank(col) 방향입니다.
*/
function isLegalMove(from, to, piece) {
  if (!piece) return false;

  const a = squareToCoord(from);
  const b = squareToCoord(to);
  const dr = b.row - a.row;
  const dc = b.col - a.col;
  const adr = Math.abs(dr);
  const adc = Math.abs(dc);
  const target = getPiece(to);

  if (target && target.color === piece.color) return false;

  switch (piece.type) {
    case "king":
      return adr <= 1 && adc <= 1 && adr + adc > 0;

    case "knight":
      return (adr === 2 && adc === 1) || (adr === 1 && adc === 2);

    case "bishop":
      return adr === adc && pathClear(a, b);

    case "rook":
      return (dr === 0 || dc === 0) && pathClear(a, b);

    case "queen":
      return ((dr === 0 || dc === 0) || adr === adc) && pathClear(a, b);

    case "pawn": {
      const direction = piece.color === "white" ? 1 : -1;
      const startRank = piece.color === "white" ? 1 : 6;

      if (dr === 0 && !target && dc === direction) return true;

      if (dr === 0 && !target && a.col === startRank && dc === direction * 2) {
        return !getPiece(coordToSquare(a.row, a.col + direction));
      }

      return adr === 1 && dc === direction && !!target && target.color !== piece.color;
    }

    default:
      return false;
  }
}

function clonePiece(piece) {
  return piece ? { ...piece } : null;
}

function performMove(from, to, expectedColor, options = {}) {
  const piece = getPiece(from);
  if (!piece || piece.color !== expectedColor) {
    console.error("Move failed: wrong piece/color", from, to, expectedColor);
    return null;
  }

  const target = getPiece(to);
  if (target && target.color === piece.color) {
    console.error("Move failed: own piece on target", from, to);
    return null;
  }

  if (!isLegalMove(from, to, piece)) {
    console.error("Move failed: illegal move", from, to, piece);
    return null;
  }

  const move = {
    color: piece.color,
    type: piece.type,
    from,
    to,
    piece: clonePiece(piece),
    captured: clonePiece(target),
    mate: !!options.mate
  };

  // 이동 전 DOM 위치를 기억해 실제 체스말이 칸 사이를 이동하는 모습을 보여준다.
  const fromCell = board.querySelector(`[data-square="${from}"]`);
  const toCell = board.querySelector(`[data-square="${to}"]`);
  const movingImage = fromCell?.querySelector(".piece");
  const targetImage = toCell?.querySelector(".piece");
  // Use untransformed board-local coordinates: viewport rectangles are rotated.
  const fromRect = fromCell ? {left:fromCell.offsetLeft, top:fromCell.offsetTop, width:fromCell.offsetWidth, height:fromCell.offsetHeight} : null;
  const toRect = toCell ? {left:toCell.offsetLeft, top:toCell.offsetTop, width:toCell.offsetWidth, height:toCell.offsetHeight} : null;
  let animation = null;

  if (movingImage && fromRect && toRect) {
    const ghost = movingImage.cloneNode(true);
    ghost.className = "piece moving-piece";
    ghost.style.position = "absolute";
    ghost.style.left = `${fromRect.left + fromRect.width * 0.1}px`;
    ghost.style.top = `${fromRect.top + fromRect.height * 0.1}px`;
    ghost.style.width = `${fromRect.width * 0.8}px`;
    ghost.style.height = `${fromRect.height * 0.8}px`;
    ghost.style.zIndex = "20";
    ghost.style.pointerEvents = "none";
    ghost.style.transition = "transform 520ms cubic-bezier(.2,.75,.25,1)";
    board.appendChild(ghost);

    movingImage.style.visibility = "hidden";
    if (targetImage) targetImage.style.visibility = "hidden";

    const dx = (toRect.left - fromRect.left);
    const dy = (toRect.top - fromRect.top);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        ghost.style.transform = `translate(${dx}px, ${dy}px)`;
      });
    });

    animation = {
      ghost,
      movingImage,
      targetImage,
      duration: 560
    };
  }

  if (target) captured[target.color].push({ ...target, square: to });

  position.delete(from);
  position.set(to, piece);
  moveHistory.push(move);

  const finish = () => {
    animation?.ghost.remove();
    renderBoard();
    renderCaptured();
    options.onComplete?.();
  };

  if (animation) {
    setTimeout(finish, animation.duration);
  } else {
    finish();
  }

  return move;
}

/* ---------------- CAPTURED PIECES ---------------- */

function renderCaptured() {
  const white = document.getElementById("capturedWhite");
  const black = document.getElementById("capturedBlack");
  white.replaceChildren();
  black.replaceChildren();

  // Keep the initial off-board pieces in their original display order.
  // Captured pieces are appended AFTER them, in actual capture order,
  // rather than being re-sorted into the middle by piece type.
  const initialOrder = {
    black: ["pawn","rook","bishop","pawn","queen","knight","pawn","bishop","rook","pawn","knight","pawn","queen","bishop","pawn","rook","knight","pawn"],
    white: ["bishop","pawn","knight","rook","pawn","queen","bishop","pawn","rook","knight","pawn","bishop","pawn","queen","rook","pawn","knight","pawn"]
  };
  function drawRow(container, color) {
    const missing = getOffBoardPieces(color);
    const buckets = {};
    missing.forEach(piece => (buckets[piece.type] ??= []).push(piece));
    for (const type of initialOrder[color]) {
      const piece = buckets[type]?.shift();
      if (piece) addCaptured(container, piece, true);
    }
    Object.values(buckets).forEach(bucket => bucket.forEach(piece => addCaptured(container, piece, true)));
    // New captures always appear at the far right of the row.
    captured[color].forEach(piece => addCaptured(container, piece, false));
  }
  drawRow(white, "white");
  drawRow(black, "black");
}

function getOffBoardPieces(color) {
  const counts = {
    king: 1,
    queen: 1,
    rook: 2,
    bishop: 2,
    knight: 2,
    pawn: 8
  };

  const onBoard = {
    king: 0, queen: 0, rook: 0, bishop: 0, knight: 0, pawn: 0
  };

  position.forEach(piece => {
    if (piece.color === color && onBoard[piece.type] !== undefined) {
      onBoard[piece.type] += 1;
    }
  });

  const capturedCount = {
    king: 0, queen: 0, rook: 0, bishop: 0, knight: 0, pawn: 0
  };

  captured[color].forEach(piece => {
    if (capturedCount[piece.type] !== undefined) capturedCount[piece.type] += 1;
  });

  const result = [];
  Object.keys(counts).forEach(type => {
    const missing = Math.max(0, counts[type] - onBoard[type] - capturedCount[type]);
    for (let i = 0; i < missing; i += 1) {
      result.push({ color, type });
    }
  });
  return result;
}

function addCaptured(container, piece, offBoard = false) {
  const image = document.createElement("img");
  image.className = `captured-piece${offBoard ? " off-board-piece" : ""}`;
  image.src = PIECE_IMAGES[piece.color][piece.type];
  image.alt = `${piece.color} ${piece.type}`;
  container.appendChild(image);
}

/* ---------------- QUESTIONS / MOVE LIST ---------------- */

function parseQuestion(raw) {
  const match = raw.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  if (!match) return { text: raw, hint: "" };
  return { text: match[1], hint: match[2] };
}

function initMoveList() {
  moveList.innerHTML = "";
  progress.textContent = "0 / 10";
  appendActiveRow(0, true);
}

function appendActiveRow(index, intro = false) {
  const row = document.createElement("div");
  row.className = `move-row active${intro ? " first-question" : ""}`;
  row.dataset.question = index;

  const no = document.createElement("div");
  no.className = "move-no";
  no.textContent = index;
  row.appendChild(no);
  row.appendChild(buildActiveCell(index));
  moveList.appendChild(row);

  const input = row.querySelector(".answer-inline");
  const question = row.querySelector(".question");

  if (intro) {
    boardHeading.textContent = "Black to Move";
    typeQuestion(question, question?.dataset.fullText || "", input, () => {
      if (input) {
        input.disabled = false;
        input.removeAttribute("aria-hidden");
        sizeAnswerInput(input);
        input.focus();
      }
    });
    return;
  }

  playBlackTurn(index, row, () => {
    typeQuestion(question, question?.dataset.fullText || "", input, () => {
      if (input) {
        input.disabled = false;
        input.removeAttribute("aria-hidden");
        sizeAnswerInput(input);
        input.focus();
      }
    });
  });
}

function buildActiveCell(index) {
  const cell = document.createElement("div");
  cell.className = "move-cell active-cell";

  const line1 = document.createElement("div");
  line1.className = "move-line1";

  const blackNotation = document.createElement("span");
  blackNotation.className = "notation";
  blackNotation.textContent = "";

  const dots1 = document.createElement("span");
  dots1.className = "dots";
  dots1.textContent = "";

  const { text: questionText, hint } = parseQuestion(questionForTurn(index));
  const question = document.createElement("span");
  question.className = "question typing";
  question.dataset.fullText = questionText;
  question.textContent = "";

  line1.append(blackNotation, dots1, question);

  const line2 = document.createElement("div");
  line2.className = "move-line2";

  const input = document.createElement("input");
  input.type = "text";
  input.className = "answer-inline";
  input.placeholder = hint || "답변";
  input.value = answers[index] || "";
  input.disabled = true;
  input.setAttribute("aria-hidden", "true");

  input.addEventListener("input", () => {
    answers[index] = input.value;
    sizeAnswerInput(input);
  });

  input.addEventListener("keydown", event => {
    if (event.key !== "Enter" || event.isComposing || event.keyCode === 229) return;
    event.preventDefault();

    if (index === 0) {
      submitIntro(input);
    } else {
      submitAnswer(index, input);
    }
  });

  const dots2 = document.createElement("span");
  dots2.className = "dots";
  dots2.textContent = "";

  const whiteNotation = document.createElement("span");
  whiteNotation.className = "notation muted";
  whiteNotation.textContent = "";

  line2.append(input, dots2, whiteNotation);
  cell.append(line1, line2);
  return cell;
}

function typeQuestion(questionEl, text, input, done) {
  if (typingTimer) clearInterval(typingTimer);
  const token = ++typingToken;
  const chars = Array.from(text || "");
  let i = 0;

  if (questionEl) {
    questionEl.textContent = "";
    questionEl.classList.add("typing");
  }

  typingTimer = setInterval(() => {
    if (token !== typingToken) {
      clearInterval(typingTimer);
      return;
    }

    i += 1;
    if (questionEl) questionEl.textContent = chars.slice(0, i).join("");

    if (i >= chars.length) {
      clearInterval(typingTimer);
      typingTimer = null;
      if (questionEl) questionEl.classList.remove("typing");

      if (currentQuestion === 10) {
        boardHeading.textContent = "Checkmate";
      } else {
        boardHeading.textContent = "White to Move";
      }

      done?.();
    }
  }, 30);
}

function submitIntro(input) {
  if (!window.matchDevicesReady || advancing || rollingBack) return;

  advancing = true;
  answers[0] = input.value;
  input.disabled = true;
  typeBlackAnswer(input.value);

  const row = moveList.querySelector(".move-row.active");

  setTimeout(() => {
    row?.remove();
    document.body.classList.remove("pre-start");
    document.body.classList.add("match-started");
    currentQuestion = 1;
    progress.textContent = "1 / 10";
    advancing = false;
    appendActiveRow(1);
  }, 250);
}

function submitAnswer(index, input) {
  if (!window.matchDevicesReady || advancing || rollingBack) return;

  advancing = true;
  answers[index] = input.value;
  input.disabled = true;
  setRemainingTurns(10 - index);

  const row = moveList.querySelector(`.move-row.active[data-question="${index}"]`);
  const dots = row?.querySelector(".move-line2 .dots");
  const whiteNotation = row?.querySelector(".move-line2 .notation");

  // 10번은 백의 수를 두지 않습니다.
  // 이미 Qg2#가 들어간 상태에서 답변 제출 → 롤백.
  if (index === 10) {
    if (dots) dots.textContent = "";
    if (whiteNotation) whiteNotation.textContent = "";

    // 마지막 질문/답변도 1~9번과 동일하게 완료된 기보 행으로 접습니다.
    // 10번째 수에는 WHITE의 응수가 없으므로 오른쪽 칸은 비워 둡니다.
    collapseActiveRow(row, index);

    // 마지막 답변이 확정되면 로컬 규칙 기반 영수증 요약을 생성합니다.
    // 롤백 애니메이션이 진행되는 동안 API 요청이 처리됩니다.
    startReceiptSummaryGeneration();

    boardHeading.textContent = "Checkmate";
    document.body.classList.add("is-checkmate");

    setTimeout(() => {
      advancing = false;
      finishMatchWithRollback();
    }, 420);
    return;
  }

  playWhiteTurn(index, row, () => {
    collapseActiveRow(row, index);
    currentQuestion = index + 1;
    progress.textContent = `${currentQuestion} / 10`;
    advancing = false;
    appendActiveRow(currentQuestion);
  });
}

// Flash only the origin and destination squares before moving.
// The board itself never auto-tilts; mouse hover tilt remains CSS-controlled.
function cueBoardBeforeMove(from, to, callback) {
  board.querySelectorAll(".square.move-glow").forEach(cell => cell.classList.remove("move-glow"));
  const fromCell = board.querySelector(`[data-square="${from}"]`);
  const toCell = board.querySelector(`[data-square="${to}"]`);
  // Force a reflow so repeated moves restart the two-flash animation.
  void board.offsetWidth;
  fromCell?.classList.add("move-glow");
  toCell?.classList.add("move-glow");
  setTimeout(() => {
    fromCell?.classList.remove("move-glow");
    toCell?.classList.remove("move-glow");
    callback();
  }, 720);
}

function playBlackTurn(index, row, done) {
  const spec = TURN_MOVES[index - 1];
  if (!spec) {
    done?.();
    return;
  }

  const notationEl = row.querySelector(".move-line1 .notation");
  const dotsEl = row.querySelector(".move-line1 .dots");
  const [from, to] = spec.black;
  const notation = notationForPlannedMove(from, to, !!spec.mate);

  boardHeading.textContent = "Black to Move";
  typeNotation(notationEl, dotsEl, notation, () => {
    cueBoardBeforeMove(from, to, () => {
      const move = performMove(from, to, "black", { mate: !!spec.mate, onComplete: done });

      if (!move) {
        console.error(`BLACK move ${index} failed: ${from}-${to}`);
        done?.();
        return;
      }

      if (spec.mate) {
        boardHeading.textContent = "Checkmate";
      }
    });
  });
}

function playWhiteTurn(index, row, done) {
  const spec = TURN_MOVES[index - 1];
  if (!spec?.white) {
    done?.();
    return;
  }

  const notationEl = row.querySelector(".move-line2 .notation");
  const dotsEl = row.querySelector(".move-line2 .dots");
  const [from, to] = spec.white;
  const notation = notationForPlannedMove(from, to, false);

  boardHeading.textContent = "White to Move";
  typeNotation(notationEl, dotsEl, notation, () => {
    cueBoardBeforeMove(from, to, () => {
      const move = performMove(from, to, "white", { onComplete: done });

      if (!move) {
        console.error(`WHITE move ${index} failed: ${from}-${to}`);
        done?.();
        return;
      }
    });
  });
}

function typeNotation(notationEl, dotsEl, notation, done) {
  let step = 0;
  const chars = Array.from(notation || "");

  if (notationEl) notationEl.textContent = "";
  if (dotsEl) dotsEl.textContent = "";

  const timerId = setInterval(() => {
    step += 1;

    if (step <= 3) {
      if (dotsEl) dotsEl.textContent = ".".repeat(step);
      return;
    }

    const n = step - 3;
    if (notationEl) notationEl.textContent = chars.slice(0, n).join("");

    if (n >= chars.length) {
      clearInterval(timerId);
      setTimeout(done, 1000);
    }
  }, 55);
}

function notationForPlannedMove(from, to, mate = false) {
  const piece = getPiece(from);
  if (!piece) return to + (mate ? "#" : "");

  const prefix = piece.type === "pawn" ? "" : piece.type.charAt(0).toUpperCase();
  const capture = getPiece(to) ? "x" : "";
  return prefix + capture + to + (mate ? "#" : "");
}

function formatNotation(move) {
  if (!move) return "";
  const prefix = move.type === "pawn" ? "" : move.type.charAt(0).toUpperCase();
  const capture = move.captured ? "x" : "";
  return prefix + capture + move.to + (move.mate ? "#" : "");
}

function notationForHistoricalMove(pair) {
  if (!pair) return "";
  const [from, to] = pair;
  const move = moveHistory.find(item => item.from === from && item.to === to);
  return move ? formatNotation(move) : to;
}

function collapseActiveRow(rowEl, index) {
  if (!rowEl) return;

  rowEl.classList.remove("active");
  rowEl.classList.add("pair-row");
  rowEl.innerHTML = "";

  const no = document.createElement("div");
  no.className = "move-no";
  no.textContent = index;

  const turnIndex = index - 1;
  const black = document.createElement("div");
  black.className = "move-cell pair-cell";
  black.textContent = notationForHistoricalMove(TURN_MOVES[turnIndex].black);

  const white = document.createElement("div");
  white.className = "move-cell pair-cell";
  white.textContent = notationForHistoricalMove(TURN_MOVES[turnIndex].white);

  rowEl.append(no, black, white);
}

function sizeAnswerInput(input) {
  const text = input.value.length > 0 ? input.value : input.placeholder;
  const style = getComputedStyle(input);
  const canvas = sizeAnswerInput.canvas || (sizeAnswerInput.canvas = document.createElement("canvas"));
  const ctx = canvas.getContext("2d");
  ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  const width = ctx.measureText(text || "").width;
  input.style.width = Math.max(30, Math.ceil(width) + 14) + "px";
}

function typeBlackAnswer(text) {
  if (!blackPlayerAnswer) return;
  if (typeBlackAnswer.timer) clearInterval(typeBlackAnswer.timer);

  const value = text || "~";
  let i = 0;
  blackPlayerAnswer.textContent = "";

  typeBlackAnswer.timer = setInterval(() => {
    i += 1;
    blackPlayerAnswer.textContent = Array.from(value).slice(0, i).join("");

    if (i >= Array.from(value).length) {
      clearInterval(typeBlackAnswer.timer);
      typeBlackAnswer.timer = null;
    }
  }, 45);
}

/* ---------------- ROLLBACK ---------------- */

async function finishMatchWithRollback() {
  if (rollingBack || matchEnded) return;
  rollingBack = true;
  matchEnded = true;
  document.body.classList.add("is-checkmate", "is-rolling-back");
  boardHeading.textContent = "CHECKMATE!";

  if (typingTimer) clearInterval(typingTimer);
  typingTimer = null;
  typingToken += 1;

  // Replace the finished move list with the same single-tab layout as the intro.
  moveList.innerHTML = "";
  const ending = document.createElement("div");
  ending.className = "start-row ending-row";
  const message = document.createElement("span");
  message.textContent = "";
  ending.appendChild(message);
  moveList.appendChild(ending);
  progress.textContent = "10 / 10";

  // Type the message while the board rewinds, rather than after it finishes.
  const phrase = "ALL MOVES LEAD BACK.";
  let typed = 0;
  const textInterval = setInterval(() => {
    typed += 1;
    message.textContent = phrase.slice(0, typed);
    if (typed >= phrase.length) clearInterval(textInterval);
  }, 95);

  // Printing runs independently, so a slow printer cannot delay the rollback.
  const printing = (async () => {
    const summary = await (receiptSummaryPromise || startReceiptSummaryGeneration());
    await triggerReceiptPrint(summary);
  })().catch(error => console.error("Receipt failed:", error));

  while (moveHistory.length) {
    const move = moveHistory.pop();
    await undoMoveAnimated(move);
  }
  restoreInitialPosition();
  renderBoard();
  renderCaptured();
  board.classList.add("rollback-complete");
  boardHeading.textContent = "CHECKMATE";
  // Keep CHECKMATE visible throughout the closing rollback state.
  // Reset will restore the normal heading for the next participant.
  clearInterval(textInterval);
  message.textContent = phrase;

  // Hold the closing message briefly, then return to the first question.
  await Promise.all([wait(2200), printing]);
  resetMatchForNextParticipant();
}

function undoMoveAnimated(move) {
  return new Promise(resolve => {
    const fromCell = board.querySelector(`[data-square="${move.from}"]`);
    const toCell = board.querySelector(`[data-square="${move.to}"]`);
    const pieceImage = toCell?.querySelector("img.piece");

    const finish = () => {
      const movingPiece = getPiece(move.to);

      if (movingPiece) {
        position.delete(move.to);
        position.set(move.from, movingPiece);
      }

      if (move.captured) {
        position.set(move.to, { ...move.captured, square: move.to });

        const list = captured[move.captured.color];
        const index = list.findIndex(piece =>
          piece.color === move.captured.color &&
          piece.type === move.captured.type &&
          piece.square === move.to
        );

        if (index >= 0) list.splice(index, 1);
      }

      renderBoard();
      renderCaptured();
      resolve();
    };

    if (!fromCell || !toCell || !pieceImage) {
      finish();
      return;
    }

    const fromRect = {left:fromCell.offsetLeft, top:fromCell.offsetTop, width:fromCell.offsetWidth, height:fromCell.offsetHeight};
    const toRect = {left:toCell.offsetLeft, top:toCell.offsetTop, width:toCell.offsetWidth, height:toCell.offsetHeight};
    const dx = fromRect.left - toRect.left;
    const dy = fromRect.top - toRect.top;

    const clone = pieceImage.cloneNode(true);
    clone.className = "piece moving-piece";
    clone.style.position = "absolute";
    clone.style.left = `${toRect.left + toRect.width * 0.1}px`;
    clone.style.top = `${toRect.top + toRect.height * 0.1}px`;
    clone.style.width = `${toRect.width * 0.8}px`;
    clone.style.height = `${toRect.height * 0.8}px`;
    clone.style.zIndex = "20";
    clone.style.pointerEvents = "none";
    clone.style.transition = "transform 520ms cubic-bezier(.2,.75,.25,1)";

    board.appendChild(clone);
    pieceImage.style.visibility = "hidden";

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        clone.style.transform = `translate(${dx}px, ${dy}px)`;
      });
    });
    setTimeout(finish, 560);
  });
}

function restoreInitialPosition() {
  position.clear();
  initialPositionSnapshot.forEach(piece => {
    position.set(piece.square, { ...piece });
  });
  captured = { white: [], black: [] };
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/* ---------------- TIMER / MATCH STATE ---------------- */

// 실제 경과 시간이 아니라 10개의 질문이 소진되는 정도를 체스 시계처럼 보여줍니다.
let remainingTurns = 10;
let matchStarted = false;
let matchEnded = false;

function renderTimer() {
  timer.textContent = `${String(remainingTurns).padStart(2, "0")}:00`;
  if (timerUnit) timerUnit.textContent = "turns";
  timer.classList.toggle("time-up", remainingTurns === 0);
}

function setRemainingTurns(value) {
  remainingTurns = Math.max(0, Math.min(10, value));
  timer.classList.add("tick");
  setTimeout(() => {
    renderTimer();
    timer.classList.remove("tick");
  }, 150);
}

function beginMatchAfterIntro() {
  document.body.classList.remove("pre-start");
  document.body.classList.add("match-started");
}

// 참가자별 상태만 초기화합니다. NIIMBOT 연결 객체는 절대 건드리지 않습니다.
function resetMatchForNextParticipant() {
  if (typingTimer) clearInterval(typingTimer);
  typingTimer = null;
  typingToken += 1;
  if (typeBlackAnswer.timer) clearInterval(typeBlackAnswer.timer);
  typeBlackAnswer.timer = null;

  answers = Array(QUESTIONS.length).fill("");
  currentQuestion = 0;
  moveHistory = [];
  captured = { white: [], black: [] };
  advancing = false;
  rollingBack = false;
  matchStarted = true;
  matchEnded = false;
  remainingTurns = 10;
  receiptSummary = null;
  receiptSummaryPromise = null;
  window.latestReceiptData = null;
  window.latestReceiptError = null;

  document.body.classList.remove("match-started", "match-ended", "is-rolling-back", "is-checkmate", "pre-start");
  board.classList.remove("rollback-complete");
  restoreInitialPosition();
  renderBoard();
  renderCaptured();
  renderTimer();
  if (blackPlayerAnswer) blackPlayerAnswer.textContent = "~";
  boardHeading.textContent = "Black to Move";
  initMoveList();
  // 최초 화면과 동일하게 질문 영역만 밝게 표시합니다.
  document.body.classList.add("pre-start");
  // b1Connected, Niimbot 객체 및 B1 상태/버튼은 그대로 유지합니다.
}

function restartMatch() {
  resetMatchForNextParticipant();
}

// 시작용 PRESS ENTER 단계는 없습니다. Enter는 각 질문 입력칸에서만 사용합니다.

/* ---------------- INIT ---------------- */

renderBoard();
renderCaptured();
renderTimer();
matchStarted = true;

// 시작하자마자 0번 질문을 MOVE LIST에 보여줍니다.
// 주변은 자연스럽게 어두워지고, 0번 답변을 제출하면 다시 모두 밝아집니다.
initMoveList();
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    setTimeout(() => document.body.classList.add("pre-start"), 120);
  });
});



/* EXHIBITION DEVICE GATE — do not change poster layout or chess move logic. */
(() => {
  const gate = document.getElementById('deviceGate');
  const btn = document.getElementById('deviceGateButton');
  const msg = document.getElementById('deviceGateMessage');
  const ps = document.getElementById('printerGateStatus');
  const ms = document.getElementById('micGateStatus');
  let busy = false;
  let knownDevice = null;
  window.matchDevicesReady = false;
  const update = () => {
    const micOK = !!window.MatchMic?.isConnected();
    ps.textContent = `● PRINTER · ${b1Connected ? 'READY' : 'OFFLINE'}`;
    ms.textContent = `● MICROPHONE · ${micOK ? 'READY' : 'OFFLINE'}`;
    ps.classList.toggle('ready', b1Connected);
    ms.classList.toggle('ready', micOK);
  };
  const lock = (reason) => {
    const wasReady = window.matchDevicesReady;
    window.matchDevicesReady = false;
    gate.hidden = false;
    document.querySelectorAll('.answer-inline').forEach(el => el.disabled = true);
    if (reason) msg.textContent = reason;
    if (wasReady) {
      // A disconnected session must not silently resume mid-answer.
      document.getAnimations().forEach(animation => animation.pause());
    }
    update();
  };
  const unlock = () => {
    if (!b1Connected || !window.MatchMic?.isConnected()) return;
    window.matchDevicesReady = true;
    gate.hidden = true;
    document.getAnimations().forEach(animation => animation.play());
    // Restart safely if a connection was lost during a participant's session.
    resetMatchForNextParticipant();
    update();
    document.querySelector('.answer-inline:not([disabled])')?.focus();
  };
  const bindDevice = async () => {
    // NIIMBOT's driver owns its BLE device; listen to known public handles if exposed.
    const candidates = [window.Niimbot?.device, window.Niimbot?.bluetoothDevice, window.Niimbot?._device, window.Niimbot?.client?.device];
    const device = candidates.find(d => d?.addEventListener);
    if (device && device !== knownDevice) {
      knownDevice = device;
      device.addEventListener('gattserverdisconnected', () => {
        b1Connected = false;
        setB1Status('B1 DISCONNECTED', false);
        lock('프린터 연결이 끊어졌습니다. 장치를 다시 연결해 주세요.');
      });
    }
  };
  btn.addEventListener('click', async () => {
    if (busy) return;
    busy = true; btn.disabled = true;
    btn.firstChild.textContent = 'CONNECTING… ';
    try {
      // Bluetooth chooser must be opened from the user click.
      if (!b1Connected) {
        msg.textContent = '블루투스 목록에서 NIIMBOT B1을 선택해 주세요.';
        await connectB1();
      }
      await bindDevice();
      update();
      if (!window.MatchMic) throw Error('마이크 모듈을 불러오지 못했습니다.');
      if (!window.MatchMic.isConnected()) {
        msg.textContent = '마이크 사용 권한을 허용해 주세요.';
        await window.MatchMic.start();
      }
      if (!window.MatchMic.isConnected()) throw Error('마이크가 연결되지 않았습니다.');
      unlock();
    } catch (err) {
      console.error('Device setup failed:', err);
      lock(`연결 실패: ${err?.message || '장치를 확인해 주세요.'}`);
    } finally {
      busy = false; btn.disabled = false;
      btn.firstChild.textContent = 'CONNECT DEVICES ';
      update();
    }
  });
  window.addEventListener('match-microphone-disconnected', () => lock('마이크 연결이 끊어졌습니다. 다시 연결해 주세요.'));
  window.addEventListener('match-printer-connected', update);
  window.addEventListener('match-printer-disconnected', () => {
    b1Connected = false;
    lock('프린터 연결이 끊어졌습니다. 다시 연결해 주세요.');
  });
  // Check device state during operation; BLE driver APIs vary by version.
  setInterval(() => {
    if (!window.matchDevicesReady) return;
    if (!window.MatchMic?.isConnected()) lock('마이크 연결이 끊어졌습니다. 다시 연결해 주세요.');
    const dev = knownDevice;
    if (dev?.gatt && !dev.gatt.connected) {
      b1Connected = false;
      lock('프린터 연결이 끊어졌습니다. 다시 연결해 주세요.');
    }
  }, 800);
  update();
})();
