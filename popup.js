document.addEventListener("DOMContentLoaded", () => {
    const toggleBtn = document.getElementById("toggle");
    const pageCountEl = document.getElementById("page-count");
    const totalCountEl = document.getElementById("total-count");
    const trollListSize = document.getElementById("troll-count");
    const lastUpdateEl = document.getElementById("last-update");
    const trollModeSelect = document.getElementById("trollMode");
    const topicWarningToggle = document.getElementById("topicWarningToggle");
    const verEl = document.getElementById("ext-version");

    function updateStats() {
        chrome.storage.local.get(["paused", "totalBlocked", "blockedThisPage", "trollListLastUpdate", 'trollListSize'], (data) => {
            toggleBtn.textContent = data.paused ? "devam et" : "duraklat";
            toggleBtn.classList.toggle("paused", data.paused);
            pageCountEl.textContent = data.blockedThisPage || 0;
            totalCountEl.textContent = data.totalBlocked || 0;
            trollListSize.textContent = (data.trollListSize ?? 0).toString();

            const updatedAt = data.trollListLastUpdate;

            if (updatedAt) {
                const date = new Date(updatedAt);
                lastUpdateEl.textContent = date.toLocaleString("tr-TR", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                });
            } else {
                lastUpdateEl.textContent = "--";
            }
        });
    }

    toggleBtn.addEventListener("click", () => {
        chrome.storage.local.get(["paused"], (data) => {
            toggleBtn.disabled = true;
            const newState = !data.paused;
            chrome.storage.local.set({ paused: newState }, () => {
                toggleBtn.textContent = newState ? "devam et" : "duraklat";
                toggleBtn.classList.toggle("paused", newState);
                chrome.runtime.sendMessage({ type: "updateBadgeOnToggle", paused: newState });
                setTimeout(() => {
                    toggleBtn.disabled = false;
                }, 500);
            });
        });
    });

    chrome.storage.local.get(["trollMode"], (data) => {
        console.log("loaded trollMode", data.trollMode)
        trollModeSelect.value = data.trollMode || "hide";
    });

    trollModeSelect.addEventListener("change", () => {
        console.log("changed trollMode", trollModeSelect.value)
        chrome.storage.local.set({ trollMode: trollModeSelect.value });
    });

    chrome.storage.local.get(["showTrollTopicWarning"], (data) => {
        console.log("loaded showTrollTopicWarning", data.showTrollTopicWarning)
        topicWarningToggle.checked = data.showTrollTopicWarning !== false; // default true
    });

    topicWarningToggle.addEventListener("change", () => {
        console.log("changed showTrollTopicWarning", topicWarningToggle.checked)
        chrome.storage.local.set({ showTrollTopicWarning: topicWarningToggle.checked });
    });

    document.getElementById("open-config").addEventListener("click", () => {
        chrome.runtime.openOptionsPage();
    });

    chrome.storage.onChanged.addListener((changes) => {
        if (changes.trollListSize || changes.trollListLastUpdate ||
            changes.totalBlocked || changes.blockedThisPage || changes.paused) {
        updateStats();
        }
    });

    if (verEl) {
        const { version } = chrome.runtime.getManifest();
        verEl.textContent = `v${version}`;
    }

    updateStats();
});

