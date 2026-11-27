const RISK_STAGES = {
  NORMAL: 0,
  STAGE_1_LURE: 1,
  STAGE_2_GROOMING: 2,
  STAGE_3_TRANSFER: 3
};

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.session.set({
    riskState: { stage: 0, history: [], lastUpdated: Date.now() }
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "REPORT_EVENT") {
    handleBehaviorEvent(message.payload, sender.tab?.id).then(sendResponse);
    return true;
  }
  if (message.type === "RESET_STATE") {
    const resetData = { stage: 0, history: [], lastUpdated: Date.now() };
    chrome.storage.session.set({ riskState: resetData }).then(() => {
      sendResponse({ success: true, riskState: resetData });
    });
    return true;
  }
  if (message.type === "GET_STATE") {
    chrome.storage.session.get("riskState").then((res) => {
      sendResponse(res.riskState || { stage: 0, history: [], lastUpdated: Date.now() });
    });
    return true;
  }
});

async function handleBehaviorEvent(eventData, tabId) {
  const { riskState = { stage: 0, history: [], lastUpdated: 0 } } =
    await chrome.storage.session.get("riskState");

  const now = Date.now();
  if (now - riskState.lastUpdated > 2 * 60 * 60 * 1000) {
    riskState.stage = RISK_STAGES.NORMAL;
    riskState.history = [];
  }

  let nextStage = riskState.stage;

  if (eventData.eventType === "SCAM_KEYWORD" && riskState.stage < 1) {
    nextStage = RISK_STAGES.STAGE_1_LURE;
  } else if (eventData.eventType === "FAKE_PLATFORM" && riskState.stage >= 1) {
    nextStage = RISK_STAGES.STAGE_2_GROOMING;
  } else if (eventData.eventType === "BANK_TRANSFER" && riskState.stage >= 1) {
    nextStage = RISK_STAGES.STAGE_3_TRANSFER;
  }

  const effectiveStage = Math.max(nextStage, riskState.stage);

  if (nextStage > riskState.stage) {
    riskState.stage = nextStage;
    riskState.lastUpdated = now;
    riskState.history.push({
      stage: nextStage,
      trigger: eventData.eventType,
      detail: eventData.summary,
      time: new Date(now).toLocaleTimeString("zh-TW", { hour12: false })
    });
    await chrome.storage.session.set({ riskState });
  }

  if (tabId && effectiveStage > 0) {
    chrome.tabs.sendMessage(tabId, {
      type: "SHOW_WARNING",
      stage: effectiveStage,
      eventType: eventData.eventType,
      history: riskState.history
    }).catch(() => {});
  }

  return riskState;
}