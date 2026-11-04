use ace_wire::{
    bencode::Bencode,
    extended::{ExtendedHandshake, LivePosition, NodeFields, OutgoingExtendedHandshake},
    handshake::Handshake,
    identity::{verify_handshake, Identity},
    infohash::infohash_of_decoded_transport,
    live::{LivePicker, LiveWindow},
    live_codec::{chunk_request, LiveChunk},
    message::PeerMessage,
    reassembly::PieceReassembler,
    transport::decode_transport,
};
use serde_json::json;
use std::collections::{BTreeSet,BTreeMap};
use wasm_bindgen::prelude::*;

const MAX_DESCRIPTOR: usize = 1024 * 1024;
const MAX_INPUT: usize = 2 * 1024 * 1024;
const MAX_PIECE: u64 = 8 * 1024 * 1024;
const MAX_MEDIA: usize = 8 * 1024 * 1024;
const MAX_OUTGOING: usize = 1024 * 1024;
const MAX_CHUNKS: usize = 4096;
const LIVE_BUFFER_PIECES: u64 = 2;

#[derive(Clone, Copy, PartialEq, Eq)]
enum Phase { Handshake, Extended, Live, Failed }

/// Caller-driven single-peer live download. Socket ownership, timeouts and reconnection are
/// deliberately left to the caller; all frame parsing and retained buffers are bounded.
#[wasm_bindgen]
pub struct LivePeer {
    infohash: [u8; 20], identity: Identity, phase: Phase,
    input: Vec<u8>, outgoing: Vec<u8>, media: Vec<u8>,
    piece_length: u64, chunk_length: u64, pubkey: Vec<u8>,
    window: Option<LiveWindow>, picker: Option<LivePicker>, reasm: Option<PieceReassembler>,
    requested_piece: Option<u32>, pending_chunks: BTreeSet<u16>, unchoked: bool,
    error: Option<String>, pieces: u64,
    message_counts:BTreeMap<u8,u64>,source_time:Option<f64>,
    candidates:Vec<(String,u16,u64)>,
}

#[wasm_bindgen]
impl LivePeer {
    /// `descriptor` is a wrapped AceStreamTransport file; `fresh_seed` is exactly 32 bytes.
    #[wasm_bindgen(constructor)]
    pub fn new(descriptor: &[u8], fresh_seed: &[u8]) -> Result<LivePeer, JsValue> {
        if descriptor.len() > MAX_DESCRIPTOR { return Err(js("descriptor exceeds 1 MiB")); }
        let seed: [u8; 32] = fresh_seed.try_into().map_err(|_| js("fresh seed must be 32 bytes"))?;
        let d = decode_transport(descriptor).map_err(|e| js(&format!("invalid transport: {e:?}")))?;
        if !d.is_live { return Err(js("descriptor is not live")); }
        if d.piece_length == 0 || d.piece_length > MAX_PIECE || d.chunk_length == 0
            || d.piece_length % d.chunk_length != 0 || d.piece_length / d.chunk_length > MAX_CHUNKS as u64
            || d.chunk_length > u32::MAX as u64 {
            return Err(js("unsupported live piece geometry"));
        }
        let sig_len = ace_wire::live_auth::signature_len_from_pubkey_der(&d.pubkey)
            .ok_or_else(|| js("live descriptor has no valid RSA source key"))?;
        if sig_len as u64 >= d.piece_length { return Err(js("RSA signature exceeds piece length")); }
        let infohash = infohash_of_decoded_transport(&d).map_err(|e| js(&format!("infohash failed: {e:?}")))?;
        let identity = Identity::from_seed(seed);
        let mut peer_id = [b'0'; 20];
        peer_id[..9].copy_from_slice(b"R30------");
        const ALPHABET: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        for (dst, src) in peer_id[9..].iter_mut().zip(seed.iter()) { *dst = ALPHABET[*src as usize % ALPHABET.len()]; }
        let outgoing = Handshake::new(infohash, peer_id).encode().to_vec();
        Ok(LivePeer {
            infohash, identity, phase: Phase::Handshake, input: Vec::new(), outgoing, media: Vec::new(),
            piece_length: d.piece_length, chunk_length: d.chunk_length, pubkey: d.pubkey,
            window: None, picker: None, reasm: None, requested_piece: None,
            pending_chunks: BTreeSet::new(), unchoked: false, error: None, pieces: 0,
            message_counts:BTreeMap::new(),source_time:None,
            candidates:Vec::new(),
        })
    }

