const TROLL_LIST_URL = "https://raw.githubusercontent.com/unless7146/stardust3903/main/173732994.txt";

//cache
const topicCreatorCache = new Map();
const CACHE_DURATION = 1000 * 60 * 60 * 24; // 24 hour cache
const MAX_CACHE_SIZE = 500;

// rate limiter for creator info
const RATE_LIMIT_CREATOR_INFO = 300;
const limit = createRateLimiter(RATE_LIMIT_CREATOR_INFO);

chrome.runtime.onStartup.addListener(syncTrollList);
chrome.runtime.onInstalled.addListener(syncTrollList);
chrome.runtime.onStartup.addListener(cleanTopicCreatorCache);

chrome.alarms.create("updateTrollList", { periodInMinutes: 60 * 24 }); // recheck every 24 hours
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
        (async () => {
            const { paused, totalBlocked = 0 } = await storageGet(["paused", "totalBlocked"]);
            if (paused) return;
            chrome.action.setBadgeText({ text: message.count > 0 ? String(message.count) : "" });
            chrome.action.setBadgeBackgroundColor({ color: "#efb73e" });
            await storageSet({ blockedThisPage: message.count, totalBlocked: totalBlocked + message.count });
        })();
    } else if (message.type === "updateBadgeOnToggle") {
        updateBadgePause();
    } else if (message.type === "syncTrollList") {
        syncTrollList().then(() => sendResponse({ success: true })); // send response after sync
        return true; // needed to use async sendResponse
    } else if (message.type === "addToWhitelist") {
        (async () => {
            const { whitelist = [] } = await storageGet(["whitelist"]);
            const set = new Set(whitelist);
            set.add(normalizeUsername(message.username));
            await storageSet({ whitelist: Array.from(set) });
            await combineTrollLists();
            sendResponse({ success: true });
        })();
        return true;
    } else if (message.type === "removeFromWhitelist") {
        (async () => {
            const { whitelist = [] } = await storageGet(["whitelist"]);
            const set = new Set(whitelist);
            set.delete(normalizeUsername(message.username));
            await storageSet({ whitelist: Array.from(set) });
            await combineTrollLists();
            sendResponse({ success: true });
        })();
        return true;
    } else if (message.type === 'getTopicCreator') {
        const { topicId } = message;
        const cached = topicCreatorCache.get(topicId);

        if (cached && (Date.now() - cached.timestamp < CACHE_DURATION)) {
            sendResponse({ author: cached.author });
            return;
        }

        fetchCreatorInfo(topicId)
            .then(author => {
                if (author && author != null) {
                    addToTopicCreatorCache(topicId, { author, timestamp: Date.now() });
                }
                sendResponse({ author });
            })
            .catch(error => {
                sendResponse({ error: error.message });
            });

        return true; // allow async sendResponse
    }
});

function addToTopicCreatorCache(topicId, data) {
    if (topicCreatorCache.size >= MAX_CACHE_SIZE) {
        // Delete the oldest entry (not optimal for true LRU)
        const oldestKey = topicCreatorCache.keys().next().value;
        topicCreatorCache.delete(oldestKey);
    }
    topicCreatorCache.set(topicId, data);
}


async function updateBadgePause() {
    const { paused } = await storageGet(["paused"]);
    chrome.action.setBadgeBackgroundColor({ color: [0, 0, 0, 0] });
    if (paused) {
        await storageSet({ blockedThisPage: 0 });
        chrome.action.setBadgeText({ text: "⏸" });
    } else {
        chrome.action.setBadgeText({ text: "" });
    }
}

async function fetchWithRetry(url, {tries=3, timeoutMs=8000} = {}) {
  for (let i=0; i<tries; i++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
      if (!res.ok) throw new Error(res.statusText);
      clearTimeout(t);
      return await res.text();
    } catch (e) {
      clearTimeout(t);
      if (i === tries - 1) throw e;
      await new Promise(r => setTimeout(r, 500 * (i+1))); // backoff
    }
  }
}

