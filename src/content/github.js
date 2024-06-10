let gh_cookies = ""
let gh_cookieArr = []
let accessToken = "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"
let github_repos = []
let state = "Start"

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



async function SelectRepo() {
  // TODO: Check if accessToken already set in local storage
  console.log("SelectRepo()");

  try {
    let content = document.getElementById("content");
    content.innerHTML = '';
    let title = document.createElement('p')
    title.innerText = "Select Repository";
    title.className = "text-xl font-semibold mt-8 mb-5 text-white";
    content.appendChild(title);

    console.log("fetching repos");
    let repos = await getRepos();
    console.log("fetched: ", repos);
    let list = document.createElement('ul');
    list.className = 'overflow-auto w-full border border-slate-500 rounded-md ';
    list.style.overflow = "auto";
    list.style.height = "200px";
    
    for (const repo of repos) {
      let li = document.createElement('li');
      li.className = 'flex justify-between items-center p-2 align-center  border-b-2 border-slate-600 '
      let p = document.createElement('p');
      p.innerText = repo.name;
      p.className = 'text-white text-md font-semibold'
      
      let b = document.createElement('button');
      b.innerText = 'Update';
      b.className = 'text-md flex rounded-md bg-white p-1 font-semibold text-black shadow-sm '
      b.onclick = async () => {
        try{
          const file = "README.md";
          const sha = await getFileSha(owner, repo.name, file);
          await updateFile(repo.name, sha, file);
        }catch(e){
            console.error('Error:', e);
        }

      };
      
      li.appendChild(p);
      li.appendChild(b);
      list.appendChild(li);
    }
    
    content.appendChild(list);
  } catch (error) {
    console.error('Error:', error);
  }
}


// Get the current file SHA
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
  const content = 'test';
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
  //const data = await response.json();
}




SelectRepo()

