/**
 * Reference:
 * https://developer.mozilla.org/en-US/docs/Web/API/Blob
 *
 * Based on:
 * https://github.com/jsdom/jsdom/blob/master/lib/jsdom/living/file-api/Blob-impl.js (MIT licensed)
 */

import { Readable } from "stream";

export default class Blob {
	public readonly _buffer: Buffer = null;
	public readonly type: string = '';

	/**
	 * Constructor.
	 *
	 * @param bits Bits.
	 * @param [options] Options.
	 * @param [options.type] MIME type.
	 */
	constructor(
		bits: (ArrayBuffer | ArrayBufferView | Blob | Buffer | string)[],
		options?: { type?: string }
	) {
		const buffers = [];

		if (bits) {
			for (const bit of bits) {
				let buffer: Buffer;

				if (bit instanceof ArrayBuffer) {
					buffer = Buffer.from(new Uint8Array(bit));
				} else if (bit instanceof Blob) {
					buffer = bit._buffer;
				} else if (bit instanceof Buffer) {
					buffer = bit;
				} else if (ArrayBuffer.isView(bit)) {
					buffer = Buffer.from(new Uint8Array(bit.buffer, bit.byteOffset, bit.byteLength));
				} else {
					buffer = Buffer.from(typeof bit === 'string' ? bit : String(bit));
				}

				buffers.push(buffer);
			}
		}

		this._buffer = Buffer.concat(buffers);

		if (options && options.type && options.type.match(/^[\u0020-\u007E]*$/)) {
			this.type = String(options.type).toLowerCase();
		}
	}

	/**
	 * Returns size.
	 *
	 * @returns Size.
	 */
	public get size(): number {
		return this._buffer.length;
	}

	/**
	 * Slices the blob.
	 *
	 * @param start Start.
	 * @param end End.
	 * @param contentType Content type.
	 * @returns New Blob.
	 */
	public slice(start = 0, end: number = null, contentType = ''): Blob {
		const size = this.size;

		let relativeStart;
		let relativeEnd;
		let relativeContentType;

		if (start === undefined) {
			relativeStart = 0;
		} else if (start < 0) {
			relativeStart = Math.max(size + start, 0);
		} else {
			relativeStart = Math.min(start, size);
		}
		if (end === null) {
			relativeEnd = size;
		} else if (end < 0) {
			relativeEnd = Math.max(size + end, 0);
		} else {
			relativeEnd = Math.min(end, size);
		}

		if (contentType === undefined) {
			relativeContentType = '';
		} else {
			// sanitization (lower case and invalid char check) is done in the
			// constructor
			relativeContentType = contentType;
		}

		const span = Math.max(relativeEnd - relativeStart, 0);

		const buffer = this._buffer;
		const slicedBuffer = buffer.slice(relativeStart, relativeStart + span);

		const blob = new Blob([], { type: relativeContentType });

		(<Buffer>blob._buffer) = slicedBuffer;

		return blob;
	}

	/**
	 * Closes the blob.
	 *
	 * @returns String.
	 */
	public toString(): string {
		return '[object Blob]';
	}

	/**
	 * Returns the textual representation of the blob
	 * 
	 * @returns String
	 */
	public async text(): Promise<string> {
		return Promise.resolve(this._buffer.toString());
	}

	/**
	 * Return an arrayBuffer
	 * @returns 
	 */
	public async arrayBuffer(): Promise<ArrayBuffer> {
		const buf = this._buffer
		const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
		return Promise.resolve(ab)
	}

	/**
	 * Stream the content of Blob
	 * 
	 * @returns ReadableStream
	 */
	public stream(): ReadableStream {
		return new ReadableStream<Uint8Array>({
			start: async (controller) => {
				const chunkSize = 1024;
				for (let pos = 0; pos < this._buffer.length; pos += chunkSize) {
					const end = ( pos + chunkSize < this._buffer.length ) ? pos + chunkSize : this._buffer.length;
					const chunk = this._buffer.slice(pos, end);
					controller.enqueue(chunk);
			  	}
			  	controller.close();
			},
		});
	}
}
