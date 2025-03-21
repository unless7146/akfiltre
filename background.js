const TROLL_LIST_URL = "https://raw.githubusercontent.com/unless7146/stardust3903/refs/heads/main/173732994.txt";

async function fetchTrollList() {
    const response = await fetch(TROLL_LIST_URL);
    if (!response.ok) throw new Error("Failed to fetch troll list");
    const text = await response.text();
    const list = text
        .split("\n")
        .map(line => line.trim())
        .filter(line => line && !line.startsWith("#"));
    return list;
}

async function syncTrollList() {
    try {
        const newList = await fetchTrollList();
        const newHash = JSON.stringify(newList);

        chrome.storage.local.get(["trollListHash"], (data) => {
            const oldHash = data.trollListHash || "";

            if (oldHash !== newHash) {
                chrome.storage.local.set({
                    trollList: newList,
                    trollListHash: newHash,
                    trollListLastUpdate: Date.now(),
                    trollListSize: newList.length
                }, () => {
                    console.log("troll list updated from GitHub.");
                });
            } else {
                console.log("troll list is already up to date.");
            }
        });
    } catch (err) {
        console.error("error updating troll list:", err);
    }
}

chrome.runtime.onStartup.addListener(syncTrollList);
chrome.runtime.onInstalled.addListener(syncTrollList);

chrome.alarms.create("updateTrollList", {periodInMinutes: 60 * 24}); // recheck every 24 hours
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "updateTrollList") {
        syncTrollList();
    }
});

chrome.tabs.onActivated.addListener(() => {
    updateBadgePause()
});

chrome.runtime.onMessage.addListener((message, sender) => {
    if (message.type === "updateBadge") {
        chrome.storage.local.get(["trollList", "paused"], (data) => {
            if (data.paused) return;
            chrome.action.setBadgeText({
                text: message.count > 0 ? message.count.toString() : ""
            });
            chrome.action.setBadgeBackgroundColor({color: "#efb73e"});
            chrome.storage.local.set({blockedThisPage: message.count});
            chrome.storage.local.get(["totalBlocked"], (data) => {
                const total = data.totalBlocked || 0;
                chrome.storage.local.set({totalBlocked: total + message.count});
            });
        });
    } else if (message.type == "updateBadgeOnToggle") {
        updateBadgePause()
    }

});

async function updateBadgePause() {
    chrome.storage.local.get(["paused"], (data) => {
        chrome.action.setBadgeBackgroundColor({
            color: [0, 0, 0, 0] // Fully transparent black
        });
        if (data.paused) {
            chrome.action.setBadgeText({text: "⏸"});
        } else {
            chrome.action.setBadgeText({text: ""});
        }
    });
}



