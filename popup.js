const toggleBtn = document.getElementById("toggle");
const pageCountEl = document.getElementById("page-count");
const totalCountEl = document.getElementById("total-count");
const trollListSize = document.getElementById("troll-count");
const lastUpdateEl = document.getElementById("last-update");

function updateStats() {
    chrome.storage.local.get(["paused", "totalBlocked", "blockedThisPage", "trollListLastUpdate", 'trollListSize'], (data) => {
        toggleBtn.textContent = data.paused ? "devam et" : "duraklat";
        toggleBtn.classList.toggle("paused", data.paused);
        pageCountEl.textContent = data.blockedThisPage || 0;
        totalCountEl.textContent = data.totalBlocked || 0;
        trollListSize.textContent = data.trollListSize || "";

        const updatedAt = data.trollListLastUpdate;

        if (updatedAt) {
            const date = new Date(updatedAt);
            lastUpdateEl.textContent = date.toLocaleString("tr-TR", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
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
        const newState = !data.paused;
        chrome.storage.local.set({ paused: newState }, () => {
            toggleBtn.textContent = newState ? "devam et" : "duraklat";
            toggleBtn.classList.toggle("paused", newState);
            chrome.runtime.sendMessage({ type: "updateBadgeOnToggle", paused: newState });
        });
    });
});


updateStats();