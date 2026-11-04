//! Public content-ID catalog request/authentication ported from Outpace `ace-swarm::resolve`.
//! The embedded protocol keys and observed endpoint addresses are interoperability constants.

use base64ct::{Base64, Encoding};
use sha1::{Digest, Sha1};
use wasm_bindgen::prelude::*;

const MAX_BODY: usize = 1024 * 1024;
const MAX_HEADERS: usize = 16 * 1024;
const CATALOG_HOSTS: &[&str] = &[
    "5.252.161.191",
    "77.120.105.88",
    "64.227.119.64",
    "163.172.187.185",
];
// Exact shared protocol constants in outpace-research/crates/ace-swarm/src/resolve.rs.
const CATALOG_SIGNING_SECRET: &[u8] =
    b"H!+:H1NnvvX\\x0bS'(;0/A\\nR{${\\n/3%1\\x0b*[r0o>QzNGKkXT@v\\x0b3DN;gx_66L2 {`F0,\\tKm>XoG~iY(\\x0bu]6E}\\t~07&H;9qE1d?d-A7S(";
const CATALOG_RESPONSE_KEY: &[u8] =
    b"CNVU\\\\w5S/HGg\"pSzY&O\"`uGCD18\\x0cfS|h2H4eJBihWumSD7zSv;8,=z2?<\\tl6ka\\n\\x0c*O<3dzOZ|MT11]f0 Xuc| R\"$D;SsYm\\rw*..8h7d4k";

fn err(message: &str) -> JsValue { JsValue::from_str(message) }

fn valid_cid(cid: &str) -> bool {
    cid.len() == 40 && cid.is_ascii() && cid.bytes().all(|b| b.is_ascii_hexdigit())
}

fn parse_nonce(nonce: &str) -> Result<u64, JsValue> {
    if nonce.is_empty() || !nonce.bytes().all(|b| b.is_ascii_digit()) {
        return Err(err("nonce must be a positive decimal integer"));
    }
    let value = nonce.parse::<u64>().map_err(|_| err("invalid nonce"))?;
    if value == 0 || value > i64::MAX as u64 { return Err(err("nonce out of range")); }
    Ok(value)
}

fn query_signature(parameter: &str,value: &str, nonce: u64) -> String {
    let signed = format!("_n=3.2.11#_p=linux#_r={nonce}#_v=3021100#{parameter}={value}");
    let mut h = Sha1::new();
    h.update(signed.as_bytes());
    h.update(CATALOG_SIGNING_SECRET);
    hex(&h.finalize())
}

fn hex(bytes: &[u8]) -> String {
    const DIGITS: &[u8; 16] = b"0123456789abcdef";
    let mut out = String::with_capacity(bytes.len() * 2);
    for &b in bytes { out.push(DIGITS[(b >> 4) as usize] as char); out.push(DIGITS[(b & 15) as usize] as char); }
    out
}

/// Build a raw HTTP/1.1 GET request. Caller performs TCP I/O; host must be a known catalog IP.
#[wasm_bindgen]
pub fn catalog_request(cid_hex40: &str, nonce_decimal_string: &str, host: &str) -> Result<Vec<u8>, JsValue> {
    if !valid_cid(cid_hex40) { return Err(err("content ID must be 40 hex characters")); }
    let nonce = parse_nonce(nonce_decimal_string)?;
    if !CATALOG_HOSTS.contains(&host) { return Err(err("catalog host is not allowlisted")); }
    let sig = query_signature("pid",cid_hex40, nonce);
    let path = format!("/gettorrent?_n=3.2.11&_p=linux&_r={nonce}&_v=3021100&pid={cid_hex40}&_s={sig}");
    Ok(format!("GET {path} HTTP/1.1\r\nHost: {host}:8081\r\nUser-Agent: outpace/0.1\r\nAccept: */*\r\nConnection: close\r\n\r\n").into_bytes())
}

fn hash20(value:&str)->Result<[u8;20],JsValue>{
    if !valid_cid(value){return Err(err("infohash must be 40 hex characters"));}
    let mut out=[0u8;20];for i in 0..20{out[i]=u8::from_str_radix(&value[i*2..i*2+2],16).map_err(|_|err("invalid infohash"))?;}Ok(out)
}

