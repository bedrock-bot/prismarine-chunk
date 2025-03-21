import { Biome } from "prismarine-biome"
import { Block } from "prismarine-block"
import { Vec3 } from "vec3"
import { NBT } from "prismarine-nbt"
import { Registry } from 'prismarine-registry'
import Section from "./section"

declare class CommonChunk {
  static fromJson(j: any): typeof this
  toJson(): string

  initialize(iniFunc: (x: number, y: number, z: number) => Block): void

  /** @deprecated This function only works on MCPE v0.14 */
  setBiomeColor(pos: Vec3, r: number, g: number, b: number): void
}

declare class PCChunk extends CommonChunk {
  constructor(initData: {
    // Only present on 1.18+
    minY?: number,
    worldHeight?: number
  } | null)

  skyLightSent: boolean
  sections: Section[]
  biome: Buffer

  getBlock(pos: Vec3): Block
  setBlock(pos: Vec3, block: Block): void

  getBlockStateId(pos: Vec3): number
  getBlockType(pos: Vec3): number
  getBlockData(pos: Vec3): number
  getBlockLight(pos: Vec3): number
  getSkyLight(pos: Vec3): number
  getBiome(pos: Vec3): number
  setBlockStateId(pos: Vec3, stateId: number): number
  setBlockType(pos: Vec3, id: number): void
  setBlockData(pos: Vec3, data: Buffer): void
  setBlockLight(pos: Vec3, light: number): void
  setSkyLight(pos: Vec3, light: number): void
  setBiome(pos: Vec3, biome: number): void

  getBiomeColor(pos: Vec3): { r: number; g: number; b: number; }
  dumpBiomes(): Array<number>
  dumpLight(): Buffer
  loadLight(data: Buffer, skyLightMask: number, blockLightMask: number, emptySkyLightMask?: number, emptyBlockLightMask?: number): void
  loadParsedLight?(skyLight: Buffer[], blockLight: Buffer[], skyLightMask: number[][], blockLightMask: number[][], emptySkyLightMask: number[][], emptyBlockLightMask: number[][]): void
  loadBiomes(newBiomesArray: Array<number>): void;
  dump(bitMap?: number, skyLightSent?: boolean): Buffer
  load(data: Buffer, bitMap?: number, skyLightSent?: boolean, fullChunk?: boolean): void
  getMask(): number

  getSection(pos: Vec3): Section
  // Returns chunk at a Y index, adjusted for chunks at negative-Y
  getSectionAtIndex(chunkY: number): SubChunk
}

//// Bedrock ////

interface IVec4 {
  x: number
  y: number
  z: number
  l?: number
}

// This manages the chunk cache
interface IBlobStore {
  get(key: string | number | BigInt): object
  set(key: string | number | BigInt, value: object): void
  has(key: string | number | BigInt): boolean
}

declare const enum StorageType {
  LocalPersistence,
  NetworkPersistence,
  Runtime
}

type CCHash = { type: BlobType, hash: BigInt }
type PaletteEntry = { name, stateId, states }

declare class SubChunk {
  encode(storageType: StorageType): Buffer;
  decode(storageType: StorageType, streamBuffer: Buffer): void

  // Returns an array of currently stored blocks in this section
  getPalette(): PaletteEntry[]

  // Whether this section can be compacted (reduced in size)
  isCompactable(): boolean
  // Reduces the size of this section
  compact(): void
}

type ExtendedBlock = Block & {
  light?: number
  skyLight?: number
}

// A stub
declare class Stream {
}

declare class BedrockChunk extends CommonChunk {
  x: number
  z: number
  // World height information
  minCY: number
  maxCY: number
  // The version of the chunk column (analog to DataVersion on PCChunk)
  chunkVersion: number
  // Holds all the block entities in the chunk, the string keys are
  // the concatenated chunk column-relative position of the block.
  blockEntities: Record<string, NBT>
  // Holds entities in the chunk, the string key is the entity ID
  entities: Record<string, NBT>

  constructor(options: { x: number, z: number, chunkVersion?: number })

