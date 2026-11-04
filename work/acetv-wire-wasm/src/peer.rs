use ace_wire::{
    bencode::Bencode,
    extended::{ExtendedHandshake, NodeFields, OutgoingExtendedHandshake},
    handshake::Handshake,
    identity::{verify_handshake, Identity},
    infohash::transport_file_hash,
    message::PeerMessage,
    transport::decode_transport,
    ut_metadata::{piece_count, request_piece, MetadataMessage, METADATA_BLOCK_LEN},
};
use serde_json::json;
use wasm_bindgen::prelude::*;

const MAX_METADATA_SIZE: usize = 1024 * 1024;
const MAX_BUFFERED_INPUT: usize = 2 * 1024 * 1024;
const OUR_UT_METADATA_ID: i64 = 2;
const MAX_METADATA_BLOCKS: usize = 64;
const PEER_ALPHABET: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Phase {
    Handshake,
    Extended,
    Metadata,
    Complete,
    Failed,
}

/// Caller-driven, single-peer transport metadata exchange. The caller owns socket I/O and
/// must enforce its own wall-clock timeout; this object only frames and validates bytes.
#[wasm_bindgen]
pub struct MetadataPeer {
    target: [u8; 20],
    identity: Identity,
    phase: Phase,
    input: Vec<u8>,
    outgoing: Vec<u8>,
    peer_ut_id: Option<u8>,
    metadata_size: Option<usize>,
    blocks: Vec<Option<Vec<u8>>>,
    received: usize,
    descriptor: Option<Vec<u8>>,
    error: Option<String>,
}

fn parse_hex<const N: usize>(s: &str, label: &str) -> Result<[u8; N], JsValue> {
    if !s.is_ascii() || s.len() != N * 2 || s.len() % 2 != 0 {
        return Err(JsValue::from_str(&format!(
            "{label} must be {N} bytes of ASCII hex"
        )));
    }
    let mut out = [0u8; N];
    for (i, pair) in s.as_bytes().chunks_exact(2).enumerate() {
        let hi = (pair[0] as char)
            .to_digit(16)
            .ok_or_else(|| JsValue::from_str("invalid hex"))?;
        let lo = (pair[1] as char)
            .to_digit(16)
            .ok_or_else(|| JsValue::from_str("invalid hex"))?;
        out[i] = ((hi << 4) | lo) as u8;
    }
    Ok(out)
}

fn peer_id(seed: &[u8; 32]) -> [u8; 20] {
    let mut id = [0u8; 20];
    id[..9].copy_from_slice(b"R30------");
    for (dst, src) in id[9..].iter_mut().zip(seed.iter()) {
        *dst = PEER_ALPHABET[(*src as usize) % PEER_ALPHABET.len()];
    }
    id
}

#[wasm_bindgen]
impl MetadataPeer {
    #[wasm_bindgen(constructor)]
    pub fn new(target_hash_hex: &str, random_seed_hex: &str) -> Result<MetadataPeer, JsValue> {
        let target = parse_hex::<20>(target_hash_hex, "target hash")?;
        let seed = parse_hex::<32>(random_seed_hex, "seed")?;
        let identity = Identity::from_seed(seed);
        let handshake = Handshake::new(target, peer_id(&seed)).encode();
        Ok(MetadataPeer {
            target,
            identity,
            phase: Phase::Handshake,
            input: Vec::new(),
            outgoing: handshake.to_vec(),
            peer_ut_id: None,
            metadata_size: None,
            blocks: Vec::new(),
            received: 0,
            descriptor: None,
            error: None,
        })
    }

    /// Take queued wire bytes. After peer handshake acceptance this contains the signed ext handshake;
    /// after parsing BEP-10 it contains bounded BEP-9 requests.
    pub fn take_outgoing(&mut self) -> Vec<u8> {
        std::mem::take(&mut self.outgoing)
    }

