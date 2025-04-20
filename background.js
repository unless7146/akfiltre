const TROLL_LIST_URL = "https://raw.githubusercontent.com/unless7146/stardust3903/refs/heads/main/173732994.txt";


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

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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
    } else if (message.type === "updateBadgeOnToggle") {
        updateBadgePause();
    } else if (message.type === "syncTrollList") {
        syncTrollList().then(() => sendResponse({success: true})); // send response after sync
        return true; // needed to use async sendResponse
    } else if (message.type === "addToWhitelist") {
        chrome.storage.local.get(["whitelist"], (data) => {
            const whitelist = new Set(data.whitelist || []);
            whitelist.add(normalizeUsername(message.username));
            chrome.storage.local.set({whitelist: Array.from(whitelist)}, () => {
                combineTrollLists();
                sendResponse({success: true});
            });
        });
        return true;
    } else if (message.type === "removeFromWhitelist") {
        chrome.storage.local.get(["whitelist"], (data) => {
            const whitelist = new Set(data.whitelist || []);
            whitelist.delete(normalizeUsername(message.username));
            chrome.storage.local.set({whitelist: Array.from(whitelist)}, () => {
                combineTrollLists();
                sendResponse({success: true});
            });
        });
        return true;
    }
});

async function updateBadgePause() {
    chrome.storage.local.get(["paused"], (data) => {
        chrome.action.setBadgeBackgroundColor({
            color: [0, 0, 0, 0] // Fully transparent black
        });
        if (data.paused) {
            chrome.storage.local.set({blockedThisPage: 0});
            chrome.action.setBadgeText({text: "⏸"});
        } else {
            chrome.action.setBadgeText({text: ""});
        }
    });
}

async function fetchTrollListUrl(url) {
    try {
        const response = await fetch(url);
        const text = await response.text();
        const trolls = [];

        if (url.endsWith(".txt")) {
            text.split(/\r?\n/).forEach((line) => {
                const name = line.trim();
                if (name) trolls.push(normalizeUsername(name));
            });
        }

        if (/^https:\/\/eksisozluk\.com\/entry\/\d+$/i.test(url)) {
            const entryId = url.match(/\d+$/)?.[0];
            const usernames = extractBiriUsernamesFromHTML(text, entryId);
            usernames.forEach(name => trolls.push(normalizeUsername(name)));
        }

        return Array.from(new Set(trolls));
    } catch (err) {
        console.warn(`list fetch failed from: ${url}`, err);
        return []; // fallback on failure
    }
}

function normalizeUsername(name) {
    return name.trim().replace(/\s+/g, "-").toLowerCase();
}

async function fetchAllTrollLists() {
    return new Promise((resolve) => {
        chrome.storage.local.get(["useDefaultList", "customLists", "defaultList"], async (data) => {
            const useDefault = data.useDefaultList ?? true;
            const customLists = data.customLists || [];
            const updatedLists = [...customLists];

            if (useDefault) {
                try {
                    const defaultTrolls = await fetchTrollListUrl(TROLL_LIST_URL);
                    const defaultList = {
                        url: TROLL_LIST_URL,
                        lastSync: Date.now(),
                        trolls: defaultTrolls
                    };
                    chrome.storage.local.set({defaultList});
                    updatedLists.unshift(defaultList); // put default first
                } catch (err) {
                    console.warn("Default list fetch failed:", err);
                }
            }

            // Fetch all custom lists
            for (const list of customLists) {
                try {
                    list.trolls = await fetchTrollListUrl(list.url);
                    list.lastSync = Date.now();
                } catch (err) {
                    console.warn(`Failed to update list: ${list.url}`, err);
                }
            }

            // Save updated customLists (excluding default)
            chrome.storage.local.set({customLists});

            // Merge trolls from all lists
            const allTrolls = updatedLists.flatMap(list => list.trolls || []);
            chrome.storage.local.set({trollListLastUpdate: Date.now()});
            resolve(Array.from(new Set(allTrolls)));
        });
    });
}

function extractBiriUsernamesFromHTML(html, entryId) {
    const usernames = new Set();

    // 1. Get the relevant <li> block for the given entry ID
    const liRegex = new RegExp(`<li[^>]*data-id="${entryId}"[^>]*>([\\s\\S]*?)<\\/li>`, 'i');
    const liMatch = html.match(liRegex);
    if (!liMatch) return [];

    const liContent = liMatch[1];

    // 2. Extract <div class="content"> inside that <li>
    const divRegex = /<div[^>]*class="[^"]*\bcontent\b[^"]*"[^>]*>([\s\S]*?)<\/div>/i;
    const divMatch = liContent.match(divRegex);
    if (!divMatch) return [];

    const divHtml = divMatch[1];

    // 3. Extract all /biri/ links inside the content
    const biriReg2 = /https:\/\/eksisozluk\.com\/biri\/([^"'<> \n\r\t\/]+)/gi;
    let match;
    while ((match = biriReg2.exec(divHtml)) !== null) {
        const username = decodeURIComponent(match[1])
            .toLowerCase()
            .trim()
            .replace(/\s+/g, ' ');
        usernames.add(username);
    }

    return [...usernames];
}

function combineTrollLists() {
    chrome.storage.local.get(["useDefaultList", "customLists", "defaultList", "whitelist"], (data) => {
        const {useDefaultList = true, customLists = [], defaultList = {trolls: []}, whitelist = []} = data;

        const whitelistSet = new Set(whitelist.map(u => u.toLowerCase()));

        const combined = [
            ...(useDefaultList && defaultList && Array.isArray(defaultList.trolls) ? defaultList.trolls : []),
            ...customLists.flatMap(list => Array.isArray(list.trolls) ? list.trolls : [])
        ];

        const trollSet = new Set(
            combined
                .map(name => name.trim().toLowerCase())
                .filter(name => name && !whitelistSet.has(name))
        );

        chrome.storage.local.set({trollList: Array.from(trollSet), trollListSize: trollSet.size});
    });
}

async function syncTrollList() {
    await fetchAllTrollLists();
    combineTrollLists()
}


