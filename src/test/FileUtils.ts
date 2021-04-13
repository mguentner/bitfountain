import * as FileUtils from "../FileUtils";
import { expect } from "chai";
import File from "./file/File";
import Blob from "./file/Blob";
import { writeFile, writeFileSync } from "node:fs";

globalThis.Blob = Blob;

const generateRandomData = (size: number): string => {
    let res = [];
    let charSet       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for ( let i = 0; i < size; i++ ) {
        res.push(charSet.charAt(Math.floor(Math.random() * charSet.length)))
    }
   return res.join('');
}

export const MockFile = ({ name = 'mock.blob', size = 1024, type = 'plain/txt', lastModified = new Date() }) => {
    const blob = new Blob([generateRandomData(size)], { type });
    return new File([blob], name);
}

describe("MockFile", () => {
    it("mocks correctly", () => {
        const mocked = MockFile({ size: 1337 })
        expect(mocked.size).to.eql(1337)
    })
})

describe("marshalIdentifiers", () => {
    it("should return properly formatted identifiers", () => {
        const input = [10, 30, 1];
        const marshaled = FileUtils.marshalSliceIdentifiers(input);
        expect(marshaled).to.eql("1|a|u")
    })
})

describe("getMaxSliceCount", () => {
    it("should return the correct count (full)", () => {
        const mocked = MockFile({ size: 40000 })
        expect(mocked.size).to.eql(40000)
        expect(FileUtils.getMaxSliceCount(mocked, 100)).to.eql(400) ;
    })

    it("should return the correct count (not full)", () => {
        const mocked = MockFile({ size: 39999 })
        expect(mocked.size).to.eql(39999)
        expect(FileUtils.getMaxSliceCount(mocked, 100)).to.eql(400) ;
    })

    it("should return the correct count (single byte more)", () => {
        const mocked = MockFile({ size: 40001 })
        expect(mocked.size).to.eql(40001)
        expect(FileUtils.getMaxSliceCount(mocked, 100)).to.eql(401) ;
    })
})

describe("getNextPermuation", ()  => {
    it("should generate", () => {
        const mocked = MockFile({ size: 40001 })
        const permutation = FileUtils.getNextPermutation(mocked, 100);
        expect(permutation.length).greaterThan(0)
    })
})

describe("decodeSlices", () => {
    it("should successfully decode", async () => {
        const mocked = MockFile({ size: 1007 })
        const store: FileUtils.SliceStore = []
        const hash = await FileUtils.hashFileSHA256B64(mocked);
        const descriptor = FileUtils.getDescriptor(mocked, hash, 10);
        let run = 0;
        for (;;) {
            console.log(`start run ${run}`)
            const permutation = FileUtils.getNextPermutation(mocked, 10);
            console.log(`permutation: ${permutation}`)
            const marshaled = await FileUtils.marshalSlice(mocked, 10, permutation);
            const unmarshaled = FileUtils.unmarshalSlice(marshaled);
            const result = FileUtils.decodeSlices(store, 10, unmarshaled);
            console.log(`retrieved: ${result.map((s) => FileUtils.unmarshalSliceIdentifiers(s.identifiers) )}`)
            for (const resSlice of result) {
                FileUtils.insertToStore(store, resSlice);
            }
            FileUtils.insertToStore(store, unmarshaled);
            const individualSlices = FileUtils.individualSlicesInStore(store);
            console.log(`individual slices: ${individualSlices}`)
            if (individualSlices.length === FileUtils.getMaxSliceCount(mocked, 10)) {
                break
            }
            run++;
        }
        const payload = FileUtils.assemblePayload(store, descriptor)
        if (payload === null) {
            expect.fail("Expected a blob")
            return
        }
        expect(payload.size).eql(mocked.size).eql(1007)
        const receivedHash = await FileUtils.hashFileSHA256B64(payload);
        //const mockedData = await mocked.arrayBuffer();
        //writeFileSync("./input.blob", new Uint8Array(mockedData));
        //const payloadData = await payload.arrayBuffer();
        //writeFileSync("./received.blob", new Uint8Array(payloadData));
        expect(hash).eq(receivedHash)
    })
})