    /// Feed arbitrary partial or concatenated bytes received from the connected peer.
    pub fn feed(&mut self, data: &[u8]) -> Result<(), JsValue> {
        if self.phase == Phase::Failed {
            return Err(JsValue::from_str(
                self.error.as_deref().unwrap_or("peer failed"),
            ));
        }
        if self.phase == Phase::Complete {
            return Ok(());
        }
        if data.len() > MAX_BUFFERED_INPUT.saturating_sub(self.input.len()) {
            return self.fail("partial input buffer exceeds 2 MiB");
        }
        self.input.extend_from_slice(data);

        loop {
            match self.phase {
                Phase::Handshake => {
                    if self.input.len() < 66 {
                        break;
                    }
                    let peer = match Handshake::decode(&self.input[..66]) {
                        Ok(peer) => peer,
                        Err(e) => return self.fail(&format!("bad peer handshake: {e:?}")),
                    };
                    if peer.infohash != self.target {
                        return self.fail("peer infohash mismatch");
                    }
                    self.input.drain(..66);
                    let hs = OutgoingExtendedHandshake {
                        ace_metadata_version: 1,
                        ut_metadata_id: OUR_UT_METADATA_ID,
                        mi: None,
                        node: NodeFields::default(),
                        peer_ip: None,
                        metadata_size: None,
                    };
                    self.outgoing.extend(
                        PeerMessage::Extended {
                            ext_id: 0,
                            payload: hs.sign_and_encode(&self.identity),
                        }
                        .encode(),
                    );
                    self.phase = Phase::Extended;
                }
                Phase::Extended | Phase::Metadata => {
                    let (msg, used) = match PeerMessage::decode(&self.input) {
                        Ok(Some(v)) => v,
                        Ok(None) => break,
                        Err(e) => return self.fail(&format!("bad peer frame: {e:?}")),
                    };
                    self.input.drain(..used);
                    self.on_message(msg)?;
                }
                Phase::Complete => {
                    self.input.clear();
                    break;
                }
                Phase::Failed => return Err(JsValue::from_str("peer failed")),
            }
        }
        Ok(())
    }

    pub fn status_json(&self) -> String {
        json!({
            "state": match self.phase { Phase::Handshake => "handshake", Phase::Extended => "extended", Phase::Metadata => "metadata", Phase::Complete => "complete", Phase::Failed => "failed" },
            "received_blocks": self.received,
            "total_blocks": self.blocks.len(),
            "metadata_size": self.metadata_size,
            "error": self.error,
        }).to_string()
    }

    /// Returns the complete encrypted transport descriptor once verified and decoded.
    pub fn descriptor(&self) -> Vec<u8> {
        self.descriptor.clone().unwrap_or_default()
    }
}

impl MetadataPeer {
    fn fail<T>(&mut self, message: &str) -> Result<T, JsValue> {
        self.phase = Phase::Failed;
        self.error = Some(message.to_string());
        Err(JsValue::from_str(message))
    }

