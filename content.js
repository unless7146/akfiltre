let blockedCount = 0;

chrome.storage.local.get(["paused", "trollList"], (data) => {
    if (data.paused) return;
    const trolls = data.trollList || [];
    const entries = document.querySelectorAll("li[data-author]");
    entries.forEach(entry => {
        const author = entry.getAttribute("data-author");
        if (trolls.includes(author)) {
            console.log("troll found", author)
            entry.style.display = "none";
            blockedCount++;
        }
    });

    chrome.runtime.sendMessage({ type: "updateBadge", count: blockedCount });
});