async function fetchTrollListUrl(url) {
    try {
        const textRaw = await fetchWithRetry(url);
        const text = textRaw.replace(/^\uFEFF/, ""); 
        const trolls = [];

        if (url.endsWith(".txt")) {
            text.split(/\r?\n/).forEach((line) => {
                const name = line.trim();
                if (name) trolls.push(normalizeUsername(name));
            });
        }

        if (/^https:\/\/eksisozluk\.com\/entry\/\d+$/i.test(url)) {
            const entryId = url.match(/\d+$/)?.[0];
            const usernames = extractBiriUsernamesFromEntryHTML(text, entryId);
            usernames.forEach(name => trolls.push(normalizeUsername(name)));
        }

        return Array.from(new Set(trolls));
    } catch (err) {
        console.warn(`list fetch failed from: ${url}`, err);
        const { defaultList } = await storageGet(["defaultList"]);
        return Array.isArray(defaultList?.trolls) ? defaultList.trolls : [];    
    }
}

function normalizeUsername(name) {
    return name.trim().replace(/\s+/g, "-").toLowerCase();
}

async function fetchAllTrollLists() {
    const data = await storageGet(["useDefaultList", "customLists", "defaultList"]);
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
            chrome.storage.local.set({ defaultList });
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
    await storageSet({ customLists });

    await storageSet({ trollListLastUpdate: Date.now() });

    // Merge trolls from all lists
    return Array.from(new Set(updatedLists.flatMap(l => l.trolls || [])));
}

function storageSet(obj) {
    return new Promise(res => chrome.storage.local.set(obj, res));
}

function storageGet(keys) {
    return new Promise(res => chrome.storage.local.get(keys, res));
}

function extractBiriUsernamesFromEntryHTML(html, entryId) {
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

function extractBiriUsernamesFromHTML(html) {
    const usernames = new Set();
    // Extract all /biri/ links inside the content
    const biriReg2 = /\/biri\/([^"'<> \n\r\t\/]+)/gi;
    let match;
    while ((match = biriReg2.exec(html)) !== null) {
        const username = decodeURIComponent(match[1])
            .toLowerCase()
            .trim()
            .replace(/\s+/g, ' ');
        usernames.add(username);
    }

    return [...usernames];
}

async function combineTrollLists() {
    const { useDefaultList = true, customLists = [], defaultList = { trolls: [] }, whitelist = [] } = await storageGet(["useDefaultList", "customLists", "defaultList", "whitelist"]);
    const whitelistSet = new Set(whitelist.map(u => u.toLowerCase()));
    const combined = [
        ...(useDefaultList && defaultList && Array.isArray(defaultList.trolls) ? defaultList.trolls : []),
        ...customLists.flatMap(list => Array.isArray(list.trolls) ? list.trolls : [])
    ];
    const trollSet = new Set(
        combined.map(name => name.trim().toLowerCase()).filter(name => name && !whitelistSet.has(name))
    );
    await storageSet({ trollList: Array.from(trollSet), trollListSize: trollSet.size });
}

async function syncTrollList() {
    await fetchAllTrollLists();
    await combineTrollLists()
}

function fetchCreatorInfo(topicId) {
    return limit(async () => {
        const url = `https://eksisozluk.com/topic/gettopiccreatorinfo?topicId=${topicId}&_=${Date.now()}`;
        const options = {
            method: "GET",
            headers: {
                "X-Requested-With": "XMLHttpRequest",
                "Accept": "application/json",
                "Content-Type": "application/json"
            }
        };

        try {
            const response = await fetch(url, options);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const html = await response.text();
            if (!html) throw new Error("Author not found in response");

            const usernames = extractBiriUsernamesFromHTML(html);
            return usernames?.[0] || "unknown";
        } catch (error) {
            console.error('Error fetching topic creator info:', topicId, error);
            return null;
        }
    });
}

function createRateLimiter(interval = 1000) {
    let queue = Promise.resolve();
    return function rateLimited(task) {
        const run = () => new Promise(res => setTimeout(res, interval)).then(task);
        queue = queue.then(run, run); // ensure errors don’t break the chain
        return queue;
    };
}


function cleanTopicCreatorCache() {
    const now = Date.now();
    for (const [topicId, { timestamp }] of topicCreatorCache.entries()) {
        if (now - timestamp > CACHE_DURATION) {
            topicCreatorCache.delete(topicId);
        }
    }
}
