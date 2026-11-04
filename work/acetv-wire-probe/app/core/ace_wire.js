let wasm_bindgen;
(function() {
    const __exports = {};
    let script_src;
    if (typeof document !== 'undefined' && document.currentScript !== null) {
        script_src = new URL(document.currentScript.src, location.href).toString();
    }
    let wasm = undefined;

    let heap = new Array(128).fill(undefined);

    heap.push(undefined, null, true, false);

    function getObject(idx) { return heap[idx]; }

    let WASM_VECTOR_LEN = 0;

    let cachedUint8ArrayMemory0 = null;

    function getUint8ArrayMemory0() {
        if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
            cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
        }
        return cachedUint8ArrayMemory0;
    }

    const cachedTextEncoder = new TextEncoder();

    if (!('encodeInto' in cachedTextEncoder)) {
        cachedTextEncoder.encodeInto = function (arg, view) {
            const buf = cachedTextEncoder.encode(arg);
            view.set(buf);
            return {
                read: arg.length,
                written: buf.length
            };
        }
    }

    function passStringToWasm0(arg, malloc, realloc) {

        if (realloc === undefined) {
            const buf = cachedTextEncoder.encode(arg);
            const ptr = malloc(buf.length, 1) >>> 0;
            getUint8ArrayMemory0().subarray(ptr, ptr + buf.length).set(buf);
            WASM_VECTOR_LEN = buf.length;
            return ptr;
        }

        let len = arg.length;
        let ptr = malloc(len, 1) >>> 0;

        const mem = getUint8ArrayMemory0();

        let offset = 0;

        for (; offset < len; offset++) {
            const code = arg.charCodeAt(offset);
            if (code > 0x7F) break;
            mem[ptr + offset] = code;
        }

        if (offset !== len) {
            if (offset !== 0) {
                arg = arg.slice(offset);
            }
            ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
            const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
            const ret = cachedTextEncoder.encodeInto(arg, view);

            offset += ret.written;
            ptr = realloc(ptr, len, offset, 1) >>> 0;
        }

        WASM_VECTOR_LEN = offset;
        return ptr;
    }

    function isLikeNone(x) {
        return x === undefined || x === null;
    }

    let cachedDataViewMemory0 = null;

    function getDataViewMemory0() {
        if (cachedDataViewMemory0 === null || cachedDataViewMemory0.buffer.detached === true || (cachedDataViewMemory0.buffer.detached === undefined && cachedDataViewMemory0.buffer !== wasm.memory.buffer)) {
            cachedDataViewMemory0 = new DataView(wasm.memory.buffer);
        }
        return cachedDataViewMemory0;
    }

    let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });

    cachedTextDecoder.decode();

    function decodeText(ptr, len) {
        return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
    }

    function getStringFromWasm0(ptr, len) {
        ptr = ptr >>> 0;
        return decodeText(ptr, len);
    }

    let heap_next = heap.length;

    function addHeapObject(obj) {
        if (heap_next === heap.length) heap.push(heap.length + 1);
        const idx = heap_next;
        heap_next = heap[idx];

        heap[idx] = obj;
        return idx;
    }

    function handleError(f, args) {
        try {
            return f.apply(this, args);
        } catch (e) {
            wasm.__wbindgen_exn_store(addHeapObject(e));
        }
    }

    function getArrayU8FromWasm0(ptr, len) {
        ptr = ptr >>> 0;
        return getUint8ArrayMemory0().subarray(ptr / 1, ptr / 1 + len);
    }

    function dropObject(idx) {
        if (idx < 132) return;
        heap[idx] = heap_next;
        heap_next = idx;
    }

    function takeObject(idx) {
        const ret = getObject(idx);
        dropObject(idx);
        return ret;
    }
    /**
     * Build a raw HTTP/1.1 GET request. Caller performs TCP I/O; host must be a known catalog IP.
     * @param {string} cid_hex40
     * @param {string} nonce_decimal_string
     * @param {string} host
     * @returns {Uint8Array}
     */
    __exports.catalog_request = function(cid_hex40, nonce_decimal_string, host) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passStringToWasm0(cid_hex40, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len0 = WASM_VECTOR_LEN;
            const ptr1 = passStringToWasm0(nonce_decimal_string, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len1 = WASM_VECTOR_LEN;
            const ptr2 = passStringToWasm0(host, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len2 = WASM_VECTOR_LEN;
            wasm.catalog_request(retptr, ptr0, len0, ptr1, len1, ptr2, len2);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
            var r3 = getDataViewMemory0().getInt32(retptr + 4 * 3, true);
            if (r3) {
                throw takeObject(r2);
            }
            var v4 = getArrayU8FromWasm0(r0, r1).slice();
            wasm.__wbindgen_free(r0, r1 * 1, 1);
            return v4;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    };

    /**
     * The swarm-infohash namespace uses padded Base64, signed before URL encoding.
     * @param {string} infohash_hex
     * @param {string} nonce_decimal
     * @param {string} host
     * @returns {Uint8Array}
     */
    __exports.catalog_request_infohash = function(infohash_hex, nonce_decimal, host) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passStringToWasm0(infohash_hex, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len0 = WASM_VECTOR_LEN;
            const ptr1 = passStringToWasm0(nonce_decimal, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len1 = WASM_VECTOR_LEN;
            const ptr2 = passStringToWasm0(host, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len2 = WASM_VECTOR_LEN;
            wasm.catalog_request_infohash(retptr, ptr0, len0, ptr1, len1, ptr2, len2);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
            var r3 = getDataViewMemory0().getInt32(retptr + 4 * 3, true);
            if (r3) {
                throw takeObject(r2);
            }
            var v4 = getArrayU8FromWasm0(r0, r1).slice();
            wasm.__wbindgen_free(r0, r1 * 1, 1);
            return v4;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    };

    function passArray8ToWasm0(arg, malloc) {
        const ptr = malloc(arg.length * 1, 1) >>> 0;
        getUint8ArrayMemory0().set(arg, ptr / 1);
        WASM_VECTOR_LEN = arg.length;
        return ptr;
    }
    /**
     * @param {Uint8Array} response
     * @param {string} nonce
     * @param {string} infohash_hex
     * @returns {Uint8Array}
     */
    __exports.catalog_response_infohash = function(response, nonce, infohash_hex) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passArray8ToWasm0(response, wasm.__wbindgen_malloc);
            const len0 = WASM_VECTOR_LEN;
            const ptr1 = passStringToWasm0(nonce, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len1 = WASM_VECTOR_LEN;
            const ptr2 = passStringToWasm0(infohash_hex, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len2 = WASM_VECTOR_LEN;
            wasm.catalog_response_infohash(retptr, ptr0, len0, ptr1, len1, ptr2, len2);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
            var r3 = getDataViewMemory0().getInt32(retptr + 4 * 3, true);
            if (r3) {
                throw takeObject(r2);
            }
            var v4 = getArrayU8FromWasm0(r0, r1).slice();
            wasm.__wbindgen_free(r0, r1 * 1, 1);
            return v4;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    };

    /**
     * Parse an HTTP response, authenticate the catalog XML and return the checksummed transport.
     * @param {Uint8Array} raw_http_bytes
     * @param {string} nonce_decimal
     * @returns {Uint8Array}
     */
    __exports.catalog_response = function(raw_http_bytes, nonce_decimal) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passArray8ToWasm0(raw_http_bytes, wasm.__wbindgen_malloc);
            const len0 = WASM_VECTOR_LEN;
            const ptr1 = passStringToWasm0(nonce_decimal, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len1 = WASM_VECTOR_LEN;
            wasm.catalog_response(retptr, ptr0, len0, ptr1, len1);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
            var r3 = getDataViewMemory0().getInt32(retptr + 4 * 3, true);
            if (r3) {
                throw takeObject(r2);
            }
            var v3 = getArrayU8FromWasm0(r0, r1).slice();
            wasm.__wbindgen_free(r0, r1 * 1, 1);
            return v3;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    };

    /**
     * Encode a signed BEP-10 handshake using a caller-supplied 32-byte Ed25519 seed, returned as hex.
     * @param {string} seed_hex
     * @returns {string}
     */
    __exports.encode_handshake_hex = function(seed_hex) {
        let deferred2_0;
        let deferred2_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passStringToWasm0(seed_hex, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len0 = WASM_VECTOR_LEN;
            wasm.encode_handshake_hex(retptr, ptr0, len0);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            deferred2_0 = r0;
            deferred2_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
        }
    };

    /**
     * Decode an extended handshake and report a signature verification result when signed fields exist.
     * @param {string} data_hex
     * @returns {string}
     */
    __exports.decode_handshake_json = function(data_hex) {
        let deferred2_0;
        let deferred2_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passStringToWasm0(data_hex, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len0 = WASM_VECTOR_LEN;
            wasm.decode_handshake_json(retptr, ptr0, len0);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            deferred2_0 = r0;
            deferred2_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
        }
    };

    /**
     * Decrypt and summarize a transport descriptor without returning its name, trackers, keys, or identifiers.
     * @param {Uint8Array} data
     * @returns {string}
     */
    __exports.transport_summary_json = function(data) {
        let deferred2_0;
        let deferred2_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
            const len0 = WASM_VECTOR_LEN;
            wasm.transport_summary_json(retptr, ptr0, len0);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            deferred2_0 = r0;
            deferred2_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
        }
    };

    /**
     * Run deterministic identity and synthetic transport crypto checks plus an RSA piece-signature round trip.
     * @returns {string}
     */
    __exports.self_test_json = function() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.self_test_json(retptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    };

    /**
     * @param {number} txid
     * @returns {Uint8Array}
     */
    __exports.tracker_connect_request = function(txid) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.tracker_connect_request(retptr, txid);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var v1 = getArrayU8FromWasm0(r0, r1).slice();
            wasm.__wbindgen_free(r0, r1 * 1, 1);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    };

    /**
     * @param {Uint8Array} response
     * @param {number} txid
     * @returns {Uint8Array}
     */
    __exports.tracker_connection_id = function(response, txid) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passArray8ToWasm0(response, wasm.__wbindgen_malloc);
            const len0 = WASM_VECTOR_LEN;
            wasm.tracker_connection_id(retptr, ptr0, len0, txid);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
            var r3 = getDataViewMemory0().getInt32(retptr + 4 * 3, true);
            if (r3) {
                throw takeObject(r2);
            }
            var v2 = getArrayU8FromWasm0(r0, r1).slice();
            wasm.__wbindgen_free(r0, r1 * 1, 1);
            return v2;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    };

    /**
     * @param {Uint8Array} connection_id
     * @param {Uint8Array} infohash
     * @param {Uint8Array} peerid
     * @param {number} txid
     * @param {number} port
     * @returns {Uint8Array}
     */
    __exports.tracker_announce_request = function(connection_id, infohash, peerid, txid, port) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passArray8ToWasm0(connection_id, wasm.__wbindgen_malloc);
            const len0 = WASM_VECTOR_LEN;
            const ptr1 = passArray8ToWasm0(infohash, wasm.__wbindgen_malloc);
            const len1 = WASM_VECTOR_LEN;
            const ptr2 = passArray8ToWasm0(peerid, wasm.__wbindgen_malloc);
            const len2 = WASM_VECTOR_LEN;
            wasm.tracker_announce_request(retptr, ptr0, len0, ptr1, len1, ptr2, len2, txid, port);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
            var r3 = getDataViewMemory0().getInt32(retptr + 4 * 3, true);
            if (r3) {
                throw takeObject(r2);
            }
            var v4 = getArrayU8FromWasm0(r0, r1).slice();
            wasm.__wbindgen_free(r0, r1 * 1, 1);
            return v4;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    };

    /**
     * @param {Uint8Array} response
     * @param {number} txid
     * @returns {string}
     */
    __exports.tracker_peers_json = function(response, txid) {
        let deferred3_0;
        let deferred3_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passArray8ToWasm0(response, wasm.__wbindgen_malloc);
            const len0 = WASM_VECTOR_LEN;
            wasm.tracker_peers_json(retptr, ptr0, len0, txid);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
            var r3 = getDataViewMemory0().getInt32(retptr + 4 * 3, true);
            var ptr2 = r0;
            var len2 = r1;
            if (r3) {
                ptr2 = 0; len2 = 0;
                throw takeObject(r2);
            }
            deferred3_0 = ptr2;
            deferred3_1 = len2;
            return getStringFromWasm0(ptr2, len2);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_free(deferred3_0, deferred3_1, 1);
        }
    };

    /**
     * Decode a transport and expose only its descriptor-derived routing data.
     * @param {Uint8Array} descriptor
     * @returns {string}
     */
    __exports.descriptor_info_json = function(descriptor) {
        let deferred3_0;
        let deferred3_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passArray8ToWasm0(descriptor, wasm.__wbindgen_malloc);
            const len0 = WASM_VECTOR_LEN;
            wasm.descriptor_info_json(retptr, ptr0, len0);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
            var r3 = getDataViewMemory0().getInt32(retptr + 4 * 3, true);
            var ptr2 = r0;
            var len2 = r1;
            if (r3) {
                ptr2 = 0; len2 = 0;
                throw takeObject(r2);
            }
            deferred3_0 = ptr2;
            deferred3_1 = len2;
            return getStringFromWasm0(ptr2, len2);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_free(deferred3_0, deferred3_1, 1);
        }
    };

    const LivePeerFinalization = (typeof FinalizationRegistry === 'undefined')
        ? { register: () => {}, unregister: () => {} }
        : new FinalizationRegistry(ptr => wasm.__wbg_livepeer_free(ptr >>> 0, 1));
    /**
     * Caller-driven single-peer live download. Socket ownership, timeouts and reconnection are
     * deliberately left to the caller; all frame parsing and retained buffers are bounded.
     */
    class LivePeer {

        __destroy_into_raw() {
            const ptr = this.__wbg_ptr;
            this.__wbg_ptr = 0;
            LivePeerFinalization.unregister(this);
            return ptr;
        }

        free() {
            const ptr = this.__destroy_into_raw();
            wasm.__wbg_livepeer_free(ptr, 0);
        }
        /**
         * Drain ordered media bytes after RSA verification and signature-tail removal.
         * @returns {Uint8Array}
         */
        take_media() {
            try {
                const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
                wasm.livepeer_take_media(retptr, this.__wbg_ptr);
                var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
                var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
                var v1 = getArrayU8FromWasm0(r0, r1).slice();
                wasm.__wbindgen_free(r0, r1 * 1, 1);
                return v1;
            } finally {
                wasm.__wbindgen_add_to_stack_pointer(16);
            }
        }
        /**
         * Current state and counters as JSON.
         * @returns {string}
         */
        status_json() {
            let deferred1_0;
            let deferred1_1;
            try {
                const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
                wasm.livepeer_status_json(retptr, this.__wbg_ptr);
                var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
                var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
                deferred1_0 = r0;
                deferred1_1 = r1;
                return getStringFromWasm0(r0, r1);
            } finally {
                wasm.__wbindgen_add_to_stack_pointer(16);
                wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
            }
        }
        /**
         * Drain encoded handshake, extended handshake and bounded chunk requests.
         * @returns {Uint8Array}
         */
        take_outgoing() {
            try {
                const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
                wasm.livepeer_take_outgoing(retptr, this.__wbg_ptr);
                var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
                var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
                var v1 = getArrayU8FromWasm0(r0, r1).slice();
                wasm.__wbindgen_free(r0, r1 * 1, 1);
                return v1;
            } finally {
                wasm.__wbindgen_add_to_stack_pointer(16);
            }
        }
        /**
         * @returns {string}
         */
        take_candidates_json() {
            let deferred1_0;
            let deferred1_1;
            try {
                const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
                wasm.livepeer_take_candidates_json(retptr, this.__wbg_ptr);
                var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
                var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
                deferred1_0 = r0;
                deferred1_1 = r1;
                return getStringFromWasm0(r0, r1);
            } finally {
                wasm.__wbindgen_add_to_stack_pointer(16);
                wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
            }
        }
        /**
         * `descriptor` is a wrapped AceStreamTransport file; `fresh_seed` is exactly 32 bytes.
         * @param {Uint8Array} descriptor
         * @param {Uint8Array} fresh_seed
         */
        constructor(descriptor, fresh_seed) {
            try {
                const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
                const ptr0 = passArray8ToWasm0(descriptor, wasm.__wbindgen_malloc);
                const len0 = WASM_VECTOR_LEN;
                const ptr1 = passArray8ToWasm0(fresh_seed, wasm.__wbindgen_malloc);
                const len1 = WASM_VECTOR_LEN;
                wasm.livepeer_new(retptr, ptr0, len0, ptr1, len1);
                var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
                var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
                var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
                if (r2) {
                    throw takeObject(r1);
                }
                this.__wbg_ptr = r0 >>> 0;
                LivePeerFinalization.register(this, this.__wbg_ptr, this);
                return this;
            } finally {
                wasm.__wbindgen_add_to_stack_pointer(16);
            }
        }
        /**
         * Feed arbitrary partial or concatenated peer bytes.
         * @param {Uint8Array} bytes
         */
        feed(bytes) {
            try {
                const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
                const ptr0 = passArray8ToWasm0(bytes, wasm.__wbindgen_malloc);
                const len0 = WASM_VECTOR_LEN;
                wasm.livepeer_feed(retptr, this.__wbg_ptr, ptr0, len0);
                var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
                var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
                if (r1) {
                    throw takeObject(r0);
                }
            } finally {
                wasm.__wbindgen_add_to_stack_pointer(16);
            }
        }
    }
    if (Symbol.dispose) LivePeer.prototype[Symbol.dispose] = LivePeer.prototype.free;

    __exports.LivePeer = LivePeer;

    const MetadataPeerFinalization = (typeof FinalizationRegistry === 'undefined')
        ? { register: () => {}, unregister: () => {} }
        : new FinalizationRegistry(ptr => wasm.__wbg_metadatapeer_free(ptr >>> 0, 1));
    /**
     * Caller-driven, single-peer transport metadata exchange. The caller owns socket I/O and
     * must enforce its own wall-clock timeout; this object only frames and validates bytes.
     */
    class MetadataPeer {

        __destroy_into_raw() {
            const ptr = this.__wbg_ptr;
            this.__wbg_ptr = 0;
            MetadataPeerFinalization.unregister(this);
            return ptr;
        }

        free() {
            const ptr = this.__destroy_into_raw();
            wasm.__wbg_metadatapeer_free(ptr, 0);
        }
        /**
         * Returns the complete encrypted transport descriptor once verified and decoded.
         * @returns {Uint8Array}
         */
        descriptor() {
            try {
                const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
                wasm.metadatapeer_descriptor(retptr, this.__wbg_ptr);
                var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
                var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
                var v1 = getArrayU8FromWasm0(r0, r1).slice();
                wasm.__wbindgen_free(r0, r1 * 1, 1);
                return v1;
            } finally {
                wasm.__wbindgen_add_to_stack_pointer(16);
            }
        }
        /**
         * @returns {string}
         */
        status_json() {
            let deferred1_0;
            let deferred1_1;
            try {
                const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
                wasm.metadatapeer_status_json(retptr, this.__wbg_ptr);
                var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
                var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
                deferred1_0 = r0;
                deferred1_1 = r1;
                return getStringFromWasm0(r0, r1);
            } finally {
                wasm.__wbindgen_add_to_stack_pointer(16);
                wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
            }
        }
        /**
         * Take queued wire bytes. After peer handshake acceptance this contains the signed ext handshake;
         * after parsing BEP-10 it contains bounded BEP-9 requests.
         * @returns {Uint8Array}
         */
        take_outgoing() {
            try {
                const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
                wasm.metadatapeer_take_outgoing(retptr, this.__wbg_ptr);
                var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
                var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
                var v1 = getArrayU8FromWasm0(r0, r1).slice();
                wasm.__wbindgen_free(r0, r1 * 1, 1);
                return v1;
            } finally {
                wasm.__wbindgen_add_to_stack_pointer(16);
            }
        }
        /**
         * @param {string} target_hash_hex
         * @param {string} random_seed_hex
         */
        constructor(target_hash_hex, random_seed_hex) {
            try {
                const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
                const ptr0 = passStringToWasm0(target_hash_hex, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
                const len0 = WASM_VECTOR_LEN;
                const ptr1 = passStringToWasm0(random_seed_hex, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
                const len1 = WASM_VECTOR_LEN;
                wasm.metadatapeer_new(retptr, ptr0, len0, ptr1, len1);
                var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
                var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
                var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
                if (r2) {
                    throw takeObject(r1);
                }
                this.__wbg_ptr = r0 >>> 0;
                MetadataPeerFinalization.register(this, this.__wbg_ptr, this);
                return this;
            } finally {
                wasm.__wbindgen_add_to_stack_pointer(16);
            }
        }
        /**
         * Feed arbitrary partial or concatenated bytes received from the connected peer.
         * @param {Uint8Array} data
         */
        feed(data) {
            try {
                const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
                const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
                const len0 = WASM_VECTOR_LEN;
                wasm.metadatapeer_feed(retptr, this.__wbg_ptr, ptr0, len0);
                var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
                var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
                if (r1) {
                    throw takeObject(r0);
                }
            } finally {
                wasm.__wbindgen_add_to_stack_pointer(16);
            }
        }
    }
    if (Symbol.dispose) MetadataPeer.prototype[Symbol.dispose] = MetadataPeer.prototype.free;

    __exports.MetadataPeer = MetadataPeer;

    const EXPECTED_RESPONSE_TYPES = new Set(['basic', 'cors', 'default']);

    async function __wbg_load(module, imports) {
        if (typeof Response === 'function' && module instanceof Response) {
            if (typeof WebAssembly.instantiateStreaming === 'function') {
                try {
                    return await WebAssembly.instantiateStreaming(module, imports);

                } catch (e) {
                    const validResponse = module.ok && EXPECTED_RESPONSE_TYPES.has(module.type);

                    if (validResponse && module.headers.get('Content-Type') !== 'application/wasm') {
                        console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);

                    } else {
                        throw e;
                    }
                }
            }

            const bytes = await module.arrayBuffer();
            return await WebAssembly.instantiate(bytes, imports);

        } else {
            const instance = await WebAssembly.instantiate(module, imports);

            if (instance instanceof WebAssembly.Instance) {
                return { instance, module };

            } else {
                return instance;
            }
        }
    }

    function __wbg_get_imports() {
        const imports = {};
        imports.wbg = {};
        imports.wbg.__wbg___wbindgen_is_function_ee8a6c5833c90377 = function(arg0) {
            const ret = typeof(getObject(arg0)) === 'function';
            return ret;
        };
        imports.wbg.__wbg___wbindgen_is_object_c818261d21f283a4 = function(arg0) {
            const val = getObject(arg0);
            const ret = typeof(val) === 'object' && val !== null;
            return ret;
        };
        imports.wbg.__wbg___wbindgen_is_string_fbb76cb2940daafd = function(arg0) {
            const ret = typeof(getObject(arg0)) === 'string';
            return ret;
        };
        imports.wbg.__wbg___wbindgen_is_undefined_2d472862bd29a478 = function(arg0) {
            const ret = getObject(arg0) === undefined;
            return ret;
        };
        imports.wbg.__wbg___wbindgen_string_get_e4f06c90489ad01b = function(arg0, arg1) {
            const obj = getObject(arg1);
            const ret = typeof(obj) === 'string' ? obj : undefined;
            var ptr1 = isLikeNone(ret) ? 0 : passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            var len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        };
        imports.wbg.__wbg___wbindgen_throw_b855445ff6a94295 = function(arg0, arg1) {
            throw new Error(getStringFromWasm0(arg0, arg1));
        };
        imports.wbg.__wbg_call_525440f72fbfc0ea = function() { return handleError(function (arg0, arg1, arg2) {
            const ret = getObject(arg0).call(getObject(arg1), getObject(arg2));
            return addHeapObject(ret);
        }, arguments) };
        imports.wbg.__wbg_call_e762c39fa8ea36bf = function() { return handleError(function (arg0, arg1) {
            const ret = getObject(arg0).call(getObject(arg1));
            return addHeapObject(ret);
        }, arguments) };
        imports.wbg.__wbg_crypto_86f2631e91b51511 = function(arg0) {
            const ret = getObject(arg0).crypto;
            return addHeapObject(ret);
        };
        imports.wbg.__wbg_getRandomValues_b3f15fcbfabb0f8b = function() { return handleError(function (arg0, arg1) {
            getObject(arg0).getRandomValues(getObject(arg1));
        }, arguments) };
        imports.wbg.__wbg_length_69bca3cb64fc8748 = function(arg0) {
            const ret = getObject(arg0).length;
            return ret;
        };
        imports.wbg.__wbg_msCrypto_d562bbe83e0d4b91 = function(arg0) {
            const ret = getObject(arg0).msCrypto;
            return addHeapObject(ret);
        };
        imports.wbg.__wbg_new_no_args_ee98eee5275000a4 = function(arg0, arg1) {
            const ret = new Function(getStringFromWasm0(arg0, arg1));
            return addHeapObject(ret);
        };
        imports.wbg.__wbg_new_with_length_01aa0dc35aa13543 = function(arg0) {
            const ret = new Uint8Array(arg0 >>> 0);
            return addHeapObject(ret);
        };
        imports.wbg.__wbg_node_e1f24f89a7336c2e = function(arg0) {
            const ret = getObject(arg0).node;
            return addHeapObject(ret);
        };
        imports.wbg.__wbg_process_3975fd6c72f520aa = function(arg0) {
            const ret = getObject(arg0).process;
            return addHeapObject(ret);
        };
        imports.wbg.__wbg_prototypesetcall_2a6620b6922694b2 = function(arg0, arg1, arg2) {
            Uint8Array.prototype.set.call(getArrayU8FromWasm0(arg0, arg1), getObject(arg2));
        };
        imports.wbg.__wbg_randomFillSync_f8c153b79f285817 = function() { return handleError(function (arg0, arg1) {
            getObject(arg0).randomFillSync(takeObject(arg1));
        }, arguments) };
        imports.wbg.__wbg_require_b74f47fc2d022fd6 = function() { return handleError(function () {
            const ret = module.require;
            return addHeapObject(ret);
        }, arguments) };
        imports.wbg.__wbg_static_accessor_GLOBAL_89e1d9ac6a1b250e = function() {
            const ret = typeof global === 'undefined' ? null : global;
            return isLikeNone(ret) ? 0 : addHeapObject(ret);
        };
        imports.wbg.__wbg_static_accessor_GLOBAL_THIS_8b530f326a9e48ac = function() {
            const ret = typeof globalThis === 'undefined' ? null : globalThis;
            return isLikeNone(ret) ? 0 : addHeapObject(ret);
        };
        imports.wbg.__wbg_static_accessor_SELF_6fdf4b64710cc91b = function() {
            const ret = typeof self === 'undefined' ? null : self;
            return isLikeNone(ret) ? 0 : addHeapObject(ret);
        };
        imports.wbg.__wbg_static_accessor_WINDOW_b45bfc5a37f6cfa2 = function() {
            const ret = typeof window === 'undefined' ? null : window;
            return isLikeNone(ret) ? 0 : addHeapObject(ret);
        };
        imports.wbg.__wbg_subarray_480600f3d6a9f26c = function(arg0, arg1, arg2) {
            const ret = getObject(arg0).subarray(arg1 >>> 0, arg2 >>> 0);
            return addHeapObject(ret);
        };
        imports.wbg.__wbg_versions_4e31226f5e8dc909 = function(arg0) {
            const ret = getObject(arg0).versions;
            return addHeapObject(ret);
        };
        imports.wbg.__wbindgen_cast_2241b6af4c4b2941 = function(arg0, arg1) {
            // Cast intrinsic for `Ref(String) -> Externref`.
            const ret = getStringFromWasm0(arg0, arg1);
            return addHeapObject(ret);
        };
        imports.wbg.__wbindgen_cast_cb9088102bce6b30 = function(arg0, arg1) {
            // Cast intrinsic for `Ref(Slice(U8)) -> NamedExternref("Uint8Array")`.
            const ret = getArrayU8FromWasm0(arg0, arg1);
            return addHeapObject(ret);
        };
        imports.wbg.__wbindgen_object_clone_ref = function(arg0) {
            const ret = getObject(arg0);
            return addHeapObject(ret);
        };
        imports.wbg.__wbindgen_object_drop_ref = function(arg0) {
            takeObject(arg0);
        };

        return imports;
    }

    function __wbg_finalize_init(instance, module) {
        wasm = instance.exports;
        __wbg_init.__wbindgen_wasm_module = module;
        cachedDataViewMemory0 = null;
        cachedUint8ArrayMemory0 = null;



        return wasm;
    }

    function initSync(module) {
        if (wasm !== undefined) return wasm;


        if (typeof module !== 'undefined') {
            if (Object.getPrototypeOf(module) === Object.prototype) {
                ({module} = module)
            } else {
                console.warn('using deprecated parameters for `initSync()`; pass a single object instead')
            }
        }

        const imports = __wbg_get_imports();

        if (!(module instanceof WebAssembly.Module)) {
            module = new WebAssembly.Module(module);
        }

        const instance = new WebAssembly.Instance(module, imports);

        return __wbg_finalize_init(instance, module);
    }

    async function __wbg_init(module_or_path) {
        if (wasm !== undefined) return wasm;


        if (typeof module_or_path !== 'undefined') {
            if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
                ({module_or_path} = module_or_path)
            } else {
                console.warn('using deprecated parameters for the initialization function; pass a single object instead')
            }
        }

        if (typeof module_or_path === 'undefined' && typeof script_src !== 'undefined') {
            module_or_path = script_src.replace(/\.js$/, '_bg.wasm');
        }
        const imports = __wbg_get_imports();

        if (typeof module_or_path === 'string' || (typeof Request === 'function' && module_or_path instanceof Request) || (typeof URL === 'function' && module_or_path instanceof URL)) {
            module_or_path = fetch(module_or_path);
        }

        const { instance, module } = await __wbg_load(await module_or_path, imports);

        return __wbg_finalize_init(instance, module);
    }

    wasm_bindgen = Object.assign(__wbg_init, { initSync }, __exports);

})();