    /// Drain encoded handshake, extended handshake and bounded chunk requests.
    pub fn take_outgoing(&mut self) -> Vec<u8> { std::mem::take(&mut self.outgoing) }

    /// Feed arbitrary partial or concatenated peer bytes.
    pub fn feed(&mut self, bytes: &[u8]) -> Result<(), JsValue> {
        if self.phase == Phase::Failed { return Err(js(self.error.as_deref().unwrap_or("live peer failed"))); }
        if bytes.len() > MAX_INPUT.saturating_sub(self.input.len()) { return self.fail("input buffer exceeds 2 MiB"); }
        self.input.extend_from_slice(bytes);
        loop {
            match self.phase {
                Phase::Handshake => {
                    if self.input.len() < 66 { break; }
                    let hs = match Handshake::decode(&self.input[..66]) { Ok(hs)=>hs, Err(e)=>return self.fail(&format!("bad handshake: {e:?}")) };
                    if hs.infohash != self.infohash { return self.fail("peer infohash mismatch"); }
                    self.input.drain(..66);
                    let ext = OutgoingExtendedHandshake { ace_metadata_version: 1, ut_metadata_id: 2,
                        mi: Some(LivePosition { min_piece: -1, max_piece: -1, position: -1, distance_from_source: -1 }),
                        node: NodeFields::default(), peer_ip: None, metadata_size: None };
                    self.push(PeerMessage::Extended { ext_id: 0, payload: ext.sign_and_encode(&self.identity) })?;
                    self.phase = Phase::Extended;
                }
                Phase::Extended | Phase::Live => {
                    let (msg, used) = match PeerMessage::decode(&self.input) {
                        Ok(Some(v)) => v, Ok(None) => break, Err(e) => return self.fail(&format!("bad peer frame: {e:?}")),
                    };
                    self.input.drain(..used);
                    let id=match &msg {PeerMessage::KeepAlive=>255,PeerMessage::Choke=>0,PeerMessage::Unchoke=>1,PeerMessage::Interested=>2,PeerMessage::NotInterested=>3,PeerMessage::Have(_)=>4,PeerMessage::Bitfield(_)=>5,PeerMessage::Request{..}=>6,PeerMessage::Piece{..}=>7,PeerMessage::Cancel{..}=>8,PeerMessage::Extended{..}=>20,PeerMessage::Unknown{id,..}=>*id};
                    *self.message_counts.entry(id).or_insert(0)+=1;
                    if let Err(error)=self.on_message(msg) {
                        return self.fail(&error.as_string().unwrap_or_else(|| "invalid live peer message".into()));
                    }
                }
                Phase::Failed => return Err(js("live peer failed")),
            }
        }
        Ok(())
    }

    /// Current state and counters as JSON.
    pub fn status_json(&self) -> String {
        json!({"state":match self.phase { Phase::Handshake=>"handshake", Phase::Extended=>"extended", Phase::Live=>"live", Phase::Failed=>"failed" },
            "window":self.window.map(|w| json!({"min_piece":w.min_piece,"max_piece":w.max_piece,"position":w.position})),
            "requested_piece":self.requested_piece,"pending_chunks":self.pending_chunks.len(),"verified_pieces":self.pieces,
            "buffered_media":self.media.len(),"message_counts":self.message_counts,"claimed_source_time":self.source_time,"error":self.error}).to_string()
    }

