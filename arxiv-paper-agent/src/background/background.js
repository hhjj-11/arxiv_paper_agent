importScripts(
  "../shared/constants.js",
  "../shared/prompt-templates.js",
  "./llm-provider.js",
  "./agent-registry.js"
);

const registry = self.ARXIV_AGENT_REGISTRY;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message?.type) {
    return false;
  }

  if (message.type === "GET_AGENT_CATALOG") {
    registry
      .getAgentCatalog()
      .then((catalog) => sendResponse({ ok: true, catalog }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "RUN_AGENT") {
    registry
      .runAgent(message.agentId, {
        selection: message.selection,
        pageContext: message.pageContext,
        sender
      })
      .then((result) => sendResponse({ ok: true, result }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "GET_API_STATUS") {
    chrome.storage.local.get(["arxivAgentLastApiCall"], (result) => {
      sendResponse({
        ok: true,
        lastApiCall: result.arxivAgentLastApiCall || null
      });
    });
    return true;
  }

  return false;
});