/// The swarm-infohash namespace uses padded Base64, signed before URL encoding.
#[wasm_bindgen]
pub fn catalog_request_infohash(infohash_hex:&str,nonce_decimal:&str,host:&str)->Result<Vec<u8>,JsValue>{
    let hash=hash20(infohash_hex)?;let nonce=parse_nonce(nonce_decimal)?;
    if !CATALOG_HOSTS.contains(&host){return Err(err("catalog host is not allowlisted"));}
    let value=Base64::encode_string(&hash);let sig=query_signature("infohash",&value,nonce);
    let encoded=value.replace('+',"%2B").replace('/',"%2F").replace('=',"%3D");
    Ok(format!("GET /gettorrent?_n=3.2.11&_p=linux&_r={nonce}&_v=3021100&infohash={encoded}&_s={sig} HTTP/1.1\r\nHost: {host}:8081\r\nUser-Agent: outpace/0.1\r\nAccept: */*\r\nConnection: close\r\n\r\n").into_bytes())
}

#[wasm_bindgen]
pub fn catalog_response_infohash(response:&[u8],nonce:&str,infohash_hex:&str)->Result<Vec<u8>,JsValue>{
    let expected=hash20(infohash_hex)?;let transport=catalog_response(response,nonce)?;
    let decoded=ace_wire::transport::decode_transport(&transport).map_err(|_|err("invalid transport"))?;
    let actual=ace_wire::infohash::infohash_of_decoded_transport(&decoded).map_err(|_|err("transport infohash unavailable"))?;
    if actual!=expected{return Err(err("catalog descriptor does not match requested swarm"));}Ok(transport)
}

/// Parse an HTTP response, authenticate the catalog XML and return the checksummed transport.
#[wasm_bindgen]
pub fn catalog_response(raw_http_bytes: &[u8], nonce_decimal: &str) -> Result<Vec<u8>, JsValue> {
    let nonce = parse_nonce(nonce_decimal)?;
    let body = http_body(raw_http_bytes)?;
    authenticated_transport(&body, nonce)
}

fn http_body(response: &[u8]) -> Result<Vec<u8>, JsValue> {
    if response.len() > MAX_BODY + MAX_HEADERS { return Err(err("HTTP response too large")); }
    let end = response.windows(4).position(|w| w == b"\r\n\r\n").ok_or_else(|| err("malformed HTTP response"))?;
    if end > MAX_HEADERS { return Err(err("HTTP headers too large")); }
    let text = std::str::from_utf8(&response[..end]).map_err(|_| err("invalid HTTP headers"))?;
    let mut lines = text.split("\r\n");
    let status = lines.next().ok_or_else(|| err("missing HTTP status"))?;
    let mut status_parts = status.split_ascii_whitespace();
    if !status_parts.next().unwrap_or("").starts_with("HTTP/") || status_parts.next() != Some("200") { return Err(err("catalog HTTP status is not 200")); }
    let mut content_length = None;
    let mut chunked = false;
    for line in lines {
        let (name, value) = line.split_once(':').ok_or_else(|| err("malformed HTTP header"))?;
        if name.eq_ignore_ascii_case("content-length") {
            if content_length.is_some() { return Err(err("duplicate Content-Length")); }
            content_length = Some(value.trim().parse::<usize>().map_err(|_| err("invalid Content-Length"))?);
        } else if name.eq_ignore_ascii_case("transfer-encoding") {
            if chunked || !value.trim().eq_ignore_ascii_case("chunked") { return Err(err("unsupported Transfer-Encoding")); }
            chunked = true;
        }
    }
    if chunked && content_length.is_some() { return Err(err("ambiguous HTTP framing")); }
    let body = &response[end + 4..];
    if chunked { return decode_chunked(body); }
    if let Some(n) = content_length {
        if n > MAX_BODY || body.len() != n { return Err(err("invalid or oversized HTTP body")); }
        return Ok(body.to_vec());
    }
    if body.len() > MAX_BODY { return Err(err("HTTP body too large")); }
    Ok(body.to_vec())
}