    /// Drain ordered media bytes after RSA verification and signature-tail removal.
    pub fn take_media(&mut self) -> Vec<u8> { std::mem::take(&mut self.media) }

    pub fn take_candidates_json(&mut self)->String {
        let candidates=std::mem::take(&mut self.candidates);
        serde_json::Value::Array(candidates.into_iter().map(|(host,port,head)|json!({"host":host,"port":port,"head":head})).collect()).to_string()
    }
}

impl LivePeer {
    fn on_message(&mut self, msg: PeerMessage) -> Result<(), JsValue> {
        match msg {
            PeerMessage::Extended { ext_id: 0, payload } => {
                let hs = ExtendedHandshake::parse(&payload).map_err(|e| js(&format!("bad extended handshake: {e:?}")))?;
                verify_peer_ext(&hs)?;
                let mi = hs.raw.get(b"mi").ok_or_else(|| js("peer extended handshake has no live mi"))?;
                let w = LiveWindow::from_myinfo_payload(&mi.encode()).ok_or_else(|| js("peer live window invalid"))?;
                if w.max_piece > u32::MAX as u64 { return self.fail("live window exceeds wire piece range"); }
                self.window = Some(w);
                if self.phase == Phase::Live { return self.schedule(); }
                let start = w.start_piece(LIVE_BUFFER_PIECES);
                self.picker = Some(LivePicker::starting_at(start));
                self.reasm = Some(PieceReassembler::new(self.piece_length, start)
                    .with_source_pubkey(self.pubkey.clone()).with_max_pieces_ahead(4));
                self.phase = Phase::Live;
                let ext=OutgoingExtendedHandshake { ace_metadata_version:1,ut_metadata_id:2,
                    mi:Some(LivePosition { min_piece:w.min_piece as i64,max_piece:w.max_piece as i64,position:start as i64,distance_from_source:1 }),
                    node:NodeFields::default(),peer_ip:None,metadata_size:None };
                self.push(PeerMessage::Extended { ext_id:0,payload:ext.sign_and_encode(&self.identity) })?;
                self.push(PeerMessage::Interested)?;
                self.schedule()
            }
            PeerMessage::Unchoke => { self.unchoked = true; self.schedule() }
            PeerMessage::Choke => { self.unchoked = false; Ok(()) }
            PeerMessage::Unknown { id:12,payload } => {
                for candidate in ace_wire::peer_exchange::parse_peer_exchange_detailed(&payload).into_iter().take(64) {
                    let host=candidate.addr.ip().to_string();let port=candidate.addr.port();
                    if self.candidates.len()<64 && !self.candidates.iter().any(|(h,p,_)|h==&host&&*p==port){
                        self.candidates.push((host,port,candidate.window.map(|w|w.max).unwrap_or(0)));
                    }
                }
                Ok(())
            }
            PeerMessage::Have(piece) if self.phase == Phase::Live => self.advance_head(piece),
            PeerMessage::Unknown { id:4,payload } if self.phase == Phase::Live && payload.len()==8 => {
                if payload[..4] != [0,0,0,0] {return Ok(());}
                self.advance_head(u32::from_be_bytes(payload[4..8].try_into().expect("length checked")))
            }
            PeerMessage::Extended { payload,.. } if self.phase == Phase::Live => {
                if let Some(w)=LiveWindow::from_myinfo_payload(&payload) {
                    if w.max_piece<=u32::MAX as u64 {self.window=Some(w);return self.schedule();}
                }
                Ok(())
            }
            PeerMessage::Unknown { payload, .. } => {
                if let Some(w) = LiveWindow::from_myinfo_payload(&payload) {
                    if w.max_piece <= u32::MAX as u64 {
                        self.window = Some(w);
                        if self.phase == Phase::Live { self.schedule()?; }
                    }
                }
                Ok(())
            }
            m @ PeerMessage::Piece { index: 0, .. } if self.phase == Phase::Live => self.on_chunk(m),
            _ => Ok(()),
        }
    }

