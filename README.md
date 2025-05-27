# PlayreadyProxy2
An extension-based proxy for PlayReady EME challenges and license messages. \
Modifies the challenge before it reaches the web player and retrieves the decryption keys from the response.

## Features
+ User-friendly / GUI-based
+ Bypasses one-time tokens, hashes, and license wrapping
+ JavaScript native PlayReady implementation
+ Supports PlayReady Device files
+ Manifest V3 compliant

## PlayReady Devices
This addon requires a PlayReady Device file to work, which is not provided by this project.

## Compatibility
+ Compatible (tested) browsers: Edge/Firefox on Windows.

## Installation
+ Chrome
  1. Download the ZIP file from the [releases section](https://github.com/DevLARLEY/PlayreadyProxy2/releases)
  2. Navigate to `chrome://extensions/`
  3. Enable `Developer mode`
  4. Drag-and-drop the downloaded file into the window
+ Firefox
  + Persistent installation
    1. Download the XPI file from the [releases section](https://github.com/DevLARLEY/PlayreadyProxy2/releases)
    2. Navigate to `about:addons`
    3. Click the settings icon and choose `Install Add-on From File...`
    4. Select the downloaded file
  + Temporary installation
    1. Download the ZIP file from the [releases section](https://github.com/DevLARLEY/PlayreadyProxy2/releases)
    2. Navigate to `about:debugging#/runtime/this-firefox`
    3. Click `Load Temporary Add-on...` and select the downloaded file

## Setup
### PlayReady Device
If you only have a `bgroupcert.dat` and `zgpriv.dat`, run this command to create a .prd file:
```
pyplayready create-device -k zgpriv.dat -c bgroupcert.dat
```
Now, open the extension, click `Choose File` and select your PlayReady Device file.

## Usage
All the user has to do is to play a DRM protected video and the decryption keys should appear in the `Keys` group box (if the service is not unsupported, as stated above). \
Keys are saved:
+ Temporarily until the extension is either refreshed manually (if installed temporarily) or a removal of the keys is manually initiated.
+ Permanently in the extension's `chrome.storage.local` storage until manually wiped or exported via the command line.
> [!NOTE]  
> The video will not play when the interception is active, as the PlayReady CDM library isn't able to decrypt the license keys.

+ Click the `+` button to expand the section to reveal the WRMHEADER and keys.

## Issues
+ DRM playback won't work when the extension is disabled and EME Logger is active. This is caused by my fix for dealing with EME Logger interference (solutions are welcome).

## Disclaimer
+ This program is intended solely for educational purposes.
+ Do not use this program to decrypt or access any content for which you do not have the legal rights or explicit permission.
+ Unauthorized decryption or distribution of copyrighted materials is a violation of applicable laws and intellectual property rights.
+ This tool must not be used for any illegal activities, including but not limited to piracy, circumventing digital rights management (DRM), or unauthorized access to protected content.
+ The developers, contributors, and maintainers of this program are not responsible for any misuse or illegal activities performed using this software.
+ By using this program, you agree to comply with all applicable laws and regulations governing digital rights and copyright protections.

## Credits
+ [forge](https://github.com/digitalbazaar/forge)
+ [noble-curves](https://github.com/paulmillr/noble-curves)
+ [xmldom](https://github.com/xmldom/xmldom)