  // Block management
  getBlock(pos: IVec4, full?: boolean): ExtendedBlock
  setBlock(pos: IVec4, block: ExtendedBlock): void

  setBlockStateId(pos: IVec4, stateId: number): number
  getBlockStateId(pos: IVec4): number

  // Returns list of unique blocks in this chunk column
  getBlocks(): PaletteEntry[]

  // Biomes
  getBiome(pos: Vec3): Biome
  setBiome(pos: Vec3, biome: Biome): void
  getBiomeId(pos: Vec3): number
  setBiomeId(pos: Vec3, biomeId: number): void
  loadLegacyBiomes(buffer: Buffer): void
  // Only present on >= 1.18
  loadBiomes(buffer: Buffer | Stream, storageType: StorageType): void
  // Write 2D biome data to stream
  writeLegacyBiomes(stream): void
  // Write 3D biome data to stream
  writeBiomes(stream): void

  // Lighting
  getBlockLight(pos: Vec3): number
  setBlockLight(pos: Vec3, light: number): void
  getSkyLight(pos: Vec3): number
  setSkyLight(pos: Vec3, light: number): void

  // On versions <1.18: Encode this full chunk column without computing a checksum at the end
  // On version >=1.18: Encode the biome data for this chunk column and border blocks
  networkEncodeNoCache(): Buffer
  // Compute checksums and put into blob store. Returns blob hashes maped to the blob store.
  networkEncode(blobStore: IBlobStore): { blobs: CCHash[] }

  // On versions <=1.18: Decode this full chunk column without computing a checksum at the end
  // On version >=1.18: Decode the biome data for this chunk column and border blocks
  networkDecodeNoCache(buffer: Buffer, sectionCount: number): void
  /**
   * Decodes cached chunks sent over the network
   * @param blobs The blob hashes sent in the Chunk packet
   * @param blobStore Our blob store for cached data
   * @param {Buffer} payload The rest of the non-cached data
   * @returns {CCHash[]} A list of hashes we don't have and need. If len > 0, decode failed.
   */
  networkDecode(blobs: BigInt[], blobStore: IBlobStore, payload: Buffer): CCHash[]


  // On version >=1.18: Encode/Decode block and entity NBT data for this chunk column
  networkDecodeSubChunkNoCache(y: number, buffer: Buffer): void
  networkEncodeSubChunkNoCache(y: number): Buffer

  /**
   *
   * @param blobs The blob hashes sent in the SubChunk packet
   * @param blobStore The Blob Store holding the chunk data
   * @param payload The remaining data sent in the SubChunk packet, border blocks
   */
  networkDecodeSubChunk(blobs: BigInt[], blobStore: IBlobStore, payload: Buffer): void
  /**
   * Encodes a cached subchunk for the section at y
   * @param y The Y coordinate of the subchunk
   * @param blobStore The cache storage
   * @returns A hash of the encoded data (can be found in BlobStore) and a buffer containing block entities
   */
  networkEncodeSubChunk(y: number, blobStore: IBlobStore): [BigInt, Buffer]

  diskEncodeBlockEntities(): Buffer
  diskDecodeBlockEntities(buffer: Buffer): void

  diskEncodeEntities(): Buffer
  diskDecodeEntities(buffer: Buffer): void

  // Heightmap
  loadHeights(map: Uint16Array): void
  writeHeightMap(stream): void

  //
  // Section management
  getSection(pos): SubChunk
  // Returns chunk at a Y index, adjusted for chunks at negative-Y
  getSectionAtIndex(chunkY: number): SubChunk
  // Creates a new air section
  newSection(y: number): SubChunk
  // Creates a new section with the given blocks
  newSection(y: number, storageFormat: StorageType, buffer: Buffer): SubChunk

  // Block entities
  addBlockEntity(tag: NBT): void

  // Entities
  loadEntities(entities: NBT[]): void
}

export class BlobEntry {
  // The time this blob was added to the blob store
  created: number
  constructor(object: any)
}

export const enum BlobType {
  ChunkSection = 0,
  Biomes = 1,
}

export default function loader(mcVersionOrRegistry: string | Registry): typeof PCChunk | typeof BedrockChunk
