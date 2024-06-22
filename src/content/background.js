chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  switch (request.state) {
    case "INITAUTH":
      startGithubAuthentication(sendResponse);
      break;
    case "POLL":
      pollForToken(request.deviceCode, sendResponse);
      break;
    case "GETAUTH":
      getAuthentication(sendResponse);
      break;
    case "GETUSER":
      getUser(sendResponse);
      break;
    case "REMOVEAUTH":
      resetAuth(sendResponse);
      break;
    default:
      break;
  }
  return true;
});

async function startGithubAuthentication(callback) {
  try {
    //TODO: handle slow down err from github
    const body = {
      client_id: "Ov23li8SwPGDIQrWBOs1",
      scope: "repo user",
    };
    const url = "https://github.com/login/device/code";

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    console.log(JSON.stringify(body));

    const data = await res.json();
    data.expires_in = Date.now() + data.expires_in * 1000;
    console.log("startGithubAuthentication() => data: ", data);
    await chrome.storage.local.set({ githubAuthRequestResponse: data });
    callback(data); // send to notion
    return data;
  } catch (error) {
    callback(error);
    return { error: error.message };
  }
}

async function pollForToken(deviceCode, callback) {
  const url = "https://github.com/login/oauth/access_token";
  const body = {
    client_id: "Ov23li8SwPGDIQrWBOs1",
    device_code: deviceCode,
    grant_type: "urn:ietf:params:oauth:grant-type:device_code",
  };

  let pollResponse;
  let responseData;
  do {
    // Wait for 5 seconds
    await new Promise((resolve) => setTimeout(resolve, 5000));

    pollResponse = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    responseData = await pollResponse.json();
  } while (
    pollResponse.status === 400 ||
    responseData.error === "authorization_pending"
  );

  // Check for successful response
  if (pollResponse.status === 200) {
    responseData.expires_in = Date.now() + responseData.expires_in * 1000;
    chrome.storage.local.set({ githubAuthentication: responseData });
    console.log("set githubAuthenticationub: ", responseData);
    callback(responseData);
  } else {
    // Handle error
    callback({ state: "ERROR", data: responseData });
    console.error("Error in polling: ", responseData);
  }
}

async function getAuthentication(callback) {
  const auth = await new Promise((resolve, reject) => {
    chrome.storage.local.get(["githubAuthentication"], (data) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(data);
      }
    });
  });

  console.log("getAuthentication() => auth: ", auth);

  if (auth.githubAuthentication && auth.githubAuthentication.access_token) {
    const currentTime = Date.now();
    const tokenExpiryTime = auth.githubAuthentication.expires_in;

    // if (currentTime < tokenExpiryTime) {
    callback(auth.githubAuthentication);
    return auth.githubAuthentication;
    /* } else {
      // Token has expired, use refresh token to get a new access token
      console.log("Token has expired, refreshing token");
      const refreshTokenUrl = "https://github.com/login/oauth/access_token";
      const refreshTokenBody = {
        client_id: "Ov23li8SwPGDIQrWBOs1",
        refresh_token: auth.githubAuthentication.refresh_token,
        grant_type: "refresh_token",
      };

      const refreshResponse = await fetch(refreshTokenUrl, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(refreshTokenBody),
      });

      const newAuthData = await refreshResponse.json();
      newAuthData.expires_in = Date.now() + newAuthData.expires_in * 1000;
      await chrome.storage.local.set({ githubAuthentication: newAuthData });
      callback(newAuthData);
      return newAuthData;
    }
    */
  } else {
    callback({ error: "ERROR" });
    return { error: "No authentication data found" };
  }
}

async function getUser(callback) {
  //check if user is already stored in local storage
  const cachedUser = await new Promise((resolve, reject) => {
    chrome.storage.local.get(["githubUser"], (data) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(data);
      }
    });
  });
  if (cachedUser.githubUser) {
    callback(cachedUser.githubUser);
    return cachedUser.githubUser;
  }
  const auth = await new Promise((resolve, reject) => {
    chrome.storage.local.get(["githubAuthentication"], (data) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(data);
      }
    });
  });
  const token = auth.githubAuthentication.access_token;
  console.log("token => ", token);
  const response = await fetch("https://api.github.com/user", {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
  const response2 = await fetch("https://api.github.com/user/emails", {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
  //store in local storage
  const userObject = await response.json();
  const emailObject = await response2.json();
  console.log("emailObj => ", emailObject);
  userObject.email = emailObject[0].email;
  await chrome.storage.local.set({ githubUser: userObject });
  callback(userObject);
}

async function resetAuth(callback) {
  await chrome.storage.local.remove(["githubAuthentication"]);
  await chrome.storage.local.remove(["githubAuthRequestResponse"]);
  await chrome.storage.local.remove(["githubUser"]);
  callback({ state: "SUCCESS" });
}
