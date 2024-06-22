let state = "";
let notion_numbered_list_block_count = 0;
let markdown = "";
let listOpen = false;

async function getCurrentTab() {
  let queryOptions = { active: true, lastFocusedWindow: true };
  // `tab` will either be a `tabs.Tab` instance or `undefined`.
  let [tab] = await chrome.tabs.query(queryOptions);
  return tab;
}

async function searchRepos(event) {
  if (event.target.value === "") return;
  const user = await chrome.runtime.sendMessage({ state: "GETUSER" });
  const url = `https://api.github.com/search/repositories?q=user:${user.login}+${event.target.value}`;
  const auth = await chrome.runtime.sendMessage({ state: "GETAUTH" });
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${auth.access_token}`,
    },
  });
  if (!res.ok) throw new Error("err fetching repos");
  const resObj = await res.json();
  insertRepositoriesList(resObj.items);
}

async function getRepos() {
  const user = await chrome.runtime.sendMessage({ state: "GETUSER" });
  const url = `https://api.github.com/users/${user.login}/repos?per_page=100`;
  const auth = await chrome.runtime.sendMessage({ state: "GETAUTH" });
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${auth.access_token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (!res.ok) throw new Error("err fetching repos");
  return await res.json();
}

function parseNotionHTML() {
  markdown = "";
  const elms = document.getElementsByClassName("notion-page-content")[0]
    .children;
  for (const elm of elms) {
    elmAction(elm);
  }
}

function elmAction(elm) {
  const className = elm.className.split(" ")[1];
  const element = elm.getElementsByClassName("notranslate")[0];
  const img = elm.querySelector("img");
  if (!element && !img && className != "notion-divider-block") {
    return console.log("notranslate | img not found", elm);
  }
  switch (className) {
    case "notion-table-block":
      markdown += "\n";
      const rows = elm.querySelectorAll("tr");
      const divider =
        "| --- ".repeat(rows[0].querySelectorAll("td").length) + "|";
      let isFirstRow = true;
      for (const row of rows) {
        row
          .querySelectorAll("td")
          .forEach((td) => (markdown += `| ${td.innerText} `));
        markdown += "|\n";
        if (isFirstRow) {
          markdown += divider + "\n";
          isFirstRow = false;
        }
      }
      break;
    case "notion-divider-block":
      markdown += "\n---\n";
      break;
    case "notion-to_do-block":
      markdown += element.style.textDecoration.includes("line-through")
        ? "- [x]"
        : "- [ ]";
      markdown += ` ${element.innerText} \n`;
      break;
    case "notion-code-block":
      let code = "";
      const language = elm.querySelector('div[role="button"]');
      const tokens = element.children;
      for (const token of tokens) {
        code += token.innerText;
      }
      markdown += "```" + language.innerText + "\n" + code + "\n```\n";
      break;
    case "notion-sub_header-block":
      markdown += `## ${element.innerText} \n`;
      break;
    case "notion-header-block":
      markdown += `# ${element.innerText} \n`;
      break;
    case "notion-text-block":
      markdown += `${element.innerText} \n`;
      break;
    case "notion-image-block":
      markdown += `![${img.src}](${img.src}) \n`;
      break;
    case "notion-numbered_list-block":
      markdown += `${++notion_numbered_list_block_count}. ${element.innerText} \n`;
      break;

    case "notion-bulleted_list-block":
      markdown += `- ${element.innerText} \n`;
      break;
    default:
      break;
  }
}

async function getFileSha(user, reponame, filename) {
  const auth = await chrome.runtime.sendMessage({ state: "GETAUTH" });
  if (!auth) return;
  const response = await fetch(
    `https://api.github.com/repos/${user}/${reponame}/contents/${filename}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${auth.access_token}`,
        Accept: "application/vnd.github+json",
      },
    },
  );

  switch (response.status) {
    case 200:
    case 201:
      break;
    case 401:
      //remove the githubAuthentification from the storage
      await chrome.runtime.sendMessage({ state: "REMOVEAUTH" });
      throw new Error("getFileSha() => Had to reset auth");
    default:
      throw new Error("getFileSha() => Failed to update the file");
  }

  const data = await response.json();
  return data.sha;
}

