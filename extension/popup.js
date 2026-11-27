function updatePopupUI(state) {
  const badge = document.getElementById("status-badge");
  const logBox = document.getElementById("history-log");

  const stageNames = [
    "安全守護中 (Stage 0)",
    "⚠️ Stage 1：接觸投資誘導",
    "🚨 Stage 2：進入高風險平台（已通知家人）",
    "🛑 Stage 3：轉帳阻斷警戒（已通知家人）"
  ];

  badge.className = `badge stage-${state.stage}`;
  badge.textContent = `目前狀態：${stageNames[state.stage]}`;

  if (state.history && state.history.length > 0) {
    logBox.innerHTML = state.history
      .map((item) => `<div style="margin-bottom:6px;"><strong>[${item.time}] Stage ${item.stage}</strong><br/>${item.detail}</div>`)
      .join("");
  } else {
    logBox.textContent = "尚無異常行為鏈紀錄（隱私保護模式運行中）";
  }
}

chrome.runtime.sendMessage({ type: "GET_STATE" }, (state) => {
  if (state) updatePopupUI(state);
});

document.getElementById("reset-btn").onclick = () => {
  chrome.runtime.sendMessage({ type: "RESET_STATE" }, (res) => {
    if (res?.riskState) updatePopupUI(res.riskState);
  });
};