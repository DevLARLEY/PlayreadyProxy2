export class RemoteCdm {
    constructor(host, secret, device_name) {
        this.host = host;
        this.secret = secret;
        this.device_name = device_name;
    }

    static from_object(obj) {
        return new RemoteCdm(
            obj.host,
            obj.secret,
            obj.device_name ?? obj.name,
        );
    }

    async open() {
        const open_request = await fetch(
            `${this.host}/${this.device_name}/open`,
            {
                method: 'GET',
                headers: {
                    "X-Secret-Key": this.secret
                }
            }
        );
        console.log("[PlayReadyProxy2]", "REMOTE_CDM", "OPEN", open_request.status);
        const open_json = await open_request.json();

        return open_json.data.session_id;
    }

    async close(session_id) {
        const close_request = await fetch(
            `${this.host}/${this.device_name}/close/${session_id}`,
            {
                method: 'GET',
                headers: {
                    "X-Secret-Key": this.secret
                }
            }
        );
        console.log("[PlayReadyProxy2]", "REMOTE_CDM", "CLOSE", close_request.status);
    }

    async get_license_challenge(session_id, pssh) {
        const license_request = await fetch(
            `${this.host}/${this.device_name}/get_license_challenge`,
            {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    "X-Secret-Key": this.secret
                },
                body: JSON.stringify({
                    session_id: session_id,
                    init_data: pssh
                })
            }
        )
        console.log("[PlayReadyProxy2]", "REMOTE_CDM", "GET_LICENSE_CHALLENGE", license_request.status);
        const license_request_json = await license_request.json();

        return license_request_json.data.challenge_b64;
    }

    async parse_license(session_id, license_message) {
        const license = await fetch(
            `${this.host}/${this.device_name}/parse_license`,
            {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    "X-Secret-Key": this.secret
                },
                body: JSON.stringify({
                    session_id: session_id,
                    license_message: license_message
                })
            }
        )
        console.log("[PlayReadyProxy2]", "REMOTE_CDM", "PARSE_LICENSE", license.status);
    }

    async get_keys(session_id, type) {
        const key_request = await fetch(
            `${this.host}/${this.device_name}/get_keys`,
            {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    "X-Secret-Key": this.secret
                },
                body: JSON.stringify({
                    session_id: session_id
                })
            }
        )
        console.log("[PlayReadyProxy2]", "REMOTE_CDM", "GET_KEYS", key_request.status);
        const key_request_json = await key_request.json();

        return key_request_json.data.keys;
    }
}