    fn on_message(&mut self, msg: PeerMessage) -> Result<(), JsValue> {
        match (self.phase, msg) {
            (Phase::Extended, PeerMessage::Extended { ext_id: 0, payload }) => {
                let hs = match ExtendedHandshake::parse(&payload) {
                    Ok(hs) => hs,
                    Err(e) => return self.fail(&format!("bad extended handshake: {e:?}")),
                };
                let raw = &hs.raw;
                if let Bencode::Dict(fields) = raw {
                    let pk_field = raw.get(b"node_id");
                    let sig_field = raw.get(b"signature");
                    match (pk_field, sig_field) {
                        (None, None) => {}
                        (Some(Bencode::Bytes(pk)), Some(Bencode::Bytes(sig))) => {
                            let pk: [u8; 32] = match pk.as_slice().try_into() {
                                Ok(pk) => pk,
                                Err(_) => return self.fail("invalid node_id length"),
                            };
                            let sig: [u8; 64] = match sig.as_slice().try_into() {
                                Ok(sig) => sig,
                                Err(_) => return self.fail("invalid signature length"),
                            };
                            if !verify_handshake(&pk, &sig, fields) {
                                return self.fail("peer handshake signature invalid");
                            }
                        }
                        _ => return self.fail("partial or malformed peer signature fields"),
                    }
                }
                let ext_id = match hs.ut_metadata_id() {
                    Some(id) => id,
                    None => return self.fail("peer has no ut_metadata"),
                };
                if !(1..=255).contains(&ext_id) {
                    return self.fail("invalid peer ut_metadata id");
                }
                let size = match hs.metadata_size() {
                    Some(size) => size,
                    None => return self.fail("peer has no metadata_size"),
                };
                if size <= 0 || size as u64 > MAX_METADATA_SIZE as u64 {
                    return self.fail("invalid metadata_size");
                }
                let size = size as usize;
                let count = piece_count(size);
                if count == 0 || count > MAX_METADATA_BLOCKS {
                    return self.fail("metadata block count exceeds limit");
                }
                self.peer_ut_id = Some(ext_id as u8);
                self.metadata_size = Some(size);
                self.blocks = vec![None; count];
                self.phase = Phase::Metadata;
                for piece in 0..count {
                    let payload = request_piece(piece as i64);
                    self.outgoing.extend(
                        PeerMessage::Extended {
                            ext_id: ext_id as u8,
                            payload,
                        }
                        .encode(),
                    );
                }
                Ok(())
            }
            (Phase::Metadata, PeerMessage::Extended { ext_id, payload })
                if ext_id == OUR_UT_METADATA_ID as u8 =>
            {
                let msg = match MetadataMessage::parse(&payload) {
                    Some(msg) => msg,
                    None => return self.fail("malformed ut_metadata"),
                };
                match msg {
                    MetadataMessage::Reject { .. } => self.fail("peer rejected metadata request"),
                    MetadataMessage::Request { .. } => Ok(()),
                    MetadataMessage::Data {
                        piece,
                        total_size,
                        data,
                    } => {
                        let size = match self.metadata_size {
                            Some(size) => size,
                            None => return self.fail("missing metadata size"),
                        };
                        let count = self.blocks.len();
                        if piece < 0 || piece as usize >= count {
                            return self.fail("metadata piece index out of range");
                        }
                        if total_size != Some(size as i64) {
                            return self.fail("metadata total_size mismatch");
                        }
                        let idx = piece as usize;
                        let expected = if idx + 1 == count {
                            size - idx * METADATA_BLOCK_LEN
                        } else {
                            METADATA_BLOCK_LEN
                        };
                        if data.len() != expected {
                            return self.fail("metadata piece length mismatch");
                        }
                        if self.blocks[idx].is_some() {
                            return self.fail("duplicate metadata piece");
                        }
                        self.blocks[idx] = Some(data);
                        self.received += 1;
                        if self.received == count {
                            let blocks = match self
                                .blocks
                                .iter_mut()
                                .map(Option::take)
                                .collect::<Option<Vec<_>>>()
                            {
                                Some(blocks) => blocks,
                                None => return self.fail("missing metadata block"),
                            };
                            let mut blob = Vec::with_capacity(size);
                            for block in blocks {
                                blob.extend(block);
                            }
                            if blob.len() != size {
                                return self.fail("assembled metadata size mismatch");
                            }
                            if transport_file_hash(&blob) != self.target {
                                return self.fail("transport hash mismatch");
                            }
                            if let Err(e) = decode_transport(&blob) {
                                return self.fail(&format!("invalid transport descriptor: {e:?}"));
                            }
                            self.descriptor = Some(blob);
                            self.phase = Phase::Complete;
                        }
                        Ok(())
                    }
                }
            }
            (Phase::Extended, _) => Ok(()),
            (Phase::Metadata, _) => Ok(()),
            _ => self.fail("message in invalid peer state"),
        }
    }
}
