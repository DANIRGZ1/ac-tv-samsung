//! Pure BEP-15 UDP tracker packet helpers adapted from Outpace `ace-tracker::codec`.
//! The caller owns UDP I/O; no sockets or Tokio are used here.

use serde_json::json;
use wasm_bindgen::prelude::*;

const PROTOCOL_ID: u64 = 0x41727101980;
const MAX_PEERS: usize = 64;

fn error(message: &str) -> JsValue { JsValue::from_str(message) }
fn u32be(b: &[u8], i: usize) -> u32 { u32::from_be_bytes([b[i], b[i+1], b[i+2], b[i+3]]) }

#[wasm_bindgen]
pub fn tracker_connect_request(txid: u32) -> Vec<u8> {
    let mut out = Vec::with_capacity(16);
    out.extend_from_slice(&PROTOCOL_ID.to_be_bytes());
    out.extend_from_slice(&0u32.to_be_bytes());
    out.extend_from_slice(&txid.to_be_bytes());
    out
}

#[wasm_bindgen]
pub fn tracker_connection_id(response: &[u8], txid: u32) -> Result<Vec<u8>, JsValue> {
    if response.len() != 16 { return Err(error("connect response must be exactly 16 bytes")); }
    if u32be(response, 0) == 3 { return Err(error("tracker error response")); }
    if u32be(response, 0) != 0 { return Err(error("unexpected connect action")); }
    if u32be(response, 4) != txid { return Err(error("connect transaction mismatch")); }
    Ok(response[8..16].to_vec())
}

#[wasm_bindgen]
pub fn tracker_announce_request(connection_id: &[u8], infohash: &[u8], peerid: &[u8], txid: u32, port: u16) -> Result<Vec<u8>, JsValue> {
    if connection_id.len() != 8 { return Err(error("connection ID must be 8 bytes")); }
    if infohash.len() != 20 || peerid.len() != 20 { return Err(error("infohash and peer ID must be 20 bytes")); }
    let mut out = Vec::with_capacity(98);
    out.extend_from_slice(connection_id);
    out.extend_from_slice(&1u32.to_be_bytes());
    out.extend_from_slice(&txid.to_be_bytes());
    out.extend_from_slice(infohash);
    out.extend_from_slice(peerid);
    out.extend_from_slice(&0u64.to_be_bytes()); // downloaded
    out.extend_from_slice(&u64::MAX.to_be_bytes()); // Unknown live remainder, matching ace-swarm's live discovery.
    out.extend_from_slice(&0u64.to_be_bytes()); // uploaded
    out.extend_from_slice(&2u32.to_be_bytes()); // event=started
    out.extend_from_slice(&0u32.to_be_bytes()); // IP (default)
    out.extend_from_slice(&0u32.to_be_bytes()); // key
    out.extend_from_slice(&32i32.to_be_bytes()); // num_want
    out.extend_from_slice(&port.to_be_bytes());
    Ok(out)
}

#[wasm_bindgen]
pub fn tracker_peers_json(response: &[u8], txid: u32) -> Result<String, JsValue> {
    if response.len() < 8 { return Err(error("announce response shorter than 8 bytes")); }
    if u32be(response, 4) != txid { return Err(error("announce transaction mismatch")); }
    let action = u32be(response, 0);
    if action == 3 {
        let message = String::from_utf8_lossy(&response[8..]);
        return Err(error(&format!("tracker error: {message}")));
    }
    if action != 1 { return Err(error("unexpected announce action")); }
    if response.len() < 20 { return Err(error("announce response header shorter than 20 bytes")); }
    let bytes = response.len() - 20;
    if bytes % 6 != 0 { return Err(error("compact peer list has trailing bytes")); }
    let count = bytes / 6;
    if count > MAX_PEERS { return Err(error("tracker returned too many peers")); }
    let mut peers = Vec::with_capacity(count);
    for chunk in response[20..].chunks_exact(6) {
        peers.push(format!("{}.{}.{}.{}:{}", chunk[0], chunk[1], chunk[2], chunk[3], u16::from_be_bytes([chunk[4], chunk[5]])));
    }
    Ok(json!({"interval":u32be(response,8),"peers":peers}).to_string())
}

/// Decode a transport and expose only its descriptor-derived routing data.
#[wasm_bindgen]
pub fn descriptor_info_json(descriptor: &[u8]) -> Result<String, JsValue> {
    if descriptor.len() > 1024 * 1024 { return Err(error("descriptor exceeds 1 MiB")); }
    let decoded = ace_wire::transport::decode_transport(descriptor).map_err(|_| error("transport decode failed"))?;
    let infohash = ace_wire::infohash::infohash_of_decoded_transport(&decoded).map_err(|_| error("transport infohash failed"))?;
    let hash = infohash.iter().map(|b| format!("{b:02x}")).collect::<String>();
    Ok(json!({"infohash":hash,"trackers":decoded.trackers,"piece_length":decoded.piece_length,"chunk_length":decoded.chunk_length,"is_live":decoded.is_live}).to_string())
}
