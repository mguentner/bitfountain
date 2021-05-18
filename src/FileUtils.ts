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

export type SliceStore = Slice[]

export const insertToStore = (store:SliceStore, slice: Slice) => {
    if (store.filter((s) => s.identifiers === slice.identifiers).length === 0) {
        store.push(slice)
    }
}

export const individualSlicesInStore = (store: SliceStore) => {
    return store.map((slice) => unmarshalSliceIdentifiers(slice.identifiers)).filter((ids) => ids.length === 1).map((ids) => ids[0]);
}

export interface Slice {
    identifiers: string
    payload: Uint8Array
}

const seperator = "|"
const probabilityOfPermutation = [1, 0.6, 0.2, 0.4, 0.4];

const solitonDistributionMax = 10
const solitonDistribution = (i: number, K: number): number => {
    if (i === 1) {
        return 1/K;
    } else {
        return 1/(i*(i-1))
    }
}

export const solitonDistributionK = Array.from(Array(solitonDistributionMax).keys()).map((i) => [i+1, solitonDistribution(i+1, solitonDistributionMax)]).sort((a,b) => b[1] - a[1])
export const solitonDistributionKAggregated = (() => {
    let sum = 0;
    return solitonDistributionK.map((e) => [e[0], sum += e[1]]).reverse();
})();

export const sampleSolitonDistributionK = (): number => {
    const randValue = Math.random()
    let index = 0
    for (; index < solitonDistributionKAggregated.length && solitonDistributionKAggregated[index][1] >= randValue; index++) {}
    return solitonDistributionKAggregated[index-1][0];
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
    return identifiers.split(seperator).map((v) => parseInt(v, 36))
}

export const getSlice = (file: File, sliceSize: number, slice: number): Blob => {
    if (slice > getMaxSliceCount(file, sliceSize)) {
        throw Error("Too big")
    }
    return file.slice(sliceSize*slice, sliceSize*(slice+1))
}

export const getMaxSliceCount = (file: File, sliceSize: number): number => {
    return Math.ceil(file.size / sliceSize)
}

export const getNextPermutation = (file: File, sliceSize: number): number[] => {
    const result = []
    const maxSliceCount = getMaxSliceCount(file, sliceSize);
    const allKeys = Array.from(Array(maxSliceCount).keys())
    const randomSorted = allKeys.sort((a,b) => Math.random() - 0.5)
    for (let i = 0; i < sampleSolitonDistributionK() ; i++) {
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
    return Math.ceil("DATA:".length + nominalSlizeSize*4/3)
}

export const marshalDescriptor = (descriptor: Descriptor, nominalSliceSize: number) => {
    const encoder = new TextEncoder()
    const prePadded =  "DESC:" + b64encode(encoder.encode(JSON.stringify(descriptor)), undefined, undefined)
    if (prePadded.length < marshaledNominalSlizeSize(nominalSliceSize)) {
       const delta = marshaledNominalSlizeSize(nominalSliceSize) - prePadded.length
       const padding = Array(Math.round(3/4*delta)).join("x"); // base64 is 4/3 larger than its input
       return "DESC:" + b64encode(encoder.encode(JSON.stringify({...descriptor, padding: padding})), undefined, undefined)
    } else {
        console.warn("Descriptor longer than slice.")
        return prePadded
    }
}

export const unmarshalDescriptor = (data: string) => {
    if (! data.startsWith("DESC:")) {
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
        for (let i=0; i<sliceSize; i++) {
            if (i < asUint8.length) {
                payload[i] = payload[i] ^ asUint8[i];
            }
        }
    }
    const sliceAsB64 = b64encode(payload.buffer, undefined, undefined);
    const identifier = marshalSliceIdentifiers(sliceIdentifiers)
    const marshaled = `DATA:${identifier}:` + sliceAsB64;
    if (marshaled.length < marshaledNominalSlizeSize(sliceSize)) {
        return marshaled + ":" + Array(marshaledNominalSlizeSize(sliceSize) - marshaled.length - 1).join("x")
    } else {
        return marshaled
    }
}

export const unmarshalSlice = (data: string): Slice => {
    if (! data.startsWith("DATA:")) {
        throw Error("Not a data slice")
    } else {
        const [, sliceIdentifiers, payload, ...rest] = data.split(":")
        return { identifiers: sliceIdentifiers, payload: b64decode(payload) }
    }
}

export const decodeSlices = (store: SliceStore, sliceSize: number, sliceToBeDecoded: Slice): Slice[] => {
    const result: SliceStore = [];
    store.forEach((sliceInStore) => {
        const storeIdentifiers = unmarshalSliceIdentifiers(sliceInStore.identifiers);
        const toBeDecodedIdentifiers = unmarshalSliceIdentifiers(sliceToBeDecoded.identifiers);
        const uniqueIdentifiers = [...storeIdentifiers, ...toBeDecodedIdentifiers].filter((e) => {
            return (storeIdentifiers.indexOf(e) === -1 && toBeDecodedIdentifiers.indexOf(e) !== -1) || (
                storeIdentifiers.indexOf(e) !== -1 && toBeDecodedIdentifiers.indexOf(e) === -1
            )
        })
        const marshaledUniqueIdentifiers = marshalSliceIdentifiers(uniqueIdentifiers);
        if (uniqueIdentifiers.length === 1 && store.filter((s) => s.identifiers === marshaledUniqueIdentifiers).length === 0) {
            // e.g. [2,3] and [2] => unique is 3
            // e.g. [2,3,4] and [2,3] => unique is 4 
            const decodedPayload =  new Uint8Array(sliceSize)
            decodedPayload.fill(0)
            const toBeDecodedPayload = sliceToBeDecoded.payload;
            const inStorePayload = sliceInStore.payload;
            for (let i=0; i < sliceSize; i++) {
                if (i < toBeDecodedPayload.length && i < inStorePayload.length) {
                    decodedPayload[i] = toBeDecodedPayload[i] ^ inStorePayload[i]
                } else if (i < toBeDecodedPayload.length) {
                    decodedPayload[i] = toBeDecodedPayload[i]
                } else if (i < inStorePayload.length) {
                    decodedPayload[i] = inStorePayload[i]
                }
            }
            const newSlice: Slice = {
                identifiers: marshaledUniqueIdentifiers,
                payload: decodedPayload
            }
            result.push(newSlice);
        }
    })
    return result;
}

export const payloadIsReady = (store: SliceStore, descriptor: Descriptor): boolean => {
    const individualSlices = individualSlicesInStore(store)
    return individualSlices.length === descriptor.totalSlices;
}

const mergeUint8Array = (a: Uint8Array, b: Uint8Array): Uint8Array => {
  const c = new Uint8Array(a.length + b.length);
  c.set(a);
  c.set(b, a.length);
  return c;
};

export const assemblePayload = (store: SliceStore, descriptor: Descriptor): Blob | null => {
    if (payloadIsReady(store, descriptor)) {
        let all = new Uint8Array(0);
        store.filter((s) => unmarshalSliceIdentifiers(s.identifiers).length === 1).sort((a,b) => {
            return (unmarshalSliceIdentifiers(a.identifiers)[0]) - (unmarshalSliceIdentifiers(b.identifiers)[0])
        }).forEach((s) => {
            all = mergeUint8Array(all, s.payload);
        })
        return new Blob([all.slice(0, descriptor.totalByteSize)], { type: descriptor.type })
    }
    return null;
}