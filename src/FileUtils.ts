import { encode as b64encode, decode as b64decode } from "@borderless/base64";
import jsSHA from "jssha";

export interface Descriptor {
    name: string
    totalSlices: number
    totalByteSize: number
    slizeSize: number
    type: string
    sha256: string
    // random values to get to a certain size
    padding: string
}

export const isEqual = (a: number[], b: number[]): boolean => {
    if (a.length !== b.length) {
        return false;
    }
    return a.every((val, index) => val === b[index]);
}


export type SliceStore = Slice[]

export const printStoreAsMatrix = (store: SliceStore) => {
    const s = store.length
    console.log("---matrix---")
    for (let i = s - 1; i >= 0; i--) {
        let line = [];
        for (let j = 0; j < s; j++) {
            if (store[i].identifiers.indexOf(j) === -1) {
                line.push("0")
            } else {
                line.push("1")
            }
        }
        console.log(line.join("|"))
    }
}

export const newStore = (size: number): SliceStore => {
    return [...Array(size)].map((e) => {
        return { identifiers: [], payload: new Uint8Array(0) }
    })
}

export const isInStore = (store: SliceStore, slice: Slice) => {
    return store.filter((s) => isEqual(s.identifiers, slice.identifiers)).length !== 0;
}

export const individualSlicesInStore = (store: SliceStore) => {
    return store.map((slice) => slice.identifiers).filter((ids) => ids.length === 1).map((ids) => ids[0]);
}

export interface Slice {
    identifiers: number[]
    payload: Uint8Array
}

const seperator = "|"
const solitonDistributionMax = 10
const solitonDistribution = (i: number, K: number): number => {
    if (i === 1) {
        return 1 / K;
    } else {
        return 1 / (i * (i - 1))
    }
}

export const solitonDistributionK = Array.from(Array(solitonDistributionMax).keys()).map((i) => [i + 1, solitonDistribution(i + 1, solitonDistributionMax)]).sort((a, b) => b[1] - a[1])
export const solitonDistributionKAggregated = (() => {
    let sum = 0;
    return solitonDistributionK.map((e) => [e[0], sum += e[1]]).reverse();
})();

export const sampleSolitonDistributionK = (): number => {
    const randValue = Math.random()
    let index = 0
    for (; index < solitonDistributionKAggregated.length && solitonDistributionKAggregated[index][1] >= randValue; index++) { }
    return solitonDistributionKAggregated[index - 1][0];
}

export const hashFileSHA256B64 = async (blob: Blob): Promise<string> => {
    const ab = await blob.arrayBuffer();
    const sha = new jsSHA("SHA-256", "UINT8ARRAY");
    sha.update(new Uint8Array(ab));
    return sha.getHash("B64");
}

export const marshalSliceIdentifiers = (identifiers: number[]): string => {
    return identifiers.sort().map((i) => i.toString(36)).join(seperator)
}

export const unmarshalSliceIdentifiers = (identifiers: string): number[] => {
    return identifiers.split(seperator).map((v) => parseInt(v, 36)).sort()
}

export const getSlice = (file: File, sliceSize: number, slice: number): Blob => {
    if (slice > getMaxSliceCount(file, sliceSize)) {
        throw Error("Too big")
    }
    return file.slice(sliceSize * slice, sliceSize * (slice + 1))
}

export const getMaxSliceCount = (file: File, sliceSize: number): number => {
    return Math.ceil(file.size / sliceSize)
}

export const getNextPermutation = (file: File, sliceSize: number): number[] => {
    const result = []
    const maxSliceCount = getMaxSliceCount(file, sliceSize);
    const allKeys = Array.from(Array(maxSliceCount).keys())
    const randomSorted = allKeys.sort((a, b) => Math.random() - 0.5)
    for (let i = 0; i < Math.min(sampleSolitonDistributionK(), maxSliceCount); i++) {
        result.push(randomSorted[i]);
    }
    return result;
}

export const getDescriptor = (file: File, sha256: string, sliceSize: number): Descriptor => {
    return {
        name: file.name,
        type: file.type,
        slizeSize: sliceSize,
        totalByteSize: file.size,
        totalSlices: getMaxSliceCount(file, sliceSize),
        sha256: sha256,
        padding: "",
    }
}

export const marshaledNominalSlizeSize = (nominalSlizeSize: number) => {
    return Math.ceil("P:".length + nominalSlizeSize * 4 / 3)
}

export const marshalDescriptor = (descriptor: Descriptor, nominalSliceSize: number) => {
    const encoder = new TextEncoder()
    const prePadded = "D:" + b64encode(encoder.encode(JSON.stringify(descriptor)), undefined, undefined)
    if (prePadded.length < marshaledNominalSlizeSize(nominalSliceSize)) {
        const delta = marshaledNominalSlizeSize(nominalSliceSize) - prePadded.length
        const padding = Array(Math.round(3 / 4 * delta)).join("x"); // base64 is 4/3 larger than its input
        return "D:" + b64encode(encoder.encode(JSON.stringify({ ...descriptor, padding: padding })), undefined, undefined)
    } else {
        console.warn("Descriptor longer than slice.")
        return prePadded
    }
}

export const unmarshalDescriptor = (data: string) => {
    if (!data.startsWith("D:")) {
        throw Error("Not a descriptor")
    } else {
        const [, payload] = data.split(":", 2);
        const plainText = b64decode(payload);
        const decoder = new TextDecoder();
        const decoded = decoder.decode(plainText);
        const unmarshaled = JSON.parse(decoded);
        return unmarshaled as Descriptor;
    }
}

