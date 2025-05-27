import { DOMParser, XMLSerializer } from './jsplayready/xmldom.min.js';
import { Cdm } from './jsplayready/cdm.js';
import { Device } from "./jsplayready/device.js";
import { Utils } from "./jsplayready/utils.js";
import { utils } from "./jsplayready/noble-curves.min.js";
import { AsyncLocalStorage, DeviceManager, RemoteCDMManager, SettingsManager } from "./utils.js";
import { RemoteCdm } from "./jsplayready/remote_cdm.js";

class Background {
    static logs = [];
    static wrmHeaderMap = new Map();
    static manifests = new Map();
    static requests = new Map();

    static async generateChallenge(message, sessionId) {
        const selected_device_name = await DeviceManager.getSelectedPlayreadyDevice();
        if (!selected_device_name) {
            return;
        }

        const device_b64 = await DeviceManager.loadPlayreadyDevice(selected_device_name);
        const playready_device = new Device(Utils.base64ToBytes(device_b64));
        const cdm = Cdm.fromDevice(playready_device);

        const keyMessage = new TextDecoder("utf-16le").decode(message);

        const parser = new DOMParser();
        const serializer = new XMLSerializer();

        const xmlDoc = parser.parseFromString(keyMessage, 'application/xml');

        const challengeElements = xmlDoc.getElementsByTagName("Challenge");
        const challenge = atob(challengeElements[0].textContent);

        /*
        * arbitrary data could be formatted in a special way and parsing it with the spec-compliant xmldom could remove
        * required end tags (e.g. '</KID>')
        * */
        const wrmHeader = challenge.match(/<WRMHEADER.*?WRMHEADER>/gm)[0];

        if (Background.logs.filter(log => log.wrm_header === wrmHeader).length > 0) {
            console.log("[PlayreadyProxy2]", `KEYS_ALREADY_RETRIEVED: ${wrmHeader}`);
            return;
        }

        const challengeDoc = parser.parseFromString(challenge, 'application/xml');

        // transfer
        const revListsElements = challengeDoc.getElementsByTagName("RevocationLists");
        const rawRevLists = revListsElements.length > 0 ? serializer.serializeToString(revListsElements[0]) : "";

        const versionElements = challengeDoc.getElementsByTagName("CLIENTVERSION");
        const version = versionElements.length > 0 ? versionElements[0].textContent : "";
        console.log("version:", version);

        const licenseChallenge = cdm.getLicenseChallenge(wrmHeader, rawRevLists, version);
        const newChallenge = btoa(licenseChallenge);
        console.log("[PlayreadyProxy2]", "REPLACING", challenge, licenseChallenge, sessionId);

        challengeElements[0].textContent = newChallenge;

        const newXmlDoc = serializer.serializeToString(xmlDoc);

        const utf8KeyMessage = new TextEncoder().encode(newXmlDoc);
        const newKeyMessage = new Uint8Array(utf8KeyMessage.length * 2);

        for (let i = 0; i < utf8KeyMessage.length; i++) {
            newKeyMessage[i * 2] = utf8KeyMessage[i];
            newKeyMessage[i * 2 + 1] = 0;
        }

        Background.wrmHeaderMap.set(sessionId, wrmHeader);
        return newKeyMessage;
    }

    static async parseLicense(decodedLicense, sessionId, tab_url) {
        if (!Background.wrmHeaderMap.has(sessionId)) {
            return;
        }

        const selected_device_name = await DeviceManager.getSelectedPlayreadyDevice();
        if (!selected_device_name) {
            return;
        }

        const device_b64 = await DeviceManager.loadPlayreadyDevice(selected_device_name);
        const playready_device = new Device(Utils.base64ToBytes(device_b64));
        const cdm = Cdm.fromDevice(playready_device);

        const returned_keys = cdm.parseLicense(decodedLicense);
        const keys = returned_keys.map(key => ({ k: utils.bytesToHex(key.key), kid: utils.bytesToHex(key.key_id) }));

        const wrmHeader = Background.wrmHeaderMap.get(sessionId);
        console.log("[PlayreadyProxy2]", "KEYS", JSON.stringify(keys), sessionId);

        const log = {
            type: "PLAYREADY",
            wrm_header: wrmHeader,
            keys: keys,
            url: tab_url,
            timestamp: Math.floor(Date.now() / 1000),
            manifests: Background.manifests.has(tab_url) ? Background.manifests.get(tab_url) : []
        }
        Background.logs.push(log);
        await AsyncLocalStorage.setStorage({[wrmHeader]: log});
    }

