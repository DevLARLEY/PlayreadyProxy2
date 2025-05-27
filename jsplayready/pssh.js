import { BinaryReader, Utils } from "./utils.js";

class PlayreadyObject {
    constructor(reader) {
        this.type = reader.readUint16(true);
        this.length = reader.readUint16(true);
        this.wrm_header = null;
        if (this.type === 1) {
            this.wrm_header = Utils.tryGetUtf16Le(reader.readBytes(this.length))
        }
    }
}

class PlayreadyHeader {
    constructor(reader) {
        this.length = reader.readUint32(true);
        this.record_count = reader.readUint16(true);

        this.records = [];
        for (let i = 0; i < this.record_count; i++) {
            this.records.push(new PlayreadyObject(reader))
        }
    }
}

export class Pssh {
    PLAYREADY_SYSTEM_ID = new Uint8Array([0x9a, 0x04, 0xf0, 0x79, 0x98, 0x40, 0x42, 0x86, 0xab, 0x92, 0xe6, 0x5b, 0xe0, 0x88, 0x5f, 0x95])

    constructor(bytes) {
        this.wrm_headers = this._readWrmHeaders(bytes)
    }

    _readWrmHeaders(bytes) {
        const string = Utils.tryGetUtf16Le(bytes);
        if (string !== null) {
            console.log(1);
            return [string]
        }

        if (this._isPsshBox(bytes)) {
            const boxData = bytes.subarray(32);
            const wrmHeader = Utils.tryGetUtf16Le(boxData)
            if (wrmHeader) {
                return [wrmHeader];
            } else {
                const reader = new BinaryReader(boxData);
                return new PlayreadyHeader(reader).records.map(record => record.wrm_header);
            }
        } else {
            const reader = new BinaryReader(bytes.buffer);
            const isPlayreadyHeader = reader.readUint16(true) > 3;
            reader.reset();

            if (isPlayreadyHeader) {
                return new PlayreadyHeader(reader).records.map(record => record.wrm_header);
            } else {
                return [new PlayreadyObject(reader).wrm_header];
            }
        }
    }

    _isPsshBox(bytes) {
        return bytes[0] === 0 && bytes[1] === 0 && bytes.length >= 32 && Utils.compareArrays(bytes.subarray(12, 28), this.PLAYREADY_SYSTEM_ID)
    }
}