fn decode_chunked(mut input: &[u8]) -> Result<Vec<u8>, JsValue> {
    let mut out = Vec::new();
    loop {
        let line_end = crlf(input).ok_or_else(|| err("malformed chunk size"))?;
        let line = std::str::from_utf8(&input[..line_end]).map_err(|_| err("invalid chunk size"))?;
        let size = usize::from_str_radix(line.split(';').next().unwrap_or("").trim(), 16).map_err(|_| err("invalid chunk size"))?;
        input = &input[line_end + 2..];
        if size == 0 {
            // Consume optional trailers, bounded by the overall header ceiling.
            if input.starts_with(b"\r\n") { return Ok(out); }
            let trailer_end = input.windows(4).position(|w| w == b"\r\n\r\n").ok_or_else(|| err("malformed chunk trailer"))?;
            if trailer_end > MAX_HEADERS { return Err(err("chunk trailers too large")); }
            return Ok(out);
        }
        if size > MAX_BODY - out.len() || input.len() < size + 2 { return Err(err("chunked body too large or truncated")); }
        out.extend_from_slice(&input[..size]);
        if &input[size..size + 2] != b"\r\n" { return Err(err("invalid chunk terminator")); }
        input = &input[size + 2..];
    }
}

fn crlf(bytes: &[u8]) -> Option<usize> { bytes.windows(2).position(|w| w == b"\r\n") }

fn authenticated_transport(body: &[u8], nonce: u64) -> Result<Vec<u8>, JsValue> {
    if body.len() > MAX_BODY { return Err(err("catalog body too large")); }
    let xml = std::str::from_utf8(body).map_err(|_| err("invalid catalog UTF-8"))?;
    let doc = roxmltree::Document::parse_with_options(xml, roxmltree::ParsingOptions { allow_dtd: false, nodes_limit: 4096, ..Default::default() }).map_err(|_| err("invalid catalog XML"))?;
    let root = doc.root_element();
    if !root.has_tag_name("response") { return Err(err("invalid catalog response root")); }
    let sig_node = root.attribute_node("sig").ok_or_else(|| err("missing catalog signature"))?;
    let sig = sig_node.value();
    if sig.len() != 40 || !sig.bytes().all(|b| b.is_ascii_hexdigit() && !b.is_ascii_uppercase()) { return Err(err("invalid catalog signature")); }
    let attr = format!(" sig=\"{sig}\"");
    let range = sig_node.range();
    if range.start == 0 || xml.get(range.start - 1..range.end) != Some(attr.as_str()) { return Err(err("invalid signature attribute framing")); }
    let unsigned = xml.replace(&attr, "");
    let mut h = Sha1::new(); h.update(unsigned.as_bytes()); h.update(CATALOG_RESPONSE_KEY);
    if hex(&h.finalize()) != sig { return Err(err("catalog signature mismatch")); }
    let response_nonce = root.attribute("r").and_then(|v| v.parse::<u64>().ok()).ok_or_else(|| err("invalid catalog response nonce"))?;
    if response_nonce != nonce { return Err(err("catalog nonce mismatch")); }
    let field = |name: &str| -> Result<&str, JsValue> {
        let mut nodes = root.children().filter(|n| n.has_tag_name(name));
        let node = nodes.next().ok_or_else(|| err("missing catalog field"))?;
        if nodes.next().is_some() || node.children().any(|n| n.is_element()) { return Err(err("ambiguous catalog field")); }
        node.text().ok_or_else(|| err("empty catalog field"))
    };
    let torrent = Base64::decode_vec(field("torrent")?.trim()).map_err(|_| err("invalid catalog base64"))?;
    let checksum = field("checksum")?.trim();
    if checksum.len() != 40 || !checksum.bytes().all(|b| b.is_ascii_hexdigit() && !b.is_ascii_uppercase()) { return Err(err("invalid catalog checksum")); }
    let mut hash = Sha1::new(); hash.update(&torrent);
    if hex(&hash.finalize()) != checksum { return Err(err("catalog checksum mismatch")); }
    Ok(torrent)
}