    static openPrdPicker() {
        chrome.windows.create({
            url: 'picker/prd/filePicker.html',
            type: 'popup',
            width: 300,
            height: 200,
        });
    }

    static openRemotePicker() {
        chrome.windows.create({
            url: 'picker/remote/filePicker.html',
            type: 'popup',
            width: 300,
            height: 200,
        });
    }

    static handleMessage(message, sender, sendResponse) {
        (async () => {
            console.log("MESSAGE RECEIVED", message, sender, sendResponse);
            const tab_url = sender.tab ? sender.tab.url : null;

            switch (message.type) {
                case "REQUEST":
                    const requestParts = message.body.split("|");
                    if (!await SettingsManager.getEnabled()) {
                        sendResponse(requestParts[1]);
                        Background.manifests.clear();
                        return;
                    }

                    const decodedMessage = Utils.base64ToBytes(requestParts[1]);

                    let newKeyMessage = null;

                    const device_type_request = await SettingsManager.getSelectedDeviceType();
                    switch (device_type_request) {
                        case "PRD":
                            newKeyMessage = await Background.generateChallenge(decodedMessage, requestParts[0]);
                            break;
                        case "REMOTE":
                            console.error("not implemented yet");
                            return;
                            //break;
                    }

                    if (!newKeyMessage) {
                        sendResponse(requestParts[1]);
                    }

                    sendResponse(Utils.bytesToBase64(newKeyMessage));
                    break;
                case "RESPONSE":
                    const responseParts = message.body.split("|");
                    if (!await SettingsManager.getEnabled()) {
                        sendResponse(responseParts[1]);
                        Background.manifests.clear();
                        return;
                    }

                    const decodedLicense = atob(responseParts[1]);

                    const device_type_response = await SettingsManager.getSelectedDeviceType();
                    switch (device_type_response) {
                        case "PRD":
                            await Background.parseLicense(decodedLicense, responseParts[0], tab_url);
                            break;
                        case "REMOTE":
                            console.error("not implemented yet");
                            return;
                            //break;
                    }

                    break;
                case "GET_LOGS":
                    sendResponse(Background.logs);
                    break;
                case "CLEAR":
                    Background.logs = [];
                    Background.manifests.clear()
                    break;
                case "OPEN_PICKER_PRD":
                    Background.openPrdPicker();
                    break;
                case "OPEN_PICKER_REMOTE":
                    Background.openRemotePicker();
                    break;
                case "MANIFEST":
                    const parsed = JSON.parse(message.body);
                    const element = {
                        type: parsed.type,
                        url: parsed.url,
                        headers: Background.requests.has(parsed.url) ? Background.requests.get(parsed.url) : [],
                    };

                    if (!Background.manifests.has(tab_url)) {
                        Background.manifests.set(tab_url, [element]);
                    } else {
                        let elements = Background.manifests.get(tab_url);
                        if (!elements.some(e => e.url === parsed.url)) {
                            elements.push(element);
                            Background.manifests.set(tab_url, elements);
                        }
                    }
                    break;
            }

            sendResponse();
        })();
        return true;
    }

    static handleHeaders(details) {
        if (details.method === "GET") {
            if (!Background.requests.has(details.url)) {
                const headers = details.requestHeaders
                    .filter(item => !(
                        item.name.startsWith('sec-ch-ua') ||
                        item.name.startsWith('Sec-Fetch') ||
                        item.name.startsWith('Accept-') ||
                        item.name.startsWith('Host') ||
                        item.name === "Connection"
                    )).reduce((acc, item) => {
                        acc[item.name] = item.value;
                        return acc;
                    }, {});
                Background.requests.set(details.url, headers);
            }
        }
    }
}

chrome.runtime.onMessage.addListener(Background.handleMessage);
chrome.webRequest.onBeforeSendHeaders.addListener(
    Background.handleHeaders,
    { urls: ["<all_urls>"] },
    ['requestHeaders', chrome.webRequest.OnSendHeadersOptions.EXTRA_HEADERS].filter(Boolean)
);
