const whitelistEl = document.getElementById("whitelist");
const inputEl = document.getElementById("whitelistInput");
const addBtn = document.getElementById("addWhitelistBtn");
const checkbox = document.getElementById("useDefaultList");
const customUrlInput = document.getElementById("customUrlInput");
const addCustomUrlBtn = document.getElementById("addCustomUrlBtn");
const customUrlList = document.getElementById("customUrlList");
const customUrlError = document.getElementById("customUrlError");
const syncListsButton = document.getElementById("syncListsButton");
const defaultListContainer = document.getElementById("defaultList");

const TROLL_LIST_URL = "https://raw.githubusercontent.com/unless7146/stardust3903/refs/heads/main/173732994.txt";

/*
 * useDefaultList
 */
chrome.storage.local.get(["useDefaultList", "defaultList"], (data) => {
    checkbox.checked = data.useDefaultList || true;
    const defaultList = data.defaultList || {
        url: TROLL_LIST_URL,
        lastSync: undefined,
        trolls: []
    }
    renderDefaultList(defaultList);
});

checkbox.addEventListener("change", () => {
    chrome.storage.local.set({
        useDefaultList: checkbox.checked,
    });
});


const renderDefaultList = (list) => {
    defaultListContainer.innerHTML = "";
    const li = document.createElement("li");
    li.classList.add("link-li");
    const contentDiv = document.createElement("div");

    const link = document.createElement("a");
    link.href = list.url
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = list.url;

    const syncEl = document.createElement("span");
    const trollCount = Array.isArray(list.trolls) ? list.trolls.length : 0;
    syncEl.textContent = `🕓 ${formatDate(list.lastSync)} • 👥 ${trollCount} aktroll`;
    syncEl.style.fontSize = "0.8rem";
    syncEl.style.color = "#666";
    syncEl.style.marginTop = "2px";

    contentDiv.appendChild(link);
    contentDiv.appendChild(syncEl);
    li.appendChild(contentDiv);
    defaultListContainer.appendChild(li);
};

/*
 * whitelist
 */

function renderWhitelist2() {
    chrome.storage.local.get(["whitelist"], (data) => {
        whitelistEl.innerHTML = "";
        (data.whitelist || []).forEach((name) => {
            const li = document.createElement("li");

            const link = document.createElement("a");
            link.href = `https://eksisozluk.com/biri/${encodeURIComponent(name)}`;
            link.textContent = name;
            link.target = "_blank";

            const removeBtn = document.createElement("button");
            removeBtn.textContent = "×";
            removeBtn.title = "beyaz listeden çıkar";
            removeBtn.onclick = () => {
                removeFromWhitelist(name);
            };
            removeBtn.style.marginLeft = "10px";
            removeBtn.style.cursor = "pointer";
            removeBtn.style.border = "none";
            removeBtn.style.background = "transparent";
            removeBtn.style.color = "#de2f42";
            removeBtn.style.fontSize = "16px";

            li.appendChild(link);
            li.appendChild(removeBtn);
            whitelistEl.appendChild(li);
        });
    });

}

function renderWhitelist() {
    chrome.storage.local.get(["whitelist"], (data) => {
        const container = document.getElementById("whitelist-container");
        container.innerHTML = "";
        const whitelist = (data.whitelist || []).sort((a, b) => a.localeCompare(b));
        whitelist.forEach((username, index) => {
            const wrapper = document.createElement("div");
            wrapper.className = "whitelist-user";

            const link = document.createElement("a");
            link.href = `https://eksisozluk.com/biri/${username}`;
            link.textContent = username;
            link.target = "_blank";
            link.rel = "noopener noreferrer";

            const removeBtn = document.createElement("button");
            removeBtn.textContent = "✕";
            removeBtn.onclick = () => {
                removeFromWhitelist(username);
            };

            wrapper.appendChild(link);
            wrapper.appendChild(removeBtn);
            container.appendChild(wrapper);
        });
    });
}

addBtn.onclick = () => {
    const name = inputEl.value.trim();
    if (!name) return;
    inputEl.value = "";
    inputEl.textContent = "";
    addToWhitelist(name);
};

function addToWhitelist(username) {
    username = username.trim();
    if (!username) return;

    chrome.runtime.sendMessage({type: "addToWhitelist", username}, (response) => {
        if (response?.success) {
            renderWhitelist(); // update the list in UI
            setTimeout(() => {
                renderCombinedTrollList(); // update combined troll list after delay
            }, 500); // 300ms delay
        }
    });
}

