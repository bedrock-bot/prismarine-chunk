const { xxh64 } = require('@node-rs/xxhash')
module.exports = {
  getChecksum (buffer) {
    // with node 16, below would work
    // return hasher.h64Raw(buffer)
    // with node 14, no i64 wasm interface, need to read two u32s from Uint8Array
    const hash = xxh64(buffer)
    return hash
  }
}
