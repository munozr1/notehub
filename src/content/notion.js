console.log("loaded")

let state = "";
let notion_numbered_list_block_count = 0;
let markdown = "";
let accessToken = ""
let owner = 'munozr1'
const url = `https://api.github.com/users/${owner}/repos`;


async function getRepos(){
  const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'X-GitHub-Api-Version': '2022-11-28'
      }
    })

  if(!res.ok) throw new Error("err fetching repos");

  return await res.json();
}

function parseNotionHTML(){
  markdown = ""
  let res = document.getElementsByClassName("notion-page-content");
  console.log('res: ',res[0]);
  const elms = document.getElementsByClassName("notion-page-content")[0].children;
  for(const elm of elms){
    elmAction(elm);
  }
}


function elmAction(elm) {
    const className = elm.className.split(" ")[1];
    const element = elm.getElementsByClassName("notranslate")[0];
    const img = elm.querySelector("img");
    if (!element && !img) {return console.log("notranslate not found", elm)}
    switch(className) {
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
        markdown += `![${img.src}](${img.src}) \n`
        break;
      case "notion-numbered_list-block":
        markdown += `${++notion_numbered_list_block_count}. ${element.innerText} \n`
        break;
     
      case "notion-bulleted_list-block":
        markdown += `- ${element.innerText} \n`;
        break;
      default:
        console.log("unknown element");
    }
}

async function getFileSha(user, reponame, filename) {
  const response = await fetch(`https://api.github.com/repos/${user}/${reponame}/contents/${filename}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/vnd.github+json',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch the file SHA');
  }

  const data = await response.json();
  return data.sha;
}

async function updateFile(reponame, sha, filename) {
  const content = markdown;
  const message = 'Update README.md';
  const branch = 'master';
  const base64Content = btoa(content);
  const response = await fetch(`https://api.github.com/repos/${owner}/${reponame}/contents/${filename}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: message,
      content: base64Content,
      sha: sha,
      branch: branch,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to update the file');
  }
}