function removeFromWhitelist(username) {
    chrome.runtime.sendMessage({type: "removeFromWhitelist", username}, (response) => {
        if (response?.success) {
            renderWhitelist(); // update the list in UI
            setTimeout(() => {
                renderCombinedTrollList(); // update combined troll list after delay
            }, 500); // 300ms delay
        }
    });
}

/*
 * custom list
 */

chrome.storage.local.get(["customLists"], (data) => {
    renderCustomUrls(data.customLists || []);
});

const isValidUrl = (url) => {
    try {
        const parsed = new URL(url);
        const isTxt = parsed.href.endsWith(".txt");
        const isSozlukEntry = /^https:\/\/eksisozluk\.com\/entry\/\d+$/i.test(parsed.href);
        return (parsed.protocol === "https:" || parsed.protocol === "http:") && (isTxt || isSozlukEntry);
    } catch {
        return false;
    }
};

const renderCustomUrls = (customLists) => {
    customUrlList.innerHTML = "";
    customLists.forEach((list, idx) => {
        const li = document.createElement("li");
        li.classList.add("link-li");
        const contentDiv = document.createElement("div");

        const link = document.createElement("a");
        link.href = list.url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = list.url;

        const syncEl = document.createElement("span");
        const trollCount = Array.isArray(list.trolls) ? list.trolls.length : 0;
        syncEl.textContent = `🕓 ${formatDate(list.lastSync)} • 👥 ${trollCount} aktroll`;
        syncEl.style.fontSize = "1rem";
        syncEl.style.color = "#666";
        syncEl.style.marginTop = "2px";

        contentDiv.appendChild(link);
        contentDiv.appendChild(syncEl);

        const removeBtn = document.createElement("button");
        removeBtn.textContent = "✕";
        removeBtn.title = "bağlantıyı kaldır";
        removeBtn.onclick = () => {
            const confirmed = confirm("Bu bağlantıyı kaldırmak istediğinize emin misiniz?");
            if (!confirmed) return;

            const updated = customLists.filter((_, i) => i !== idx);
            chrome.storage.local.set({customLists: updated}, () => renderCustomUrls(updated));
        };

        li.appendChild(contentDiv);
        li.appendChild(removeBtn);
        customUrlList.appendChild(li);
    });
};


addCustomUrlBtn.onclick = () => {
    const url = customUrlInput.value.trim();
    chrome.storage.local.get(["customLists"], (data) => {
        const current = data.customLists || [];

        if (!isValidUrl(url)) {
            customUrlError.textContent = "geçersiz bağlantı. sadece .txt dosyası veya eksisozluk entry bağlantısı kabul edilir.";
            return;
        }

        if (current.includes(url)) {
            customUrlError.textContent = "bu bağlantı zaten eklenmiş.";
            return;
        }

        if (current.length >= 5) {
            customUrlError.textContent = "en fazla 5 bağlantı ekleyebilirsiniz.";
            return;
        }

        const newList = {
            url: url,
            lastSync: undefined,
            trolls: []
        }

        const updated = [...current, newList];
        chrome.storage.local.set({customLists: updated}, () => {
            customUrlInput.value = "";
            customUrlError.textContent = "";
            renderCustomUrls(updated);
        });
    });
};

syncListsButton.addEventListener("click", () => {
    const oldText = syncListsButton.textContent;
    syncListsButton.disabled = true;
    syncListsButton.textContent = "senkron ediliyor...";
    chrome.runtime.sendMessage({type: "syncTrollList"}, () => {
        renderCombinedTrollList(); // refresh textarea
        syncListsButton.disabled = false;
        syncListsButton.textContent = oldText;
        chrome.storage.local.get(["customLists"], (data) => {
            renderCustomUrls(data.customLists || []);
        });
    });
});


function formatDate(isoString) {
    if (!isoString) return "henüz senkronize edilmedi";
    const date = new Date(isoString);
    return date.toLocaleString("tr-TR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    });
}

/*
 * combined troll list
 */

function renderCombinedTrollList() {
    chrome.storage.local.get(["trollList"], (data) => {
        const list = (data.trollList || []).sort((a, b) => a.localeCompare(b));
        const container = document.getElementById("combinedList");
        container.innerHTML = ""; // clear previous

        list.forEach((username) => {
            const link = document.createElement("a");
            link.href = `https://eksisozluk.com/biri/${encodeURIComponent(username)}`;
            link.textContent = username;
            link.target = "_blank";

            container.appendChild(link);
            container.appendChild(document.createElement("br"));
        });
    });
}


// on load
renderWhitelist()
renderCombinedTrollList()
