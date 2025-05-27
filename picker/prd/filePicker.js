import { SettingsManager } from "../../utils.js";

document.getElementById('fileInput').addEventListener('change', async (event) => {
    const file = event.target.files[0];
    await SettingsManager.importDevice(file).then(() => {
        window.close();
    });
});