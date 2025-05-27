import { Utils } from './jsplayready/utils.js';
import { RemoteCdm } from './jsplayready/remote_cdm.js';

export class AsyncLocalStorage {
    static async setStorage(items) {
        return new Promise((resolve, reject) => {
            chrome.storage.local.set(items, () => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError));
                } else {
                    resolve();
                }
            });
        });
    }

    static async getStorage(keys) {
        return new Promise((resolve, reject) => {
            chrome.storage.local.get(keys, (result) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError));
                } else {
                    resolve(result);
                }
            });
        });
    }

    static async removeStorage(keys) {
        return new Promise((resolve, reject) => {
            chrome.storage.local.remove(keys, (result) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError));
                } else {
                    resolve(result);
                }
            });
        });
    }
}

export class SettingsManager {
    static async setEnabled(enabled) {
        await AsyncLocalStorage.setStorage({ enabled: enabled });
    }

    static async getEnabled() {
        const result = await AsyncLocalStorage.getStorage(["enabled"]);
        return result["enabled"] === undefined ? false : result["enabled"];
    }

    static downloadFile(content, filename) {
        const blob = new Blob([content], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    static async importDevice(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async function (loaded) {
                const result = loaded.target.result;

                const b64_device = Utils.bytesToBase64(new Uint8Array(result));
                const device_name = file.name.slice(0, -4);

                if (!await DeviceManager.loadPlayreadyDevice(device_name)) {
                    await DeviceManager.savePlayreadyDevice(device_name, b64_device);
                }

                await DeviceManager.saveSelectedPlayreadyDevice(device_name);
                resolve();
            };
            reader.readAsArrayBuffer(file);
        });
    }

    static async saveDarkMode(dark_mode) {
        await AsyncLocalStorage.setStorage({ dark_mode: dark_mode });
    }

    static async getDarkMode() {
        const result = await AsyncLocalStorage.getStorage(["dark_mode"]);
        return result["dark_mode"] || false;
    }

    static setDarkMode(dark_mode) {
        const textImage = document.getElementById("textImage");
        const toggle = document.getElementById('darkModeToggle');
        toggle.checked = dark_mode;
        document.body.classList.toggle('dark-mode', dark_mode);
        textImage.src = dark_mode ? "../images/proxy_text_dark.png" : "../images/proxy_text.png";
    }

    static async loadRemoteCDM(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async function (loaded) {
                const result = loaded.target.result;

                let json_file = null;
                try {
                    json_file = JSON.parse(result);
                } catch {
                    resolve();
                    return;
                }

                const device_name = json_file.device_name ?? json_file.name;
                console.log("NAME:", device_name);

                if (await RemoteCDMManager.loadRemoteCDM(device_name) === "{}") {
                    await RemoteCDMManager.saveRemoteCDM(device_name, json_file);
                }

                await RemoteCDMManager.saveSelectedRemoteCDM(device_name);
                resolve();
            };
            reader.readAsText(file);
        });
    }

    static async saveSelectedDeviceType(selected_type) {
        await AsyncLocalStorage.setStorage({ device_type: selected_type });
    }

    static async getSelectedDeviceType() {
        const result = await AsyncLocalStorage.getStorage(["device_type"]);
        return result["device_type"] || "PRD";
    }

    static setSelectedDeviceType(device_type) {
        switch (device_type) {
            case "PRD":
                /*const prd_select = document.getElementById('prd_select');
                prd_select.checked = true;*/
                break;
            case "REMOTE":
                /*const remote_select = document.getElementById('remote_select');
                remote_select.checked = true;*/
                break;
        }
    }

    static async saveUseShakaPackager(use_shaka) {
        await AsyncLocalStorage.setStorage({ use_shaka: use_shaka });
    }

    static async getUseShakaPackager() {
        const result = await AsyncLocalStorage.getStorage(["use_shaka"]);
        return result["use_shaka"] ?? true;
    }

    static async saveExecutableName(exe_name) {
        await AsyncLocalStorage.setStorage({ exe_name: exe_name });
    }

    static async getExecutableName() {
        const result = await AsyncLocalStorage.getStorage(["exe_name"]);
        return result["exe_name"] ?? "N_m3u8DL-RE";
    }
}

