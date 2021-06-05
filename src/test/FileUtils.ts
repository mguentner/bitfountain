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

describe("getSlice", () => {
    it("should return the correct size", () => {
        const mocked = MockFile({ size: 12 })
        const slice1 = FileUtils.getSlice(mocked, 5, 0)
        const slice2 = FileUtils.getSlice(mocked, 5, 1)
        const slice3 = FileUtils.getSlice(mocked, 5, 2)
        expect(slice1.size).to.eql(5)
        expect(slice2.size).to.eql(5)
        expect(slice3.size).to.eql(2)
    })
})

describe("gaussian", () => {
    it("should successfully decode", async () => {
        const size = 2003
        const mocked = MockFile({ size: size })
        const hash = await FileUtils.hashFileSHA256B64(mocked);
        const descriptor = FileUtils.getDescriptor(mocked, hash, 10);
        const store: FileUtils.SliceStore = FileUtils.newStore(descriptor.totalSlices)
        let run = 0;
        for (;;) {
            console.log(`start run ${run}`)
            const permutation = FileUtils.getNextPermutation(mocked, 10);
            console.log(`permutation: ${permutation}`)
            const marshaled = await FileUtils.marshalSlice(mocked, 10, permutation);
            const unmarshaled = FileUtils.unmarshalSlice(marshaled);
            FileUtils.addEquation(store, unmarshaled)
            if (FileUtils.isDetermined(store)) {
                break
            }
            run++;
        }
        FileUtils.reduce(store)
        const payload = FileUtils.assemblePayload(store, descriptor)
        if (payload === null) {
            expect.fail("Expected a blob")
            return
        }
        expect(payload.size).eql(mocked.size).eql(size)
        const receivedHash = await FileUtils.hashFileSHA256B64(payload);
        //const mockedData = await mocked.arrayBuffer();
        //writeFileSync("./input.blob", new Uint8Array(mockedData));
        //const payloadData = await payload.arrayBuffer();
        //writeFileSync("./received.blob", new Uint8Array(payloadData));
        expect(hash).eq(receivedHash)

    })
})

describe("solitonDistribution", () => {
    it("sums up to 1", () => {
        const sum = FileUtils.solitonDistributionK.map((e) => e[1]).reduce((p, current) => p+current)
        expect(sum).lessThanOrEqual(1.01)
        expect(sum).greaterThanOrEqual(0.99)
    })
    it("aggregates correctly", () => {
        const lastElement = FileUtils.solitonDistributionKAggregated.sort((a,b) => b[1] - a[1])[0]
        expect(lastElement[1]).lessThanOrEqual(1.01)
        expect(lastElement[1]).greaterThanOrEqual(0.99)
    })
    it("samples correctly", () => {
        const res = {}
        const count = 10000;
        for (let i=0; i<count; i++) {
            const sample = FileUtils.sampleSolitonDistributionK();
            if (res[sample] !== undefined) {
                res[sample] += 1
            } else {
                res[sample] = 1
            }
        }
        const percentage = Object.fromEntries(Object.entries(res).map(([key, value]) => [key, value as number/count] ))
        console.log(percentage)
        // check manually
    })

})