export const getNextSliceCount = (file: File, sliceSize: number, currentCount: number): number => {
    if (getMaxSliceCount(file, sliceSize) === currentCount) {
        return 0;
    } else {
        return currentCount + 1;
    }

}

export const marshalSlice = async (file: File, sliceSize: number, sliceIdentifiers: number[]) => {
    const payload = new Uint8Array(sliceSize)
    payload.fill(0);
    for (const v of sliceIdentifiers) {
        const slice = getSlice(file, sliceSize, v);
        const arrayBuffer = await slice.arrayBuffer();
        const asUint8 = new Uint8Array(arrayBuffer);
        for (let i = 0; i < sliceSize; i++) {
            if (i < asUint8.length) {
                payload[i] = payload[i] ^ asUint8[i];
            }
        }
    }
    const sliceAsB64 = b64encode(payload.buffer, undefined, undefined);
    const identifier = marshalSliceIdentifiers(sliceIdentifiers)
    const marshaled = `P:${identifier}:` + sliceAsB64;
    if (marshaled.length < marshaledNominalSlizeSize(sliceSize)) {
        return marshaled + ":" + Array(marshaledNominalSlizeSize(sliceSize) - marshaled.length - 1).join("x")
    } else {
        return marshaled
    }
}

export const unmarshalSlice = (data: string): Slice => {
    if (!data.startsWith("P:")) {
        throw Error("Not a data slice")
    } else {
        const [, sliceIdentifiers, payload, ...rest] = data.split(":")
        return { identifiers: unmarshalSliceIdentifiers(sliceIdentifiers), payload: b64decode(payload) }
    }
}

/*
    The following code is a port of https://github.com/google/gofountain/blob/4928733085e9593b7dcdb0fe268b20e1e1184b6d/block.go
    to TypeScript.
 */
export const xor = (a: Uint8Array, b: Uint8Array): Uint8Array => {
    const decodedPayload = new Uint8Array(Math.max(a.length, b.length))
    decodedPayload.fill(0)
    for (let i = 0; i < decodedPayload.length; i++) {
        if (i < a.length && i < b.length) {
            decodedPayload[i] = a[i] ^ b[i]
        } else if (i < a.length) {
            decodedPayload[i] = a[i]
        } else if (i < b.length) {
            decodedPayload[i] = b[i]
        }
    }
    return decodedPayload
}

export const uniqueIdentifiers = (a: number[], b: number[]): number[] => {
    return [...a, ...b].filter((e) => {
        return (a.indexOf(e) === -1 && b.indexOf(e) !== -1) || (
            a.indexOf(e) !== -1 && b.indexOf(e) === -1
        )
    }).sort()
}

export const xorSlice = (a: Slice, b: Slice): Slice => {
    return {
        identifiers: uniqueIdentifiers(a.identifiers, b.identifiers),
        payload: xor(a.payload, b.payload)
    }
}

export const addEquation = (store: SliceStore, slice: Slice) => {
    let components = slice.identifiers
    let payload = slice.payload
    while (components.length > 0 && store[components[0]].identifiers.length > 0) {
        const s = components[0]
        if (components.length >= store[s].identifiers.length) {
            components = uniqueIdentifiers(store[s].identifiers, components)
            payload = xor(store[s].payload, payload)
        } else {
            const tmpComp = store[s].identifiers
            const tmpPayload = store[s].payload
            store[s] = {
                identifiers: components,
                payload: payload,
            }
            components = tmpComp
            payload = tmpPayload
        }
    }

    if (components.length > 0) {
        store[components[0]] = {
            identifiers: components,
            payload: payload
        }
    }
}

export const isDetermined = (store: SliceStore): boolean => {
    for (const slice of store) {
        if (slice.identifiers.length === 0) {
            return false
        }
    }
    return true
}

export const determinedSliceIndices = (store: SliceStore): number[] => {
    return store.map((slice, index) => { return { s: slice, i: index } as { s: Slice, i: number } }).filter((v) => v.s.identifiers.length !== 0).map((v) => v.i)
}

export const determinedPercentage = (store: SliceStore): number => {
    return store.filter((e) => e.identifiers.length !== 0).length / store.length
}

export const reduce = (store: SliceStore) => {
    for (let i = store.length - 1; i >= 0; i--) {
        for (let j = 0; j < i; j++) {
            const ci = store[i].identifiers
            const cj = store[j].identifiers
            for (let k = 1; k < cj.length; k++) {
                if (cj[k] === ci[0]) {
                    store[j] = xorSlice(store[j], store[i])
                    continue
                }
            }
        }
        while (store[i].identifiers.length > 1) {
            const nextId = store[i].identifiers.filter((e) => e !== i)[0]
            store[i] = xorSlice(store[i], store[nextId])
        }
    }
}

const mergeUint8Array = (a: Uint8Array, b: Uint8Array): Uint8Array => {
    const c = new Uint8Array(a.length + b.length);
    c.set(a);
    c.set(b, a.length);
    return c;
};

export const assemblePayload = (store: SliceStore, descriptor: Descriptor): Blob | null => {
    if (isDetermined(store)) {
        reduce(store);
        let all = new Uint8Array(0);
        store.filter((s) => s.identifiers.length === 1).sort((a, b) => {
            return (a.identifiers[0]) - (b.identifiers[0])
        }).forEach((s) => {
            all = mergeUint8Array(all, s.payload);
        })
        return new Blob([all.slice(0, descriptor.totalByteSize)], { type: descriptor.type })
    }
    return null;
}