export class RemoteCDMManager {
    static async saveRemoteCDM(name, obj) {
        const result = await AsyncLocalStorage.getStorage(['remote_cdms']);
        const array = result.remote_cdms === undefined ? [] : result.remote_cdms;
        array.push(name);
        await AsyncLocalStorage.setStorage({ remote_cdms: array });
        await AsyncLocalStorage.setStorage({ [name]: obj });
    }

    static async loadRemoteCDM(name) {
        const result = await AsyncLocalStorage.getStorage([name]);
        return JSON.stringify(result[name] || {});
    }

    static setRemoteCDM(name, value){
        const remote_combobox = document.getElementById('remote-combobox');
        const remote_element = document.createElement('option');

        remote_element.text = name;
        remote_element.value = value;

        remote_combobox.appendChild(remote_element);
    }

    static async loadSetAllRemoteCDMs() {
        const result = await AsyncLocalStorage.getStorage(['remote_cdms']);
        const array = result.remote_cdms || [];
        for (const item of array) {
            this.setRemoteCDM(item, await this.loadRemoteCDM(item));
        }
    }

    static async saveSelectedRemoteCDM(name) {
        await AsyncLocalStorage.setStorage({ selected_remote_cdm: name });
    }

    static async getSelectedRemoteCDM() {
        const result = await AsyncLocalStorage.getStorage(["selected_remote_cdm"]);
        return result["selected_remote_cdm"] || "";
    }

    static async selectRemoteCDM(name) {
        document.getElementById('remote-combobox').value = await this.loadRemoteCDM(name);
    }

    static async removeSelectedRemoteCDM() {
        const selected_remote_cdm_name = await RemoteCDMManager.getSelectedRemoteCDM();

        const result = await AsyncLocalStorage.getStorage(['remote_cdms']);
        const array = result.remote_cdms === undefined ? [] : result.remote_cdms;

        const index = array.indexOf(selected_remote_cdm_name);
        if (index > -1) {
            array.splice(index, 1);
        }

        await AsyncLocalStorage.setStorage({ remote_cdms: array });
        await AsyncLocalStorage.removeStorage([selected_remote_cdm_name]);
    }

    static async removeSelectedRemoteCDMKey() {
        await AsyncLocalStorage.removeStorage(["selected_remote_cdm"]);
    }
}

export class DeviceManager {
    static async savePlayreadyDevice(name, value) {
        const result = await AsyncLocalStorage.getStorage(['devices']);
        const array = result.devices === undefined ? [] : result.devices;
        array.push(name);
        await AsyncLocalStorage.setStorage({ devices: array });
        await AsyncLocalStorage.setStorage({ [name]: value });
    }

    static async loadPlayreadyDevice(name) {
        const result = await AsyncLocalStorage.getStorage([name]);
        return result[name] || "";
    }

    static setPlayreadyDevice(name, value){
        const prd_combobox = document.getElementById('prd-combobox');
        const prd_element = document.createElement('option');

        prd_element.text = name;
        prd_element.value = value;

        prd_combobox.appendChild(prd_element);
    }

    static async loadSetAllPlayreadyDevices() {
        const result = await AsyncLocalStorage.getStorage(['devices']);
        const array = result.devices || [];
        for (const item of array) {
            this.setPlayreadyDevice(item, await this.loadPlayreadyDevice(item));
        }
    }

    static async saveSelectedPlayreadyDevice(name) {
        await AsyncLocalStorage.setStorage({ selected: name });
    }

    static async getSelectedPlayreadyDevice() {
        const result = await AsyncLocalStorage.getStorage(["selected"]);
        return result["selected"] || "";
    }

    static async selectPlayreadyDevice(name) {
        document.getElementById('prd-combobox').value = await this.loadPlayreadyDevice(name);
    }

    static async removeSelectedPlayreadyDevice() {
        const selected_device_name = await DeviceManager.getSelectedPlayreadyDevice();

        const result = await AsyncLocalStorage.getStorage(['devices']);
        const array = result.devices === undefined ? [] : result.devices;

        const index = array.indexOf(selected_device_name);
        if (index > -1) {
            array.splice(index, 1);
        }

        await AsyncLocalStorage.setStorage({ devices: array });
        await AsyncLocalStorage.removeStorage([selected_device_name]);
    }

    static async removeSelectedPlayreadyDeviceKey() {
        await AsyncLocalStorage.removeStorage(["selected"]);
    }
}