async function updateFile(reponame, sha, filename) {
  const auth = await chrome.runtime.sendMessage({ state: "GETAUTH" });
  const user = await chrome.runtime.sendMessage({ state: "GETUSER" });
  const content = markdown;
  const message = "Update README.md";
  const committer = {
    name: user.name,
    email: user.email,
  };
  const branches = await getBranches(user.login, reponame, auth.access_token);
  //TODO: let user choose the branch to update
  const branch = branches[0].name;
  const base64Content = btoa(content);
  const response = await fetch(
    `https://api.github.com/repos/${user.login}/${reponame}/contents/${filename}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${auth.access_token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: message,
        content: base64Content,
        sha: sha,
        branch: branch,
        committer: committer,
      }),
    },
  );

  switch (response.status) {
    case 200:
    case 201:
      break;
    case 401:
    case 402:
    case 403:
      //remove the githubAuthentification from the storage
      chrome.runtime.sendMessage({ state: "REMOVEAUTH" });
      break;
    default:
      throw new Error("Failed to update the file");
  }
}

async function insertSyncButton() {
  const nav = document.getElementsByClassName("notion-topbar-action-buttons")[0]
    .children[1];
  let sync = document.createElement("div");
  sync.style.position = "relative";
  sync.style.display = "flex";
  sync.style.alignItems = "center";
  sync.style.width = "20px";
  sync.style.height = "20px";
  sync.innerHTML = `
  <div style="position: relative; display: flex; align-items: center;"><div role="button" tabindex="0" class="duration-1000 active:rotate-360 notion-topbar-comments-button" aria-label="Comments" style="user-select: none; transition: background 20ms ease-in 0s; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; border-radius: 4px; height: 20px; width: 26px; padding: 0px; margin-right: 2px; background: rgba(255, 255, 255, 0.055);">
  <svg id="syncgithub" class="duration-1000 active:rotate-360"  width="100" height="96" viewBox="0 0 117 96" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M94 66L86 60C84.1378 64.966 79.8151 68.5972 74.6023 69.5746L67.812 70.8477C67.4676 70.9123 67.3364 71.3364 67.5842 71.5842C69.4456 73.4456 70.4597 75.9906 70.3886 78.6221L70 93C70 94.6569 71.3431 96 73 96H73.5L81.5253 92.2103C88.0406 89.1336 93.547 84.268 97.4021 78.1808L101 72.5L104.5 64L94 66Z" fill="#E49A40"/>
<path d="M18.5 40.5L27 46.5C27 43.2325 27.9182 40.0308 29.65 37.26L32 33.5L31.3573 31.4113C30.4729 28.5369 30.4729 25.4631 31.3573 22.5887L32 20.5L36.2431 20.7829C38.3685 20.9246 40.4072 21.6804 42.1113 22.9585L45.5 25.5L48.4451 24.641C54.3632 22.9149 60.6465 22.881 66.5829 24.5432L70 25.5L70.7138 24.7267C74.003 21.1634 78.8938 19.5426 83.66 20.4363C83.8722 20.476 84.0512 20.623 84.1343 20.8223C85.6426 24.4421 85.7692 28.5463 84.4502 32.2394L84 33.5C87.1603 36.6603 88.7127 41.0858 88.2191 45.5278L88.1814 45.867C88.0987 46.6118 87.2564 47.0043 86.6329 46.5886L79.7871 42.0247C79.3455 41.7303 78.7508 41.8322 78.4324 42.2568L76.5585 44.7553C76.2438 45.1749 76.3068 45.7664 76.7028 46.1103L94.3652 61.4487C94.7321 61.7674 95.2751 61.776 95.6521 61.4692L115.696 45.1542C116.135 44.7967 116.19 44.1463 115.818 43.7201L113.63 41.2201C113.278 40.8174 112.671 40.7634 112.253 41.0977L106.882 45.3944C106.274 45.8805 105.369 45.5169 105.266 44.7457L104.453 38.6448C103.822 33.9176 102.375 29.3361 100.175 25.1049C98.0728 21.063 95.3142 17.3985 92.0113 14.2608L90.4151 12.7443C88.1426 10.5855 85.7007 8.60649 82.9911 7.03072C80.2609 5.44289 76.5947 3.49661 73.5 2.5C69.8314 1.3186 64.3459 0.627979 60.8458 0.282199C58.6179 0.0620996 56.3794 0.0659152 54.1445 0.19738C50.7223 0.398689 47.3262 0.918438 44.0004 1.74989L43 2L38.2124 3.59587C37.4051 3.86495 36.618 4.19099 35.857 4.57152C32.629 6.18551 29.5904 8.15329 26.7972 10.4386L25.5 11.5L24.4581 12.5419C21.8258 15.1742 19.4599 18.0601 17.395 21.1575L16.5383 22.4426C13.8623 26.4566 11.8253 30.8614 10.5 35.5C9.50533 38.8156 9 42.2586 9 45.7202V47.5C11.1479 45.3521 18.5 40.5 18.5 40.5Z" fill="#E49A40"/>
<path d="M19.0258 44.7791L40.2918 55.6383C40.7064 55.8501 40.92 56.3199 40.8071 56.7715L40.2691 58.9236C40.1252 59.4991 39.5148 59.8236 38.9572 59.6208L31.1997 56.7999C30.3724 56.4991 29.5881 57.3367 29.9427 58.1424L31.0647 60.6925C33.2119 65.5724 37.6487 69.0623 42.8971 69.9995L48.5 71L46.4837 75.8968C45.6008 78.0409 43.4279 79.3633 41.1179 79.1624C36.3685 78.7494 32.1528 75.9553 29.9222 71.7419L29.655 71.2372C29.229 70.4326 28.5622 69.7811 27.7479 69.3739L25.8215 68.4107C24.715 67.8575 23.3859 68.0117 22.4356 68.8037C21.7822 69.3482 21.9399 70.3916 22.7249 70.7187L23.6782 71.1159C25.7773 71.9906 27.3639 73.7736 27.9886 75.9602L28.7164 78.5073C28.9024 79.1584 29.2512 79.7512 29.73 80.23L29.9645 80.4645C32.2282 82.7282 35.2986 84 38.5 84L45 84.5V94.1914C45 94.3958 44.9671 94.5988 44.9024 94.7927C44.6621 95.5137 43.9874 96 43.2274 96H41L40.536 95.768C27.2494 89.1247 16.6461 78.1214 10.4991 64.598C10.2621 64.0767 9.57034 63.9655 9.18189 64.3863L4.59828 69.3519C4.25642 69.7222 3.69237 69.7803 3.28224 69.4873L1.31864 68.0847C0.867316 67.7624 0.764572 67.1343 1.08965 66.6849L16.4958 45.3881C17.0737 44.5892 18.1477 44.3307 19.0258 44.7791Z" fill="#E49A40"/></svg></div></div>`;
  nav.appendChild(sync);
  sync.addEventListener("click", async () => {
    try {
      const auth = await chrome.runtime.sendMessage({ state: "GETAUTH" });
      if (auth.error) {
        await initAuth();
      } else {
        parseNotionHTML();
        const user = await chrome.runtime.sendMessage({ state: "GETUSER" });
        const link = await getLink();
        const sha = await getFileSha(user.login, link.repo, "README.md");
        await updateFile(link.repo, sha, "README.md");
      }
    } catch (e) {
      throw e;
    }
  });
}

async function insertLinkRepoButton() {
  // Create the main container
  const container = document.createElement("div");
  container.id = "link-repo-container";
  container.style.backgroundColor = "#191919";
  container.style.marginLeft = "30px";
  container.style.width = "160px";

  container.className = "relative";

  // Create the button
  const button = document.createElement("a");
  button.style.display = "flex";
  button.style.alignItems = "center";
  button.style.cursor = "pointer";
  button.style.color = "white";
  button.style.justifyContent = "space-between";
  const buttonText = document.createElement("span");
  buttonText.id = "link-repo-button-text";
  const url = window.location.href;
  let pageId = url.split("/").pop();
  if (pageId.includes("-")) pageId = pageId.split("-").pop();

  const data = await new Promise((resolve, reject) => {
    chrome.storage.local.get(["links"], (data) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(data);
      }
    });
  });
  const links = data.links || [];
  const existingLink = links.find((link) => link.pageId === pageId);
  if (existingLink) {
    buttonText.textContent = existingLink.repo;
  } else {
    buttonText.textContent = "Link Repository";
  }
  button.addEventListener("click", async () => {
    if (listOpen) {
      document.getElementById("link-repo-flyout-container").style.display =
        "none";
      document.getElementById("search-repo").value = "";
      //wait for 200ms
      await new Promise((resolve) => setTimeout(resolve, 200));
    } else {
      document.getElementById("link-repo-flyout-container").style.display =
        "block";
    }
    listOpen = !listOpen;
  });
  button.appendChild(buttonText);

  const buttonSvg = document.createElement("div");
  if (existingLink)
    buttonSvg.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6"><path stroke-linecap="round" stroke-linejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" /></svg>`;
  else
    buttonSvg.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6"><path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" /></svg>`;
  buttonSvg.style.width = "20px";
  buttonSvg.style.height = "20px";
  buttonSvg.style.marginLeft = "15px";
  button.appendChild(buttonSvg);

  container.appendChild(button);

  // Create the flyout menu container
  const flyoutContainer = document.createElement("div");
  flyoutContainer.id = "link-repo-flyout-container";
  flyoutContainer.style.position = "absolute";
  flyoutContainer.style.width = "160px";
  flyoutContainer.style.backgroundColor = "#202020";
  flyoutContainer.style.borderRadius = "10px";
  flyoutContainer.style.overflow = "hidden";
  flyoutContainer.style.display = "none";
  listOpen = false;

  // Create the menu content
  const menuContent = document.createElement("div");
  menuContent.id = "menu-content";

  const searchbar = document.createElement("input");
  searchbar.id = "search-repo";
  searchbar.type = "text";
  searchbar.placeholder = "Search repositories";
  searchbar.style.backgroundColor = "#202020";
  searchbar.style.border = "none";
  searchbar.style.padding = "5px";
  // on change call a function called searchRepo(query) with debounce of 500ms
  searchbar.addEventListener("input", debounce(searchRepos, 500));

  flyoutContainer.appendChild(searchbar);
  flyoutContainer.appendChild(menuContent);
  container.appendChild(flyoutContainer);

  document
    .getElementsByClassName("notion-topbar-action-buttons")[0]
    .children[1].appendChild(container);
}

function debounce(func, wait) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

function insertRepositoriesList(repos) {
  const container = document.getElementById("menu-content");
  container.innerHTML = "";
  let list = document.createElement("ul");
  list.style.overflow = "auto";
  list.style.height = "200px";
  list.style.listStyleType = "none";
  list.style.padding = "0px";
  list.style.margin = "10px";

  for (const repo of repos) {
    let li = document.createElement("li");
    li.style.display = "flex";
    li.style.justifyContent = "space-between";
    li.style.alignItems = "center";
    li.style.borderBottom = "1px solid #D9D9D9";
    li.style.cursor = "pointer";

    let p = document.createElement("p");
    p.innerText = truncate(repo.name);
    p.style.color = "white";
    p.style.fontSize = "14px";
    p.style.fontWeight = "600";

    li.addEventListener("click", () => {
      document.getElementById("link-repo-button-text").innerText = truncate(
        repo.name,
      );
      const url = window.location.href;
      let pageId = url.split("/").pop();
      if (pageId.includes("-")) pageId = pageId.split("-").pop();
      updatePageLinks({ pageId, repo: repo.name });
      document.getElementById("link-repo-flyout-container").style.display =
        "none";
      document.getElementById("search-repo").value = "";
      listOpen = false;
    });
    li.appendChild(p);
    list.appendChild(li);
  }

  container.appendChild(list);
}

// Function to fetch branches of a specific repository
async function getBranches(user, repo, token) {
  const url = `https://api.github.com/repos/${user}/${repo}/branches`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch branches: ${response.status} ${response.statusText}`,
    );
  }

  const data = await response.json();
  return data;
}

