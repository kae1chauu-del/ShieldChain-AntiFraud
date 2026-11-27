function sanitizeText(rawText) {
  return rawText
    .replace(/[A-Z][12]\d{8}/g, "[ID_MASKED]")
    .replace(/09\d{2}-?\d{3}-?\d{3}/g, "[PHONE_MASKED]")
    .replace(/\b\d{10,16}\b/g, "[ACCOUNT_MASKED]");
}

function scanPageContent() {
  const sanitized = sanitizeText(document.body.innerText || "");
  const title = document.title || "";

  if (
    title.includes("網路銀行") ||
    sanitized.includes("跨行轉帳") ||
    sanitized.includes("確認匯款金額")
  ) {
    chrome.runtime.sendMessage({
      type: "REPORT_EVENT",
      payload: {
        eventType: "BANK_TRANSFER",
        summary: "偵測到進入網路銀行轉帳頁面"
      }
    });
    return;
  }

  if (
    sanitized.includes("內部VIP操盤軟體") ||
    sanitized.includes("點擊下載APK") ||
    sanitized.includes("165列管高風險網域")
  ) {
    chrome.runtime.sendMessage({
      type: "REPORT_EVENT",
      payload: {
        eventType: "FAKE_PLATFORM",
        summary: "偵測到非官方投資平台與可疑下載連結"
      }
    });
    return;
  }

  const hasHighReturnClaim = /(保證獲利|穩賺不賠|飆股內線|老師帶單)/.test(sanitized);
  const hasExternalLure = /(加入LINE群組|點擊領取明牌|免費進群)/.test(sanitized);

  if (hasHighReturnClaim && hasExternalLure) {
    chrome.runtime.sendMessage({
      type: "REPORT_EVENT",
      payload: {
        eventType: "SCAM_KEYWORD",
        summary: "偵測到誇大投資報酬與引導加群話術"
      }
    });
  }
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "SHOW_WARNING") {
    renderSeniorWarningUI(msg.stage, msg.history);
  }
});

function renderSeniorWarningUI(stage, history) {
  const existing = document.getElementById("shieldchain-overlay-host");
  if (existing) existing.remove();

  const host = document.createElement("div");
  host.id = "shieldchain-overlay-host";
  document.body.appendChild(host);
  const shadow = host.attachShadow({ mode: "open" });

  const speakAlert = (text) => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = "zh-TW";
      utter.rate = 0.9;
      window.speechSynthesis.speak(utter);
    }
  };

  if (stage === 1) {
    shadow.innerHTML = `
      <div style="position:fixed;top:0;left:0;width:100%;background:#FEF08A;color:#854D0E;border-bottom:4px solid #CA8A04;padding:18px 24px;z-index:2147483647;font-family:sans-serif;display:flex;justify-content:space-between;align-items:center;box-shadow:0 4px 12px rgba(0,0,0,0.2);">
        <div style="font-size:22px;font-weight:bold;">
          ⚠️ 【銀盾鏈提醒 — Stage 1 接觸誘導】網頁出現「保證獲利、加群組」常見詐騙話術，請勿輕易相信！
        </div>
        <button id="close-btn" style="font-size:20px;padding:8px 18px;background:#CA8A04;color:white;border:none;border-radius:8px;cursor:pointer;font-weight:bold;">我知道了</button>
      </div>
    `;
    shadow.getElementById("close-btn").onclick = () => host.remove();
  } else if (stage >= 2) {
    const isStage3 = stage === 3;
    const titleText = isStage3
      ? "🛑 緊急阻斷！請立即停止轉帳操作（Stage 3 高風險）"
      : "🚨 高度警戒！疑似假投資詐騙平台（Stage 2 信任誘導）";
    const descText = isStage3
      ? "系統偵測您剛接觸過「高風險投資群組」，現在開啟網路銀行極可能落入詐騙集團轉帳陷阱！系統已同步通知您的家人。"
      : "您正進入未經金管會核准之可疑投資下載頁面，切勿下載不明軟體或輸入個人帳密！系統已同步發送聯防警報給家人。";

    speakAlert(isStage3 ? "緊急警告！請先暫停轉帳！這可能是假投資詐騙，系統已通知您的家人。" : "警告！這是高風險投資網站，請勿下載不明軟體。");

    shadow.innerHTML = `
      <div style="position:fixed;inset:0;background:rgba(127,29,29,0.95);color:white;z-index:2147483647;font-family:sans-serif;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:32px;text-align:center;">
        <div style="background:#991B1B;border:4px solid #FCA5A5;border-radius:20px;padding:40px;max-width:780px;box-shadow:0 20px 50px rgba(0,0,0,0.5);">
          <div style="font-size:34px;font-weight:900;color:#FEF08A;margin-bottom:20px;">${titleText}</div>
          <p style="font-size:25px;line-height:1.6;margin-bottom:28px;">${descText}</p>
          <div style="background:rgba(0,0,0,0.3);padding:16px;border-radius:12px;font-size:18px;text-align:left;margin-bottom:28px;">
            <strong>📋 偵測到之跨階段行為鏈軌跡（已去識別化）：</strong><br/>
            ${history.map((h) => `• [${h.time}] Stage ${h.stage}：${h.detail}`).join("<br/>")}
          </div>
          <div style="display:flex;gap:20px;justify-content:center;flex-wrap:wrap;">
            <button id="call-family-btn" style="font-size:24px;font-weight:bold;padding:16px 32px;background:#16A34A;color:white;border:none;border-radius:12px;cursor:pointer;">
              📞 一鍵聯繫家人確認（已發送通知）
            </button>
            <button id="dismiss-btn" style="font-size:20px;padding:16px 24px;background:transparent;color:#FCA5A5;border:2px solid #FCA5A5;border-radius:12px;cursor:pointer;">
              我已確認安全，暫時關閉警告
            </button>
          </div>
        </div>
      </div>
    `;
    shadow.getElementById("call-family-btn").onclick = () => {
      alert("【家庭聯防模擬】已撥打緊急聯絡人電話，並將去識別化風險階段摘要推播至子女 LINE 儀表板！");
    };
    shadow.getElementById("dismiss-btn").onclick = () => host.remove();
  }
}

setTimeout(scanPageContent, 500);