    fn advance_head(&mut self,piece:u32)->Result<(),JsValue>{
        if let Some(mut window)=self.window {
            window.max_piece=window.max_piece.max(piece as u64);
            window.position=window.position.max(piece as u64);
            self.window=Some(window);
        }
        self.schedule()
    }

    fn on_chunk(&mut self, msg: PeerMessage) -> Result<(), JsValue> {
        let Some(lc) = LiveChunk::from_message(&msg) else { return Ok(()); };
        if Some(lc.piece) != self.requested_piece || !self.pending_chunks.contains(&lc.chunk) { return Ok(()); }
        if lc.data.len() as u64 != self.chunk_length { return self.fail("requested live chunk has invalid length"); }
        self.pending_chunks.remove(&lc.chunk);
        let outcome = match self.reasm.as_mut().expect("live reassembler").add_live_chunk(
            lc.piece as u64, lc.chunk, self.chunk_length, lc.piece_header, &lc.data) {
            Ok(outcome) => outcome,
            Err(e) => return self.fail(&format!("piece authentication/reassembly failed: {e:?}")),
        };
        if outcome.completed {
            let timestamp=f64::from_be_bytes(lc.piece_header);if timestamp.is_finite()&&timestamp>0.0{self.source_time=Some(timestamp);}
            if let Some(ready) = self.reasm.as_mut().expect("live reassembler").take_ready_piece() {
                if ready.bytes.len() > MAX_MEDIA.saturating_sub(self.media.len()) { return self.fail("media buffer exceeds 8 MiB; drain take_media"); }
                self.media.extend_from_slice(&ready.bytes);
                self.pieces += 1;
            }
            self.requested_piece = None;
            self.pending_chunks.clear();
            self.schedule()?;
        }
        Ok(())
    }

    fn schedule(&mut self) -> Result<(), JsValue> {
        if !self.unchoked || self.phase != Phase::Live || self.requested_piece.is_some() { return Ok(()); }
        let Some(w) = self.window else { return Ok(()); };
        let Some(piece) = self.picker.as_mut().and_then(|p| p.next_request(&w)) else { return Ok(()); };
        let piece = u32::try_from(piece).map_err(|_| js("piece index exceeds wire range"))?;
        let count = self.piece_length / self.chunk_length;
        self.requested_piece = Some(piece);
        for chunk in 0..count {
            let chunk = u16::try_from(chunk).map_err(|_| js("chunk index exceeds wire range"))?;
            self.pending_chunks.insert(chunk);
            self.push(chunk_request(piece, chunk))?;
        }
        Ok(())
    }

    fn push(&mut self, msg: PeerMessage) -> Result<(), JsValue> {
        let frame = msg.encode();
        if frame.len() > MAX_OUTGOING.saturating_sub(self.outgoing.len()) { return self.fail("outgoing buffer exceeds 1 MiB"); }
        self.outgoing.extend_from_slice(&frame); Ok(())
    }
    fn fail<T>(&mut self, msg: &str) -> Result<T, JsValue> { self.phase = Phase::Failed; self.error = Some(msg.into()); Err(js(msg)) }
}

fn verify_peer_ext(hs: &ExtendedHandshake) -> Result<(), JsValue> {
    match (hs.raw.get(b"node_id"), hs.raw.get(b"signature")) {
        (None, None) => Ok(()),
        (Some(Bencode::Bytes(pk)), Some(Bencode::Bytes(sig))) if pk.len() == 32 && sig.len() == 64 => {
            let pk: [u8; 32] = pk.as_slice().try_into().expect("length checked");
            let sig: [u8; 64] = sig.as_slice().try_into().expect("length checked");
            if verify_handshake(&pk, &sig, match &hs.raw { Bencode::Dict(f) => f, _ => unreachable!() }) { Ok(()) }
            else { Err(js("peer extended handshake signature invalid")) }
        }
        _ => Err(js("malformed peer signature fields")),
    }
}

fn js(s: &str) -> JsValue { JsValue::from_str(s) }
