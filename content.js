let blockedCount = 0;

chrome.storage.local.get(["paused", "trollList", "trollMode", "showTrollTopicWarning"], (data) => {
    if (data.paused) return;

    const mode = data.trollMode || "hide";
    const showWarning = data.showTrollTopicWarning !== false;
    const trolls = (data.trollList || []).map(normalizeUsername);

    if (window.location.pathname.startsWith("/takip/") || window.location.pathname.startsWith("/takipci/")) {
        highlightTrollsInFollowList(trolls);
        return;
    }

    if (window.location.pathname.startsWith("/biri/")) {
        const userProfileTitle = document.querySelector("#user-profile-title");
        const username = userProfileTitle?.getAttribute("data-nick");
        injectWhitelistButton(normalizeUsername(username));
        if (trolls.includes(normalizeUsername(username))) {
            highlightTrollProfilePage()
        }
        return;
    }

    const isFirstPage = !window.location.search.includes('p=');
    const isEntryPage = window.location.pathname.startsWith("/entry/")
    const entries = document.querySelectorAll("li[data-author]");

    // block entries
    blockedCount = blockTrollEntries(entries, trolls || [], mode);

    // highlight topics
    if (showWarning) {
        if (!isEntryPage && entries.length > 0) {
            highlightTrollTopic(trolls, blockedCount);
        }
        if (document.querySelector('.main-left-frame')) {
            highlightTrollTopicsInLeftFrame(trolls);
        }
    }

    // observe popups
    observeAllFavoritePopups(trolls);

    chrome.runtime.sendMessage({type: "updateBadge", count: blockedCount});
});


function getTopicCreator(topicId) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
            {type: 'getTopicCreator', topicId},
            response => {
                if (response.error) {
                    reject(new Error(response.error));
                } else {
                    resolve(response.author);
                }
            }
        );
    });
}

function highlightTrollTopicsInLeftFrame(trolls) {
    const topicList = document.querySelector("ul.topic-list");
    if (!topicList) return;

    const topicLinks = topicList.querySelectorAll("a[href^='/']");

    topicLinks.forEach(link => {
        const topicId = link.getAttribute("href").match(/--(\d+)/)?.[1];
        if (!topicId) return;

        const li = link.closest('li');
        if (!li) return;

        getTopicCreator(topicId)
            .then(author => {
                if (author && trolls.includes(normalizeUsername(author))) {
                    li.style.fontStyle = 'italic';
                    li.style.opacity = '0.6';
                    li.style.backgroundColor = 'rgba(255, 255, 0, 0.1)';
                    li.style.padding = '4px';
                    li.style.borderRadius = '4px';
                    const warningIcon = document.createElement('span');
                    li.firstElementChild.appendChild(warningIcon);
                }
            })
            .catch(ex => {
                console.log(ex);
            });
    });
}

function highlightTrollProfilePage() {
    const container = document.querySelector("#nick-container");
    if (container) {
        const warning = document.createElement("div");
        warning.textContent = "⚠️  bu yazar troll listesinde";
        warning.style.backgroundColor = "rgba(255, 255, 0, 0.2)";
        warning.style.border = "1px dashed #de2f42";
        warning.style.borderRadius = "4px";
        warning.style.padding = "6px 10px";
        warning.style.marginTop = "8px";
        warning.style.marginLeft = "16px";
        warning.style.fontSize = "inherit";
        warning.style.color = "inherit";
        warning.style.display = "inline-block";

        container.appendChild(warning);
    }

}

function injectWhitelistButton(username) {
    const container = document.querySelector(".sub-title-menu.profile-buttons");
    if (!container || !username) return;

    // Avoid duplicate buttons
    if (container.querySelector(".akblock-whitelist-btn")) return;

    const button = document.createElement("button");
    button.className = "btn-white-list-aktrollblocker";

    const span = document.createElement("span");
    span.textContent = "görünür kalsın listesine ekle";
    button.appendChild(span);

    // Inject styles once
    if (!document.querySelector("#akblocker-whitelist-style")) {
        const style = document.createElement("style");
        style.id = "aktrollblocker-whitelist-style";
        style.textContent = `
              .btn-white-list-aktrollblocker {
                    display: inline-block;
                    align-items: center;
                    gap: 6px;
                    padding: 4px 12px;
                    margin-left: 10px;
                    border-radius: 64px;
                    background-color: transparent;
                    border: 1px solid #bdbdbd;
                    color: inherit;
                    cursor: pointer;
                    font-size: 1rem;
                    height: 32px;
                }
            
                .btn-white-list-aktrollblocker:hover {
                    border-color: #de2f42 !important;
                    color: #de2f42 !important;
                }
        `;
        document.head.appendChild(style);
    }

    // Load current whitelist to set initial state
    chrome.storage.local.get(["whitelist"], (data) => {
        const whitelist = data.whitelist || [];
        const isWhitelisted = whitelist.includes(username);
        if (isWhitelisted) {
            button.textContent = "görünür kalsın listesinden çıkar";
        }
        button.onclick = () => {
            chrome.storage.local.get(["whitelist"], (data) => {
                const whitelist = new Set(data.whitelist || []);
                button.disabled = true;

                if (whitelist.has(username)) {
                    chrome.runtime.sendMessage({type: "removeFromWhitelist", username}, (response) => {
                        if (response?.success) {
                            button.textContent = "görünür kalsın listesine ekle";
                            setTimeout(() => {
                                button.disabled = false;
                            }, 500);
                        }
                    });
                } else {
                    chrome.runtime.sendMessage({type: "addToWhitelist", username}, (response) => {
                        if (response?.success) {
                            button.textContent = "görünür kalsın listesinden çıkar";
                            setTimeout(() => {
                                button.disabled = false;
                            }, 500);
                        }
                    });
                }
            });
        };
    });

    container.appendChild(button);
}