async function updatePageLinks(link) {
  try {
    const data = await new Promise((resolve, reject) => {
      chrome.storage.local.get(["links"], (data) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(data);
        }
      });
    });

    let links = data.links || [];

    // Filter out any link with the same pageId and then add the new link
    links = links.filter((existingLink) => existingLink.pageId !== link.pageId);
    links.push(link);

    await new Promise((resolve, reject) => {
      chrome.storage.local.set({ links: links }, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  } catch (error) {
    console.error("Failed to update links: ", error);
  }
}

async function getLink() {
  try {
    const url = window.location.href;
    let pageId = url.split("/").pop();
    if (pageId.includes("-")) pageId = pageId.split("-").pop();
    const data = await new Promise((resolve, reject) => {
      chrome.storage.local.get(["links"], (data) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(data);
        }
      });
    });

    let links = data.links || [];

    if (links.length == 0) return "";
    // Find link with the same pageId and then add the new link
    return links.find((existingLink) => existingLink.pageId === pageId) || "";
  } catch (error) {
    console.error("Failed to update links: ", error);
    return "";
  }
}

function truncate(string) {
  return string.length > 15 ? string.substring(0, 15) + "..." : string;
}

function loadAuthCodeHtml(code) {
  // Create the overlay container
  const overlay = document.createElement("div");
  overlay.id = "sync-container";
  overlay.style.position = "fixed";
  overlay.style.top = "0px";
  overlay.style.left = "0px";
  overlay.style.width = "100%";
  overlay.style.height = "100%";
  overlay.style.zIndex = "999";
  overlay.style.display = "flex";
  overlay.style.justifyContent = "center";

  // Create the inner container
  const innerContainer = document.createElement("div");

  // Create the main box
  const box = document.createElement("div");
  box.style.backgroundColor = "white";
  box.style.borderRadius = "10px";
  box.style.display = "flex";
  box.style.padding = "10px";
  box.style.marginTop = "100px";
  box.style.boxShadow = "0px 5px 20px 5px #000000";
  const exit = document.createElement("div");
  exit.style.width = "15px";
  exit.style.height = "15px";
  exit.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
  </svg>
`;
  exit.style.cursor = "pointer";
  exit.addEventListener("click", () => {
    document.getElementById("sync-container").remove();
  });
  box.appendChild(exit);

  // Create the list
  const ul = document.createElement("ul");
  ul.style.listStyle = "none";
  ul.style.padding = "10px";

  // Create the list item
  const li = document.createElement("li");

  // Create the list item container
  const liContainer = document.createElement("div");
  liContainer.style.display = "flex";
  liContainer.style.alignItems = "center";
  liContainer.style.position = "relative";
  liContainer.style.flexDirection = "column";

  // Create the message paragraph
  const message = document.createElement("p");
  message.style.color = "gray";
  message.style.margin = "0";
  message.textContent = "Use this code to authenticate with GitHub";

  // Create the code container
  const codeContainer = document.createElement("div");
  codeContainer.style.position = "relative";
  codeContainer.style.backgroundColor = "#202020";
  codeContainer.style.borderRadius = "5px";
  codeContainer.style.marginTop = "30px";
  codeContainer.style.marginRight = "30px";

  // Create the clipboard icon
  let clipboardIcon = document.createElement("div");
  clipboardIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
    <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75" />
  </svg>
`;
  clipboardIcon.classList.add("size-6");
  clipboardIcon.style.color = "white";
  clipboardIcon.style.width = "15px";
  clipboardIcon.style.height = "15px";
  clipboardIcon.style.position = "absolute";
  clipboardIcon.style.top = "2px";
  clipboardIcon.style.right = "2px";
  clipboardIcon.style.cursor = "pointer";
  clipboardIcon.addEventListener("click", () => {
    navigator.clipboard.writeText(code);
  });

  // Create the code paragraph
  const codeParagraph = document.createElement("p");
  codeParagraph.style.fontSize = "25px";
  codeParagraph.style.margin = "0";
  codeParagraph.style.marginTop = "15px";
  codeParagraph.style.marginRight = "25px";
  codeParagraph.style.marginLeft = "25px";
  codeParagraph.style.color = "white";
  codeParagraph.style.marginBottom = "15px";
  codeParagraph.textContent = code;

  // Append the code and clipboard icon to the code container
  codeContainer.appendChild(clipboardIcon);
  codeContainer.appendChild(codeParagraph);

  // Create the arrow icon
  const arrowIcon = document.createElement("div");
  arrowIcon.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path fill-rule="evenodd" clip-rule="evenodd" d="M12 21.75C17.3848 21.75 21.75 17.3848 21.75 12C21.75 6.61522 17.3848 2.25 12 2.25C6.61522 2.25 2.25 6.61522 2.25 12C2.25 17.3848 6.61522 21.75 12 21.75ZM16.2803 12.5303C16.421 12.3897 16.5 12.1989 16.5 12C16.5 11.8011 16.421 11.6103 16.2803 11.4697L13.2803 8.46967C12.9874 8.17678 12.5126 8.17678 12.2197 8.46967C11.9268 8.76256 11.9268 9.23744 12.2197 9.53033L13.9393 11.25H8.25C7.83579 11.25 7.5 11.5858 7.5 12C7.5 12.4142 7.83579 12.75 8.25 12.75L13.9393 12.75L12.2197 14.4697C11.9268 14.7626 11.9268 15.2374 12.2197 15.5303C12.5126 15.8232 12.9874 15.8232 13.2803 15.5303L16.2803 12.5303Z" fill="#5E626B"/>
  </svg>
`;
  arrowIcon.style.marginTop = "15px";
  arrowIcon.style.width = "15px";
  arrowIcon.style.height = "15px";
  arrowIcon.style.cursor = "pointer";
  arrowIcon.addEventListener("click", () => {
    window.open("https://github.com/login/device", "_blank");
  });

  const temp = document.createElement("div");
  temp.style.display = "flex";
  temp.style.alignItems = "center";

  temp.appendChild(codeContainer);
  temp.appendChild(arrowIcon);
  // Append the elements to the list item container
  liContainer.appendChild(message);
  liContainer.appendChild(temp);
  //liContainer.appendChild(arrowIcon);

  // Append the list item container to the list item
  li.appendChild(liContainer);

  // Append the list item to the list
  ul.appendChild(li);

  // Append the list to the box
  box.appendChild(ul);

  // Append the box to the inner container
  innerContainer.appendChild(box);

  // Append the inner container to the overlay
  overlay.appendChild(innerContainer);

  // Append the overlay to the body
  document.getElementById("notion-app").appendChild(overlay);
}

async function initAuth() {
  try {
    const initResponse = await chrome.runtime.sendMessage({
      state: "INITAUTH",
    });
    if (!initResponse.user_code)
      throw new Error(`No user code ${JSON.stringify(initResponse)}`);

    loadAuthCodeHtml(initResponse.user_code);
    //TODO: handle errs
    const pollResp = await chrome.runtime.sendMessage({
      state: "POLL",
      deviceCode: initResponse.device_code,
    });
    if (pollResp.state == "ERROR") return;
    document.getElementById("sync-container").remove();
    //TODO: display finished in the UI
    //TODO: handle errs
  } catch (error) {
    console.error("initAuth() => " + error);
    //TODO: display err
  }
}

const targetNode = document.body;
const config = { childList: true, subtree: true };

const callback = function (mutationsList, observer) {
  for (let mutation of mutationsList) {
    if (mutation.type === "childList") {
      let res = document.getElementsByClassName("notion-topbar-action-buttons");
      if (res.length > 0) {
        if (res[0].children.length > 0) {
          insertSyncButton();
          insertLinkRepoButton();
          observer.disconnect(); // Stop observing after the content is found and parsed
        }
        break;
      }
    }
  }
};

async function checkUrl() {
  const url = window.location.href;
  if (url.includes("www.notion.so")) {
    const input = document.getElementById("link-repo-button-text");
    if (!input) return;
    let pageId = url.split("/").pop();
    if (pageId.includes("-")) pageId = pageId.split("-").pop();

    const data = await new Promise((resolve, reject) => {
      chrome.storage.local.get(["links"], (data) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(data);
        }
      });
    });
    const links = data.links || [];
    const existingLink = links.find((link) => link.pageId === pageId);
    if (existingLink) {
      input.textContent = existingLink.repo;
    } else {
      input.textContent = "Link Repository";
    }
  }
}

const observer = new MutationObserver(callback);
observer.observe(targetNode, config);
const urlobserver = new MutationObserver(() => {
  checkUrl();
});
urlobserver.observe(document.querySelector("title"), config);
