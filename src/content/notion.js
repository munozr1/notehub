let state = "";
let notion_numbered_list_block_count = 0;
let markdown = "";
let accessToken = "";
let owner = "munozr1";
const url = `https://api.github.com/users/${owner}/repos`;

async function getRepos() {
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
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
      console.log("unknown element");
      break;
  }
}

async function getFileSha(user, reponame, filename) {
  const response = await fetch(
    `https://api.github.com/repos/${user}/${reponame}/contents/${filename}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github+json",
      },
    },
  );

  if (!response.ok) {
    throw new Error("Failed to fetch the file SHA");
  }

  const data = await response.json();
  return data.sha;
}

async function updateFile(reponame, sha, filename) {
  const content = markdown;
  const message = "Update README.md";
  const branch = "master";
  const base64Content = btoa(content);
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${reponame}/contents/${filename}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: message,
        content: base64Content,
        sha: sha,
        branch: branch,
      }),
    },
  );

  if (!response.ok) {
    throw new Error("Failed to update the file");
  }
}

function insertSyncButton() {
  const nav = document.getElementsByClassName("notion-topbar-action-buttons")[0]
    .children[1];
  let sync = document.createElement("div");
  sync.style.position = "relative";
  sync.style.display = "flex";
  sync.style.alignItems = "center";
  sync.innerHTML = `
  <div style="position: relative; display: flex; align-items: center;"><div role="button" tabindex="0" class="notion-topbar-comments-button" aria-label="Comments" style="user-select: none; transition: background 20ms ease-in 0s; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; border-radius: 4px; height: 28px; width: 33px; padding: 0px; margin-right: 2px; background: rgba(255, 255, 255, 0.055);">
  <svg width="117" height="96" viewBox="0 0 117 96" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M94 66L86 60C84.1378 64.966 79.8151 68.5972 74.6023 69.5746L67.812 70.8477C67.4676 70.9123 67.3364 71.3364 67.5842 71.5842C69.4456 73.4456 70.4597 75.9906 70.3886 78.6221L70 93C70 94.6569 71.3431 96 73 96H73.5L81.5253 92.2103C88.0406 89.1336 93.547 84.268 97.4021 78.1808L101 72.5L104.5 64L94 66Z" fill="#E49A40"/>
<path d="M18.5 40.5L27 46.5C27 43.2325 27.9182 40.0308 29.65 37.26L32 33.5L31.3573 31.4113C30.4729 28.5369 30.4729 25.4631 31.3573 22.5887L32 20.5L36.2431 20.7829C38.3685 20.9246 40.4072 21.6804 42.1113 22.9585L45.5 25.5L48.4451 24.641C54.3632 22.9149 60.6465 22.881 66.5829 24.5432L70 25.5L70.7138 24.7267C74.003 21.1634 78.8938 19.5426 83.66 20.4363C83.8722 20.476 84.0512 20.623 84.1343 20.8223C85.6426 24.4421 85.7692 28.5463 84.4502 32.2394L84 33.5C87.1603 36.6603 88.7127 41.0858 88.2191 45.5278L88.1814 45.867C88.0987 46.6118 87.2564 47.0043 86.6329 46.5886L79.7871 42.0247C79.3455 41.7303 78.7508 41.8322 78.4324 42.2568L76.5585 44.7553C76.2438 45.1749 76.3068 45.7664 76.7028 46.1103L94.3652 61.4487C94.7321 61.7674 95.2751 61.776 95.6521 61.4692L115.696 45.1542C116.135 44.7967 116.19 44.1463 115.818 43.7201L113.63 41.2201C113.278 40.8174 112.671 40.7634 112.253 41.0977L106.882 45.3944C106.274 45.8805 105.369 45.5169 105.266 44.7457L104.453 38.6448C103.822 33.9176 102.375 29.3361 100.175 25.1049C98.0728 21.063 95.3142 17.3985 92.0113 14.2608L90.4151 12.7443C88.1426 10.5855 85.7007 8.60649 82.9911 7.03072C80.2609 5.44289 76.5947 3.49661 73.5 2.5C69.8314 1.3186 64.3459 0.627979 60.8458 0.282199C58.6179 0.0620996 56.3794 0.0659152 54.1445 0.19738C50.7223 0.398689 47.3262 0.918438 44.0004 1.74989L43 2L38.2124 3.59587C37.4051 3.86495 36.618 4.19099 35.857 4.57152C32.629 6.18551 29.5904 8.15329 26.7972 10.4386L25.5 11.5L24.4581 12.5419C21.8258 15.1742 19.4599 18.0601 17.395 21.1575L16.5383 22.4426C13.8623 26.4566 11.8253 30.8614 10.5 35.5C9.50533 38.8156 9 42.2586 9 45.7202V47.5C11.1479 45.3521 18.5 40.5 18.5 40.5Z" fill="#E49A40"/>
<path d="M19.0258 44.7791L40.2918 55.6383C40.7064 55.8501 40.92 56.3199 40.8071 56.7715L40.2691 58.9236C40.1252 59.4991 39.5148 59.8236 38.9572 59.6208L31.1997 56.7999C30.3724 56.4991 29.5881 57.3367 29.9427 58.1424L31.0647 60.6925C33.2119 65.5724 37.6487 69.0623 42.8971 69.9995L48.5 71L46.4837 75.8968C45.6008 78.0409 43.4279 79.3633 41.1179 79.1624C36.3685 78.7494 32.1528 75.9553 29.9222 71.7419L29.655 71.2372C29.229 70.4326 28.5622 69.7811 27.7479 69.3739L25.8215 68.4107C24.715 67.8575 23.3859 68.0117 22.4356 68.8037C21.7822 69.3482 21.9399 70.3916 22.7249 70.7187L23.6782 71.1159C25.7773 71.9906 27.3639 73.7736 27.9886 75.9602L28.7164 78.5073C28.9024 79.1584 29.2512 79.7512 29.73 80.23L29.9645 80.4645C32.2282 82.7282 35.2986 84 38.5 84L45 84.5V94.1914C45 94.3958 44.9671 94.5988 44.9024 94.7927C44.6621 95.5137 43.9874 96 43.2274 96H41L40.536 95.768C27.2494 89.1247 16.6461 78.1214 10.4991 64.598C10.2621 64.0767 9.57034 63.9655 9.18189 64.3863L4.59828 69.3519C4.25642 69.7222 3.69237 69.7803 3.28224 69.4873L1.31864 68.0847C0.867316 67.7624 0.764572 67.1343 1.08965 66.6849L16.4958 45.3881C17.0737 44.5892 18.1477 44.3307 19.0258 44.7791Z" fill="#E49A40"/>
</svg>

  </div>
  </div>`;
  sync.addEventListener("click", async () => {
    // repos = await getRepos();
    // console.log(repos);
    parseNotionHTML();
    const file = "README.md";
    // const sha = await getFileSha(owner, repos[19].name, file);
    console.log(markdown);
    //await updateFile(repos[19].name, sha, file);
  });
  nav.appendChild(sync);
}

const targetNode = document.body;
const config = { childList: true, subtree: true };

const callback = function (mutationsList, observer) {
  for (let mutation of mutationsList) {
    if (mutation.type === "childList") {
      //let res = document.getElementsByClassName("notion-page-content");
      let res = document.getElementsByClassName("notion-topbar-action-buttons");
      if (res.length > 0) {
        if (res[0].children.length > 0) {
          console.log("Notion content loaded");
          insertSyncButton();
          //parseNotionHTML();
          observer.disconnect(); // Stop observing after the content is found and parsed
        }
        break;
      }
    }
  }
};

const observer = new MutationObserver(callback);
observer.observe(targetNode, config);