function insertSyncButton(){
  const nav = document.getElementsByClassName("notion-topbar-action-buttons")[0].children[1];
  let sync = document.createElement('div');
  sync.style.position = "relative";
  sync.style.display = "flex";
  sync.style.alignItems= "center";
  sync.innerHTML = `
  <div style="position: relative; display: flex; align-items: center;"><div role="button" tabindex="0" class="notion-topbar-comments-button" aria-label="Comments" style="user-select: none; transition: background 20ms ease-in 0s; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; border-radius: 4px; height: 28px; width: 33px; padding: 0px; margin-right: 2px; background: rgba(255, 255, 255, 0.055);">
  <svg width="116" height="96" viewBox="0 0 116 96" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M95.5 61.5L88 54.5L86.5411 58.4389C84.3443 64.3703 79.1956 68.7133 72.9789 69.879L67.812 70.8477C67.4676 70.9123 67.3364 71.3364 67.5842 71.5842C69.4456 73.4456 70.4597 75.9906 70.3886 78.6221L70 93C70 94.6569 71.3431 96 73 96H73.5L81.5253 92.2103C88.0406 89.1336 93.547 84.268 97.4021 78.1808L101 72.5L106 57.5L95.5 61.5Z" fill="#E49A40"/>
<path d="M16.5 46.5L27 50.5V47.2359C27 43.4875 28.0534 39.8146 30.04 36.6359L32 33.5L31.3573 31.4113C30.4729 28.5369 30.4729 25.4631 31.3573 22.5887L32 20.5L36.2431 20.7829C38.3685 20.9246 40.4072 21.6804 42.1113 22.9585L45.5 25.5L48.4451 24.641C54.3632 22.9149 60.6465 22.881 66.5829 24.5432L70 25.5L70.7138 24.7267C74.003 21.1634 78.8938 19.5426 83.66 20.4363C83.8722 20.476 84.0512 20.623 84.1343 20.8223C85.6426 24.4421 85.7692 28.5463 84.4502 32.2394L84 33.5L84.6066 34.1066C87.4196 36.9196 89 40.735 89 44.7132V45.5H83.8309C82.7703 45.5 82.4393 46.9338 83.3925 47.3988L99.3927 55.2038C99.7596 55.3827 100.198 55.3207 100.501 55.0471L110.848 45.702C111.692 44.9395 110.811 43.5841 109.771 44.046L106.5 45.5L104.818 37.6529C103.943 33.5695 102.524 29.6222 100.597 25.9171C98.2155 21.3375 95.0899 17.1854 91.3476 13.6302L90.4151 12.7443C88.1426 10.5855 85.7007 8.60649 82.9911 7.03072C80.2609 5.44289 76.5947 3.49661 73.5 2.5C69.8314 1.3186 64.3459 0.627979 60.8458 0.282199C58.6179 0.0620996 56.3794 0.0659152 54.1445 0.19738C50.7223 0.398689 47.3262 0.918438 44.0004 1.74989L43 2L38.2124 3.59587C37.4051 3.86495 36.618 4.19099 35.857 4.57152C32.629 6.18551 29.5904 8.15329 26.7972 10.4386L25.5 11.5L24.4581 12.5419C21.8258 15.1742 19.4599 18.0601 17.395 21.1575L16.5383 22.4426C13.8623 26.4566 11.8253 30.8614 10.5 35.5C9.50396 38.8201 8.9299 42.2524 8.79136 45.716L8.5 53C10.6479 50.8521 16.5 46.5 16.5 46.5Z" fill="#E49A40"/>
<path d="M36.5212 57.1197L31.5764 58.3559C30.286 58.6785 29.6642 60.1472 30.3306 61.2983L30.7783 62.0715C33.1384 66.1482 37.1752 68.9777 41.8124 69.8058L48.5 71L46.4837 75.8968C45.6008 78.0409 43.4279 79.3633 41.1179 79.1624C36.3685 78.7494 32.1528 75.9553 29.9222 71.7419L29.655 71.2372C29.229 70.4326 28.5622 69.7811 27.7479 69.3739L25.8215 68.4107C24.715 67.8575 23.3859 68.0117 22.4356 68.8037C21.7822 69.3482 21.9399 70.3916 22.7249 70.7187L23.6782 71.1159C25.7773 71.9906 27.3639 73.7736 27.9886 75.9602L28.7164 78.5073C28.9024 79.1584 29.2512 79.7512 29.73 80.23L29.9645 80.4645C32.2282 82.7282 35.2986 84 38.5 84L45 84.5V94.1914C45 94.3958 44.9671 94.5988 44.9024 94.7927C44.6621 95.5137 43.9874 96 43.2274 96H41L40.025 95.5125C27.0844 89.0422 16.816 78.2475 11 65L3.93697 66.6817C2.95606 66.9152 2.28524 65.7148 2.99824 65.0018L15.7574 52.2426C16.2224 51.7776 16.8862 51.5709 17.5329 51.6897L36.4593 55.166C37.5171 55.3603 37.5646 56.8589 36.5212 57.1197Z" fill="#E49A40"/>
</svg>
  </div>
  </div>`
  sync.addEventListener("click", async () => {
    repos = await getRepos()
    parseNotionHTML();
    const file = "README.md";
    const sha = await getFileSha(owner, repos[19].name, file);
    await updateFile(repos[19].name, sha, file);
  });
  nav.appendChild(sync);
}

const targetNode = document.body;
const config = { childList: true, subtree: true };


const callback = function(mutationsList, observer) {
  for (let mutation of mutationsList) {
    if (mutation.type === 'childList') {
      //let res = document.getElementsByClassName("notion-page-content");
      let res = document.getElementsByClassName("notion-topbar-action-buttons");
      if (res.length > 0) {
        if (res[0].children.length > 0) {
          console.log('Notion content loaded');
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

