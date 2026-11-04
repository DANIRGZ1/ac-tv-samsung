use ace_wire::{
    bencode::Bencode,
    extended::{ExtendedHandshake, NodeFields, OutgoingExtendedHandshake},
    identity::{handshake_digest, verify_handshake, Identity},
    live_auth::{split_piece, verify_piece, LiveSourceAuth},
    transport::{decode_transport, encode_transport},
};
use serde_json::json;
use sha2::{Digest, Sha256};
use std::collections::BTreeMap;
use wasm_bindgen::prelude::*;
mod peer;
mod live;
mod catalog;
mod tracker;

fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

fn parse_hex(s: &str) -> Result<Vec<u8>, String> {
    if s.len() > 2 * 1024 * 1024 { return Err("hex input exceeds 1 MiB".into()); }
    if !s.is_ascii() { return Err("hex input must be ASCII".into()); }
    if s.len() % 2 != 0 { return Err("hex input must have even length".into()); }
    (0..s.len()).step_by(2).map(|i| u8::from_str_radix(&s[i..i + 2], 16).map_err(|_| "invalid hex input".into())).collect()
}

fn json_error(e: impl std::fmt::Display) -> String { json!({"ok":false,"error":e.to_string()}).to_string() }

/// Encode a signed BEP-10 handshake using a caller-supplied 32-byte Ed25519 seed, returned as hex.
#[wasm_bindgen]
pub fn encode_handshake_hex(seed_hex: &str) -> String {
    let result = (|| {
        let seed: [u8; 32] = parse_hex(seed_hex)?.try_into().map_err(|_| "seed must be 32 bytes")?;
        let identity = Identity::from_seed(seed);
        let payload = OutgoingExtendedHandshake {
            ace_metadata_version: 1, ut_metadata_id: 1, mi: None,
            node: NodeFields::default(), peer_ip: None, metadata_size: None,
        }.sign_and_encode(&identity);
        Ok::<_, String>(hex(&payload))
    })();
    result.unwrap_or_else(json_error)
}

/// Decode an extended handshake and report a signature verification result when signed fields exist.
#[wasm_bindgen]
pub fn decode_handshake_json(data_hex: &str) -> String {
    let result = (|| {
        let bytes = parse_hex(data_hex)?;
        let hs = ExtendedHandshake::parse(&bytes).map_err(|e| format!("{e:?}"))?;
        let mut signature_valid = if hs.raw.get(b"node_id").is_some() || hs.raw.get(b"signature").is_some() { Some(false) } else { None };
        if let Bencode::Dict(fields) = &hs.raw {
            if let (Some(pk), Some(sig)) = (hs.raw.get(b"node_id").and_then(Bencode::as_bytes), hs.raw.get(b"signature").and_then(Bencode::as_bytes)) {
                let pk: Result<[u8; 32], _> = pk.try_into();
                let sig: Result<[u8; 64], _> = sig.try_into();
                if let (Ok(pk), Ok(sig)) = (pk, sig) {
                    signature_valid = Some(verify_handshake(&pk, &sig, fields));
                } else { signature_valid = Some(false); }
            }
        }
        Ok::<_, String>(json!({"ok":true,"ace_metadata_version":hs.ace_metadata_version,"ut_metadata_id":hs.ut_metadata_id(),"metadata_size":hs.metadata_size(),"signature_valid":signature_valid}).to_string())
    })();
    result.unwrap_or_else(json_error)
}

/// Decrypt and summarize a transport descriptor without returning its name, trackers, keys, or identifiers.
#[wasm_bindgen]
pub fn transport_summary_json(data: &[u8]) -> String {
    if data.len() > 1024 * 1024 { return json_error("transport exceeds 1 MiB"); }
    match decode_transport(data) {
        Ok(d) => json!({"ok":true,"is_live":d.is_live,"piece_length":d.piece_length,"chunk_length":d.chunk_length,"bitrate":d.bitrate,"category_count":d.categories.len(),"tracker_count":d.trackers.len(),"piece_hash_count":d.pieces.len(),"pubkey_bytes":d.pubkey.len()}).to_string(),
        Err(e) => json_error(format!("{e:?}")),
    }
}

/// Run deterministic identity and synthetic transport crypto checks plus an RSA piece-signature round trip.
#[wasm_bindgen]
pub fn self_test_json() -> String {
    let result = (|| {
        // RFC 8032 section 7.1, test 1: independently published Ed25519 vector.
        let rfc_seed: [u8;32] = parse_hex("9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60")?.try_into().unwrap();
        let rfc_identity = Identity::from_seed(rfc_seed);
        let rfc8032_ok = hex(&rfc_identity.node_id()) == "d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a"
            && hex(&rfc_identity.sign(b"")) == concat!(
                "e5564300", "c360ac72", "9086e2cc", "806e828a",
                "84877f1e", "b8e5d974", "d873e065", "22490155",
                "5fb88215", "90a33bac", "c61e3970", "1cf9b46b",
                "d25bf5f0", "595bbe24", "65514143", "8e7a100b");
        let identity = Identity::from_seed([7; 32]);
        let mut fields = BTreeMap::new();
        fields.insert(b"node_id".to_vec(), Bencode::Bytes(identity.node_id().to_vec()));
        fields.insert(b"ts".to_vec(), Bencode::Int(749872));
        let digest = handshake_digest(&fields);
        let sig = identity.sign(&digest);
        let signed_ok = verify_handshake(&identity.node_id(), &sig, &fields);
        fields.insert(b"ts".to_vec(), Bencode::Int(749873));
        let tamper_rejected = !verify_handshake(&identity.node_id(), &sig, &fields);

        let mut descriptor = BTreeMap::new();
        descriptor.insert(b"name".to_vec(), Bencode::Bytes(b"synthetic-fixture".to_vec()));
        descriptor.insert(b"piece_length".to_vec(), Bencode::Int(524288));
        descriptor.insert(b"chunk_length".to_vec(), Bencode::Int(16384));
        let encoded = encode_transport(&Bencode::Dict(descriptor));
        let transport_ok = decode_transport(&encoded).map(|d| d.is_live && d.piece_length == 524288).unwrap_or(false);

        let auth = LiveSourceAuth::generate();
        let payload = b"synthetic live piece payload";
        let mut piece = payload.to_vec();
        piece.extend(auth.sign(payload));
        let (body, signature) = split_piece(&piece, auth.signature_len()).expect("generated signature length");
        let rsa_ok = verify_piece(&auth.pubkey_der(), body, signature);
        let mut altered = body.to_vec(); altered[0] ^= 1;
        let rsa_tamper_rejected = !verify_piece(&auth.pubkey_der(), &altered, signature);
        Ok::<_, String>(json!({"ok":rfc8032_ok && signed_ok && tamper_rejected && transport_ok && rsa_ok && rsa_tamper_rejected,"ed25519_rfc8032_vector":rfc8032_ok,"ed25519_sign_verify":signed_ok,"ed25519_modified_handshake_rejected":tamper_rejected,"synthetic_transport_decode":transport_ok,"rsa_piece_verify":rsa_ok,"rsa_modified_piece_rejected":rsa_tamper_rejected,"transport_sha256":hex(&Sha256::digest(&encoded))}).to_string())
    })();
    result.unwrap_or_else(json_error)
}
