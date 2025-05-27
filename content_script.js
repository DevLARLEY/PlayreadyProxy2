function emitAndWaitForResponse(type, data) {
    return new Promise((resolve) => {
        const requestId = Math.random().toString(16).substring(2, 9);

        const responseHandler = (event) => {
            const { detail } = event;
            if (detail.substring(0, 7) === requestId) {
                document.removeEventListener('responseReceived', responseHandler);
                resolve(detail.substring(7));
            }
        };
        document.addEventListener('responseReceived', responseHandler);

        document.dispatchEvent(new CustomEvent('response', {
            detail: {
                type: type,
                body: data,
                requestId: requestId,
            }
        }));
    });
}

function uint8ArrayToBase64(uint8array) {
    return btoa(String.fromCharCode.apply(null, uint8array));
}

function base64toUint8Array(base64_string){
    return Uint8Array.from(atob(base64_string), c => c.charCodeAt(0))
}

function uint8ArrayToString(uint8array) {
    return String.fromCharCode.apply(null, uint8array)
}

function proxy(object, functionName, proxyFunction) {
    if (object.hasOwnProperty(functionName)) {
        const originalFunction = object[functionName];
        object[functionName] = function(...args) {
            return proxyFunction(originalFunction, this, args);
        };
    }
}

(async () => {
    if (typeof EventTarget !== 'undefined') {
        proxy(EventTarget.prototype, 'addEventListener', async (original, target, args) => {
            const [eventType, listener] = args;

            const storeKey = Symbol.for('eventListeners');
            if (!target[storeKey])
                target[storeKey] = {};

            const store = target[storeKey];
            if (!store[eventType])
                store[eventType] = [];

            let newListener = listener;
            if (eventType === "message" && listener && !listener._isWrapped && typeof MediaKeyMessageEvent !== 'undefined') {
                newListener = async function(event) {
                    if (event instanceof MediaKeyMessageEvent && !event._isCustomEvent) {
                        let eventMessage = new Uint8Array(event.message);
                        console.log("PROXYSESSION MESSAGE", event.target.sessionId);

                        const challenge = uint8ArrayToBase64(eventMessage);

                        const newChallenge = await emitAndWaitForResponse("REQUEST", `${event.target.sessionId}|${challenge}`);
                        console.log("[PlayreadyProxy2]", "REPLACING", challenge, newChallenge);

                        if (challenge !== newChallenge) {
                            eventMessage = base64toUint8Array(newChallenge);
                        }

                        const newEvent = new MediaKeyMessageEvent('message', {
                            isTrusted: event.isTrusted,
                            bubbles: event.bubbles,
                            cancelBubble: event.cancelBubble,
                            composed: event.composed,
                            currentTarget: event.currentTarget,
                            defaultPrevented: event.defaultPrevented,
                            eventPhase: event.eventPhase,
                            message: eventMessage.buffer,
                            messageType: event.messageType,
                            returnValue: event.returnValue,
                            srcElement: event.srcElement,
                            target: event.target,
                            timeStamp: event.timeStamp,
                        });
                        newEvent._isCustomEvent = true;

                        target.dispatchEvent(newEvent);
                        event.stopImmediatePropagation();
                        return;
                    }

                    if (listener.handleEvent) {
                        listener.handleEvent(event);
                    } else {
                        listener.call(this, event);
                    }
                };

                newListener._isWrapped = true;
                newListener.originalListener = listener;
            }

            const alreadyAdded = store[eventType].some(
                storedListener => storedListener && storedListener.originalListener === listener
            );

            if (!alreadyAdded) {
                store[eventType].push(newListener);
                args[1] = newListener;
            }

            return original.apply(target, args);
        });
    }

    if (typeof MediaKeySession !== 'undefined') {
        proxy(MediaKeySession.prototype, 'update', async (original, target, args) => {
            const [response] = args;
            console.log("PROXYSESSION UPDATE", target.sessionId);

            console.log("[PlayreadyProxy2]", "UPDATE", response);
            await emitAndWaitForResponse("RESPONSE", `${target.sessionId}|${uint8ArrayToBase64(new Uint8Array(response))}`);

            return await original.apply(target, args);
        });
    }
})();

/*
* I'd love to put this in background.js, but we don't have access to the manifest's content there, and I'm not sending
* it through the event handler
* */
class Evaluator {
    static isDASH(text) {
        return text.includes('<mpd') && text.includes('</mpd>');
    }

    static isHLS(text) {
        return text.includes('#extm3u');
    }

    static isHLSMaster(text) {
        return text.includes('#ext-x-stream-inf');
    }

    static isMSS(text) {
        return text.includes('<smoothstreamingmedia') && text.includes('</smoothstreamingmedia>');
    }

    static getManifestType(text) {
        const lower = text.toLowerCase();
        if (this.isDASH(lower)) {
            return "DASH";
        } else if (this.isHLS(lower)) {
            if (this.isHLSMaster(lower)) {
                return "HLS_MASTER";
            } else {
                return "HLS_PLAYLIST";
            }
        } else if (this.isMSS(lower)) {
            return "MSS";
        }
    }
}

const originalFetch = window.fetch;
window.fetch = function() {
    return new Promise(async (resolve, reject) => {
        originalFetch.apply(this, arguments).then((response) => {
            if (response) {
                response.clone().text().then((text) => {
                    const manifest_type = Evaluator.getManifestType(text);
                    if (manifest_type) {
                        if (arguments.length === 1) {
                            emitAndWaitForResponse("MANIFEST", JSON.stringify({
                                "url": arguments[0].url,
                                "type": manifest_type,
                            }));
                        } else if (arguments.length === 2) {
                            emitAndWaitForResponse("MANIFEST", JSON.stringify({
                                "url": arguments[0],
                                "type": manifest_type,
                            }));
                        }
                    }
                    resolve(response);
                }).catch(() => {
                    resolve(response);
                })
            } else {
                resolve(response);
            }
        }).catch(() => {
            resolve();
        })
    })
}

const open = XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open = function(method, url) {
    this._method = method;
    return open.apply(this, arguments);
};

const send = XMLHttpRequest.prototype.send;
XMLHttpRequest.prototype.send = function(postData) {
    this.addEventListener('load', async function() {
        if (this._method === "GET") {
            let body = void 0;
            switch (this.responseType) {
                case "":
                case "text":
                    body = this.responseText ?? this.response;
                    break;
                case "json":
                    // TODO: untested
                    body = JSON.stringify(this.response);
                    break;
                case "arraybuffer":
                    // TODO: untested
                    if (this.response.byteLength) {
                        const response = new Uint8Array(this.response);
                        body = uint8ArrayToString(new Uint8Array([...response.slice(0, 2000), ...response.slice(-2000)]));
                    }
                    break;
                case "document":
                    // todo
                    break;
                case "blob":
                    body = await this.response.text();
                    break;
            }
            if (body) {
                const manifest_type = Evaluator.getManifestType(body);
                if (manifest_type) {
                    emitAndWaitForResponse("MANIFEST", JSON.stringify({
                        "url": this.responseURL,
                        "type": manifest_type,
                    }));
                }
            }
        }
    });
    return send.apply(this, arguments);
};