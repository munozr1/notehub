chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {
    switch(request.state ) {
      case "INITAUTH":
        startGithubAuthentication(sendResponse);
        break;
    }
    return true;
  }
);




async function startGithubAuthentication(callback) {
  try {
    const { githubAuthRequestResponse: prev_data } = await chrome.storage.local.get(["githubAuthRequestResponse"]);
    const clientID = "Iv23lieCe6IdGN8ziPP2";
    const url = "https://github.com/login/device/code";

    // Check if prev_data is not empty and not expired
    if (prev_data && prev_data.expires_in > Date.now()) {
      console.log("using previous data");
      callback(prev_data);// send to notion
      return prev_data;
    }

    console.log("fetching new data");

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: clientID,
        scope: "repo",
      }),
    });

    const data = await res.json();
    data.expires_in = Date.now() + data.expires_in * 1000;
    await chrome.storage.local.set({ githubAuthRequestResponse: data });
    callback(prev_data); // send to notion
    return data;
  } catch (error) {
    console.log("error: ", error);
    callback(error);
    return { error: error.message };
  }
}

