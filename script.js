document.addEventListener("DOMContentLoaded", () => {
  // 1. Entrance Animations
  gsap.to(".header", { duration: 1, opacity: 1, y: 0, ease: "power3.out" });
  gsap.to(".input-section", {
    duration: 1,
    delay: 0.3,
    opacity: 1,
    y: 0,
    ease: "power3.out",
  });

  // 2. Element Selection
  const analyzeBtn = document.getElementById("analyzeBtn");
  const resetBtn = document.getElementById("resetBtn");
  const litInput = document.getElementById("litInput");
  const litResultOverlay = document.getElementById("litResultOverlay");

  const resultSection = document.getElementById("resultSection");
  const summaryText = document.getElementById("summaryText"); // Keeping for potential fallback
  const chartCanvas = document.getElementById("emotionChart").getContext("2d");
  const container = document.querySelector(".container");

  // Note Container (Moved to right panel)
  const noteBox = document.getElementById("noteContent"); // Assuming this exists in index.html (it doesn't yet, need to check structure)
  // Wait, the previous script injected the noteBox into aiAnalysisResult.
  // Since we are changing structure, we need to ensure the right panel has the note box.
  // The user wants INPUT area to transform.
  // The right panel (result section) should still exist for charts and notes?
  // Or does the user want notes UNDER specific lines? User said: "그 아래에 작은 글씨로 메모 해주는등" (Memo under small text)

  // Let's stick to the split view idea but mapped to the new input-transformation.
  // However, the user said "입력한 글을 띄워주고 ... 그 아래에 작은 글씨로 메모".
  // This implies in-line annotations or a very close proximity.
  // And "하단에 정리된 글에서 호버시... 반짝이는" implies connection.

  let emotionChartInstance = null;
  let currentAnalysis = null;

  // 4. Analysis Logic
  analyzeBtn.addEventListener("click", async () => {
    const text = litInput.value.trim();
    if (!text) return alert("내용을 입력해주세요.");

    // UI Transformation
    litInput.classList.add("hidden");
    litResultOverlay.classList.remove("hidden");
    resetBtn.classList.remove("hidden");
    analyzeBtn.classList.add("hidden");

    // Render Loading State
    setLoadingState(true);
    litResultOverlay.innerHTML = buildPoemSkeleton(text);

    // Show Result Graphs/Panels
    resultSection.classList.remove("hidden");
    document.querySelector(".container").classList.add("analysis-mode"); // Trigger Split View

    try {
      const prompt = buildAnalysisPrompt(text);
      const aiText = await requestGroqAnalysis(prompt);
      const analysis = parseJsonStrict(aiText);
      currentAnalysis = analysis;

      renderAnalysisFromJson(text, analysis);
    } catch (err) {
      setLoadingState(false);
      litResultOverlay.innerHTML = "";
      alert(`AI 분석 실패: ${err.message}`);
    }
  });

  resetBtn.addEventListener("click", () => {
    litInput.classList.remove("hidden");
    litResultOverlay.classList.add("hidden");
    resetBtn.classList.add("hidden");
    analyzeBtn.classList.remove("hidden");
    resultSection.classList.add("hidden");
    document.querySelector(".container").classList.remove("analysis-mode");
    currentAnalysis = null;
    setLoadingState(false);
  });

  async function getGroqApiKey() {
    if (window.GROQ_API_KEY) return window.GROQ_API_KEY;

    const response = await fetch("key", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("API 키 파일을 불러올 수 없습니다.");
    }

    const key = (await response.text()).trim();
    if (!key) {
      throw new Error("API 키가 비어 있습니다.");
    }

    return key;
  }

  async function requestGroqAnalysis(fullprompt) {
    const API_URL = "https://api.groq.com/openai/v1/chat/completions";
    const apiKey = await getGroqApiKey();

    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-120b",
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You are a literary analysis engine. Return JSON only. No markdown, no extra text.",
          },
          { role: "user", content: fullprompt },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Groq API 호출 실패 (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || "";
  }

  function buildAnalysisPrompt(text) {
    return `
당신은 문학 작품 분석 엔진입니다.
반드시 JSON만 출력하십시오. 설명, 마크다운, 코드 블록을 포함하지 마십시오.
응답은 아래 스키마를 정확히 따르십시오.

{
  "meta": {
    "title": "작품명",
    "genre": "갈래",
    "form": "형식",
    "pov": "시점/화자",
    "style": "운율 또는 문체",
    "themes": ["주제1", "주제2"]
  },
  "overall": {
    "coreEmotion": "핵심 정서 (한 단어)",
    "speakerAttitude": "화자의 태도",
    "oneLineSummary": "한 문장 요약"
  },
  "emotionFlow": [
    {
      "unitIndex": 1,
      "unitText": "연/문단 원문",
      "emotion": "정서 이름",
      "score": 0,
      "evidence": "이 정서 판단의 근거가 되는 구체 표현"
    }
  ],
  "highlights": [
    {
      "text": "원문 중 강조할 정확한 문자열",
      "function": "해당 표현의 문학적 기능 설명",
      "type": "유형 (예: 심상, 상징, 반복법, 정서 강화)"
    }
  ],
  "keyPhrases": [
    {
      "text": "핵심 표현",
      "meaning": "문학적 의미 설명"
    }
  ],
  "devices": [
    {
      "name": "표현 기법 이름",
      "description": "기법의 효과/의미"
    }
  ],
  "motifs": [
    {
      "text": "모티프/이미지",
      "meaning": "의미/역할"
    }
  ]
}

하이라이트는 가능한 많이 추출하십시오. 한 작품에서 최소 10개 이상을 목표로 하고,
단어 단위가 아니라 구체적인 구절을 포함해 더 세밀하게 지정하십시오.
정서 흐름은 연/문단 단위로 반드시 나누고, 근거 표현을 직접 인용하십시오.

분석 대상 텍스트:
${text}
`;
  }

  function setLoadingState(isLoading) {
    if (!container) return;
    container.classList.toggle("is-loading", isLoading);
  }

  function buildPoemSkeleton(text) {
    const lines = text.split(/\n/).filter((line) => line.trim() !== "");
    const count = Math.min(Math.max(lines.length, 6), 14);
    const blocks = [];
    for (let i = 0; i < count; i += 1) {
      const width = 55 + ((i * 13) % 40);
      blocks.push(
        `<div class="skeleton skeleton-line" style="width:${width}%; animation-delay:${
          i * 0.08
        }s"></div>`
      );
    }
    return `<div class="skeleton-stack">${blocks.join("")}</div>`;
  }

  function parseJsonStrict(raw) {
    const trimmed = raw.trim();
    try {
      return JSON.parse(trimmed);
    } catch (err) {
      const start = trimmed.indexOf("{");
      const end = trimmed.lastIndexOf("}");
      if (start === -1 || end === -1 || end <= start) {
        throw new Error("JSON 형식이 아닙니다.");
      }
      const sliced = trimmed.slice(start, end + 1);
      try {
        return JSON.parse(sliced);
      } catch (innerErr) {
        throw new Error(`JSON 파싱 실패: ${innerErr.message}`);
      }
    }
  }

  function escapeHtml(value) {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function renderHighlightedText(text, highlights) {
    const safeHighlights = Array.isArray(highlights) ? highlights : [];
    const tokens = safeHighlights
      .filter((h) => h && h.text)
      .map((h, index) => ({
        token: `__HL_${index}__`,
        text: h.text,
        note: h.function || "",
        type: h.type || "highlight",
      }))
      .sort((a, b) => b.text.length - a.text.length);

    let raw = text;
    tokens.forEach((item) => {
      if (raw.includes(item.text)) {
        raw = raw.split(item.text).join(item.token);
      }
    });

    let escaped = escapeHtml(raw);
    tokens.forEach((item) => {
      const safeType = item.type.replace(/[^a-zA-Z0-9가-힣_-]+/g, "-");
      const cls = `highlight-word hl-${safeType}`;
      const span = `<span class="${cls}" data-note="${escapeHtml(
        item.note
      )}">${escapeHtml(item.text)}</span>`;
      escaped = escaped.split(item.token).join(span);
    });

    return escaped.replace(/\n/g, "<br>");
  }

  function setupHoverEffects() {
    const words = document.querySelectorAll(".highlight-word");

    words.forEach((word) => {
      word.addEventListener("mouseenter", (e) => {
        const keyword = e.target.innerText;
        const listItems = document.querySelectorAll("#highlightList li");
        listItems.forEach((item) => {
          const key = item.getAttribute("data-keyword") || "";
          if (key && (keyword.includes(key) || key.includes(keyword))) {
            item.classList.add("is-active");
            item.scrollIntoView({ block: "nearest", behavior: "smooth" });
          } else {
            item.classList.remove("is-active");
          }
        });
      });

      word.addEventListener("mouseleave", () => {
        const listItems = document.querySelectorAll("#highlightList li");
        listItems.forEach((item) => item.classList.remove("is-active"));
      });
    });
  }

  function renderEmotionChart(emotionFlow) {
    const flow = Array.isArray(emotionFlow) ? emotionFlow : [];
    if (emotionChartInstance) emotionChartInstance.destroy();
    const ctx = chartCanvas;

    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, "rgba(9, 132, 227, 0.5)");
    gradient.addColorStop(1, "rgba(255, 255, 255, 0.0)");

    emotionChartInstance = new Chart(ctx, {
      type: "line",
      data: {
        labels: flow.map((d) => `#${d.unitIndex}`),
        datasets: [
          {
            label: "정서 점수",
            data: flow.map((d) => d.score),
            borderColor: "#0984e3",
            backgroundColor: gradient,
            fill: true,
            tension: 0.35,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "nearest", intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (items) => {
                const item = items[0];
                const data = flow[item.dataIndex] || {};
                return `#${data.unitIndex || ""} ${data.emotion || ""}`;
              },
              label: (item) => {
                const data = flow[item.dataIndex] || {};
                const lines = [];
                if (data.score !== undefined) lines.push(`점수: ${data.score}`);
                if (data.unitText) lines.push(`문장: ${data.unitText}`);
                if (data.evidence) lines.push(`근거: ${data.evidence}`);
                return lines;
              },
            },
          },
        },
        scales: { x: { display: false }, y: { display: true } },
      },
    });
  }

  function renderMetadata(meta) {
    const resultGrid = document.querySelector(".analysis-grid");
    let metaCard = document.getElementById("metaCard");
    if (!metaCard) {
      metaCard = document.createElement("div");
      metaCard.id = "metaCard";
      metaCard.className = "card glass-panel meta-card";
      resultGrid.insertBefore(metaCard, resultGrid.firstChild);
    }

    const themes = Array.isArray(meta?.themes) ? meta.themes.join(", ") : "";

    metaCard.innerHTML = `
            <h3>작품 상세 정보</h3>
            <div class="meta-grid">
                <div class="meta-item">
                    <h5>작품명</h5>
                    <p>${meta?.title || ""}</p>
                </div>
                 <div class="meta-item">
                    <h5>갈래</h5>
                    <p>${meta?.genre || ""}</p>
                </div>
                 <div class="meta-item">
                    <h5>형식</h5>
                    <p>${meta?.form || ""}</p>
                </div>
                 <div class="meta-item">
                    <h5>시점/화자</h5>
                    <p>${meta?.pov || ""}</p>
                </div>
                 <div class="meta-item">
                    <h5>운율/문체</h5>
                    <p>${meta?.style || ""}</p>
                </div>
            </div>
            <div class="meta-item" style="margin-top: 1.5rem;">
                <h5>주제</h5>
                <p>${themes}</p>
            </div>
        `;
  }

  function renderOverallSummary(overall) {
    const summaryTarget = document.getElementById("overallSummary");
    if (!summaryTarget) return;
    summaryTarget.innerHTML = `
      <div><strong>핵심 정서</strong> ${overall?.coreEmotion || ""}</div>
      <div><strong>화자의 태도</strong> ${overall?.speakerAttitude || ""}</div>
      <div><strong>한 문장 요약</strong> ${overall?.oneLineSummary || ""}</div>
    `;
  }

  function renderKeyPhrases(keyPhrases) {
    const list = document.getElementById("keyPhraseList");
    if (!list) return;
    list.innerHTML = "";
    (Array.isArray(keyPhrases) ? keyPhrases : []).forEach((item) => {
      const li = document.createElement("li");
      li.innerHTML = `<strong>${item.text || ""}</strong>: ${item.meaning || ""}`;
      list.appendChild(li);
    });
  }

  function renderHighlightList(highlights) {
    const list = document.getElementById("highlightList");
    if (!list) return;
    list.innerHTML = "";
    (Array.isArray(highlights) ? highlights : []).forEach((item) => {
      const li = document.createElement("li");
      li.setAttribute("data-keyword", item.text || "");
      li.innerHTML = `<strong>${item.text || ""}</strong> (${item.type || ""}): ${item.function || ""}`;
      list.appendChild(li);
    });
  }

  function setupCrossHighlighting() {
    const highlights = document.querySelectorAll("#highlightList li");
    highlights.forEach((item) => {
      item.addEventListener("mouseenter", () => {
        const keyword = item.getAttribute("data-keyword");
        if (!keyword) return;
        const targets = document.querySelectorAll(".highlight-word");
        targets.forEach((t) => {
          const word = t.innerText;
          if (word.includes(keyword) || keyword.includes(word)) {
            t.classList.add("highlight-focused");
          }
        });
      });

      item.addEventListener("mouseleave", () => {
        const targets = document.querySelectorAll(".highlight-word");
        targets.forEach((t) => t.classList.remove("highlight-focused"));
      });
    });
  }

  function renderEvidenceList(devices, motifs) {
    const list = document.getElementById("evidenceList");
    if (!list) return;
    list.innerHTML = "";

    const deviceItems = Array.isArray(devices) ? devices : [];
    const motifItems = Array.isArray(motifs) ? motifs : [];

    deviceItems.forEach((item) => {
      const li = document.createElement("li");
      li.innerHTML = `<strong>[기법] ${item.name || ""}</strong>: ${item.description || ""}`;
      list.appendChild(li);
    });

    motifItems.forEach((item) => {
      const li = document.createElement("li");
      li.innerHTML = `<strong>[모티프] ${item.text || ""}</strong>: ${item.meaning || ""}`;
      list.appendChild(li);
    });
  }

  function renderAnalysisFromJson(text, analysis) {
    const highlightHtml = renderHighlightedText(text, analysis.highlights);
    litResultOverlay.innerHTML = highlightHtml;

    renderMetadata(analysis.meta || {});
    renderOverallSummary(analysis.overall || {});
    renderEmotionChart(analysis.emotionFlow || []);
    renderKeyPhrases(analysis.keyPhrases || []);
    renderHighlightList(analysis.highlights || []);
    renderEvidenceList(analysis.devices || [], analysis.motifs || []);

    setupHoverEffects();
    setupCrossHighlighting();
    setLoadingState(false);

  }
});