function normalizeUsername(name) {
    return name.trim().replace(/\s+/g, "-").toLowerCase();
}

function observeAllFavoritePopups(trollList) {
    const popups = document.querySelectorAll(".favorite-list-popup");

    popups.forEach((popup) => {
        const observer = new MutationObserver(() => {
            const ul = popup.querySelector("ul");
            if (ul) {
                highlightTrollsInFavoritesList(ul, trollList);
            }
        });

        observer.observe(popup, {
            childList: true,
            subtree: true
        });
    });
}

function highlightTrollsInFavoritesList(ul, trollList) {
    const links = ul.querySelectorAll("a[href^='/biri/']");
    links.forEach(a => {
        const username = normalizeUsername(a.getAttribute("href").replace("/biri/", "").trim());
        if (trollList.includes(username)) {
            const li = a.closest("li");
            if (!li) return;

            li.style.backgroundColor = "rgba(255, 255, 0, 0.2)";
            li.style.border = "1px dashed #de2f42";
            li.style.borderRadius = "4px";
            li.style.padding = "4px 6px";
            li.style.marginBottom = "4px";
            li.title = "⚠️ bu yazar troll listesinde";
        }
    });
}

async function highlightTrollTopic(trolls, blockedCount) {
    const topicId = window.location.pathname.match(/--(\d+)/)?.[1];
    if (!topicId) return;

    try {
        const author = await getTopicCreator(topicId);
        if (trolls.includes(normalizeUsername(author)) || blockedCount >= 5) {
            const subTitle = document.querySelector(".sub-title-menu");
            if (!subTitle) return;

            const warning = document.createElement("div");
            warning.textContent = "⚠️ muhtemel troll başlık";
            warning.style.backgroundColor = "rgba(255, 255, 0, 0.2)";
            warning.style.opacity = '0.6';
            warning.style.borderRadius = "4px";
            warning.style.padding = "6px 10px";
            warning.style.marginTop = "8px";
            warning.style.fontSize = "inherit";
            warning.style.color = "inherit";
            warning.style.display = "inline-block";

            subTitle.appendChild(warning);
        }
    } catch (ex) {
        console.log(ex);
    }
}

function blockTrollEntries(entries, trolls, mode) {
    entries.forEach(entry => {
        const author = normalizeUsername(entry.getAttribute("data-author"));
        if (trolls.includes(author)) {
            if (mode === "hide") {
                entry.style.display = "none";
            } else {
                collapseContent(entry);
            }
            blockedCount++;
        }
    });
    return blockedCount;
}

// follower lists sometimes loaded after the page renders
// so need to observe when the list appears
function highlightTrollsInFollowList(trollList) {
    const list = document.querySelector("#follow-list");
    if (!list) return;

    const checkAndHighlight = () => {
        const listItems = list.querySelectorAll("li");
        listItems.forEach((li) => {
            const nickEl = li.querySelector("#follows-nick");
            if (!nickEl) return;

            const username = nickEl.getAttribute("href").replace("/biri/", "").trim();
            if (trollList.includes(username)) {
                li.style.backgroundColor = "rgba(255, 255, 0, 0.2)";
                li.style.border = "1px dashed #de2f42";
                li.style.borderRadius = "4px";
                li.style.padding = "6px";
                li.style.marginBottom = "6px";
                li.title = "⚠️ bu yazar troll listesinde";
            }
        });
    };

    // run immediately
    checkAndHighlight();

    // observe for changes
    const observer = new MutationObserver(() => checkAndHighlight());
    observer.observe(list, {childList: true, subtree: true});
}

function collapseContent(entry) {

    const content = entry.querySelector(".content");
    if (!content) return;

    const originalHTML = content.innerHTML;
    const originalReadMore = entry.querySelector(".read-more-link-wrapper");

    if (originalReadMore) {
        originalReadMore.style.display = "none";
    }

    content.innerHTML = `<em>bu entry bir troll tarafından girilmiş.</em>`;
    const showLinkWrapper = document.createElement("div");
    showLinkWrapper.className = "read-more-link-wrapper";
    showLinkWrapper.style.cursor = "pointer";
    showLinkWrapper.style.marginTop = "6px";

    const link = document.createElement("a");
    link.innerHTML = `
    <svg class="eksico" id="svg-dots-readmore">
      <use xlink:href="#eksico-dots"></use>
    </svg>yine de okuyayım
  `;
    link.style.textDecoration = "none";

    link.addEventListener("click", () => {
        content.innerHTML = originalHTML;

        if (originalReadMore) {
            originalReadMore.style.display = "block"
        }
    });

    showLinkWrapper.appendChild(link);
    content.appendChild(showLinkWrapper);
}