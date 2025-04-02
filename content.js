let blockedCount = 0;

chrome.storage.local.get(["paused", "trollList", "trollMode", "showTrollTopicWarning"], (data) => {
    if (data.paused) return;
    if (window.location.pathname.startsWith("/biri/")) return;
    const mode = data.trollMode || "hide";
    const showWarning = data.showTrollTopicWarning !== false;

    const trolls = data.trollList || [];
    const entries = document.querySelectorAll("li[data-author]");
    entries.forEach(entry => {
        const author = entry.getAttribute("data-author");
        if (trolls.includes(author)) {
            console.log("troll found", author)
            if (mode === "hide") {
                entry.style.display = "none";
            } else {
                collapseContent(entry);
            }
            blockedCount++;
        }
    });

    // highlight troll topic
    const isFirstPage = !window.location.search.includes('p=');
    if (isFirstPage && entries.length > 0 && showWarning) {
        const firstAuthor = entries[0].getAttribute("data-author");
        console.log("original poster", firstAuthor)
        if (trolls.includes(firstAuthor) || blockedCount >= 3) {
            const subTitle = document.querySelector(".sub-title-menu");
            if (!subTitle) return;

            const warning = document.createElement("div");
            warning.textContent = "⚠️ muhtemel troll başlık";
            warning.style.backgroundColor = "rgba(255, 255, 0, 0.2)";
            warning.style.border = "1px dashed #de2f42";
            warning.style.borderRadius = "4px";
            warning.style.padding = "6px 10px";
            warning.style.marginTop = "8px";
            warning.style.fontSize = "inherit";
            warning.style.color = "inherit";
            warning.style.display = "inline-block";

            subTitle.appendChild(warning);
        }
    }


    chrome.runtime.sendMessage({ type: "updateBadge", count: blockedCount });
});

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


