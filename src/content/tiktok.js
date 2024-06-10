let blockingElement = document.getElementById("blockingElement")
let tt_cookies = ""
let tt_cookieArr = []

const tt_blocklist = [
  { "traviskelce": "MS4wLjABAAAAQut5oOYxp4-lorxIpsRkU1XE3-KuqL0JJq0jbzlngXlgiZcW8l8cawCNX69ansVp" },
  { "haleyybaylee": "MS4wLjABAAAAwTcFgYUrQR1xD84QbFNU5JXFQ33wAAxT2frlPrTsH4NYTNuwPvExi2mJgiu03hGf" },
  { "jeffjacksonnc": "MS4wLjABAAAAZOQYqlJDh_Q3Nm1-wVs_8aseMBdfykKetnV5qH5ux4NBqjaDMi8fuKq_JXiPzi33" },
  { "iamcardib": "MS4wLjABAAAAFg2m8gH-rNBrv_6YcFiNUJjeOniHIbIk5rxv5qea9SuNDca39mblsXvBzYQq3EQP" },
  { "nickiminaj": "MS4wLjABAAAAs5jkeWdu5hM55BndQETUnl4rll7H8fthkyz5JmF3P5qKdh_mLcAUVGJ16WPpEI_M" },
  { "camilacabello": "MS4wLjABAAAAakkZYjH61hI2DN_7kKK3jMxksRuQuzafOGKm98BXObYcdFfiKnAjvtg2fmlXjxFO" },
  { "kyliejenner": "MS4wLjABAAAArK0Wz24jqHzcTuvH6y7H0KZJEbfgbCp03noTihWxrNYt26w2Fl6FAwCF-RRbNnOL" },
  { "kendalljenner": "MS4wLjABAAAA6VTERy_5iOOec0gy_0ti0Mjpa3mWw3sWA9M-Gptu9jurqU40ebqXlgIrRwuuLAkE" },
  { "awkwafina": "MS4wLjABAAAAwXwfobYyHYRIWBhdJzfihL47xhcXzy-EEdcNK9c2xRmtfuNGpeyzWFq_yphqKxpN" },
  { "taylornation": "MS4wLjABAAAATOyRAXMoa_yS82hI2holT9Dbi_zDpjay9cralDPtz0uQVp8KOMvcSDkbuljy797Y" },
  { "usher": "MS4wLjABAAAA2qFUyY878XlTp6vlLi2LWROamZKwkQfqRLMHo8O0UizXpnO-yXE2qR7QZKRCJJy_" },
  { "syds_garage": "MS4wLjABAAAAw4t7ETCYlRpwQb9iNrCdt44-TapGDUqNQEd6YeW332PXNhoeDj8I_PJ4TxTlcMgO" },
  { "jimmyfallon": "MS4wLjABAAAAYNWV5WVYk8YubQBqAl5-No5ilL5pQwWFxq8homewtuXc4-tLEkWVEGUiUNJ8gLBC" },
]

chrome.cookies.getAll({domain: "tiktok.com"}, res => {
  res.forEach(cookie => {
    if(cookie.sameSite == "None") return
    tt_cookies += `${cookie.name}=${cookie.value}; `;
    tt_cookieArr.push(cookie)
  });
});
let device_id = undefined;

function getDeviceId() {
  return localStorage.getItem("__tea_cache_tokens_548444")
}

let params = {
    WebIdLastTime: 1713578425,
    aid: 1988,
    app_language: "en",
    app_name: "tiktok_web",
    block_type: 1,
    browser_language: "en-US",
    browser_name: "Mozilla",
    browser_online: true,
    browser_platform: "MacIntel",
    browser_version: "5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    channel: "tiktok_web",
    cookie_enabled: true,
    device_id: 0,
    device_platform: "web_pc",
    focus_state: true,
    from_page: "user",
    history_len: 10,
    is_fullscreen: false,
    is_page_visible: true,
    os: "mac",
    priority_region: "US",
    referer: "",
    region: "US",
    root_referer: "",
    screen_height: 1120,
    screen_width: 1792,
    sec_user_id: "",
    source: 3,
    tz_name: "America/Chicago",
    verifyFp: tt_cookieArr.find(cookie => cookie.name === "s_v_web_id")?.value,
    webcast_language: "en"
}


async function blockUserOnTikTok(account, params, cookies, cookieArr) {
  chrome.runtime.sendMessage({ handle: `${Object.keys(account)[0]}`, platform: `TikTok` });
  const handle = Object.keys(account)[0]
  params.referer = `https://www.tiktok.com/@${handle}?lang=en`
  params.root_referer = `https://www.tiktok.com/@${handle}`
  params.sec_user_id = account[handle];
  const urlParams = new URLSearchParams(params).toString()
  await fetch(`https://www.tiktok.com/api/user/block/?${urlParams}`, {
    "headers": {
      "accept": "*/*",
      "content-type": "application/x-www-form-urlencoded",
      "priority": "u=1, i",
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-origin",
      "tt-csrf-token": cookieArr.find(cookie => cookie.name === "tt_csrf_token").value,
      "cookie": cookies,
      "Referer": `https://www.tiktok.com/@${handle}?lang=en`,
      "Referrer-Policy": "strict-origin-when-cross-origin"
    },
    "body": "",
    "method": "POST"
  })
}


async function blockout() {
  try{
    const tabs = await chrome.tabs.query({active: true, currentWindow: true})
    const frames = await chrome.scripting
        .executeScript({
          target : {tabId: tabs[0].id},
          func : getDeviceId,
        })
      const device_id = JSON.parse(frames[0].result).web_id
      params.device_id = device_id
      for(const account of tt_blocklist){
        await blockUserOnTikTok(account, params, tt_cookies, tt_cookieArr)
        await new Promise(resolve => setTimeout(resolve, 1000))
        blockingElement.innerText = `blocking @${Object.keys(account)[0]}`
      }
      blockingElement.innerText = "Done!"
  } catch (error) {
    blockingElement.innerText = "Please log into tiktok 🙏🏽"
    console.error(error)
  }
}


document.getElementById("cleanup").addEventListener("click", () =>{
  blockout()
})



let ttHeaderButton = document.getElementById("ttbutton").addEventListener("click", async () => {
  let purgeButton = document.getElementById("cleanup")

  purgeButton.replaceWith(purgeButton.cloneNode(true))
  purgeButton = document.getElementById("cleanup")
  let purgeButtonImg = document.getElementById("purgebuttonimg");

  purgeButton.onclick = blockout
  purgeButtonImg.src = "../../images/ttlogo.png"
})

chrome.runtime.onMessage.addListener(function (message, sender) {
  if(message.platform === "TikTok") blockingElement.innerText = `blocking @${message.handle}`
});

