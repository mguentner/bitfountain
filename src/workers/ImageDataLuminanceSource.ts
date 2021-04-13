import InvertedLuminanceSource from '@zxing/library/esm/core/InvertedLuminanceSource';
import LuminanceSource from '@zxing/library/esm/core/LuminanceSource';
import IllegalArgumentException from '@zxing/library/esm/core/IllegalArgumentException';

/**
 * adapted from @zxing/library/library/esm/browser/HTMLCanvasElementLuminanceSource.ts
 */
export class ImageDataLuminanceSource extends LuminanceSource {

    private buffer: Uint8ClampedArray;

    public constructor(data: ImageData) {
        super(data.width, data.height);
        this.buffer = ImageDataLuminanceSource.toGrayscaleBuffer(data.data, data.width, data.height)
    }

    private static toGrayscaleBuffer(imageBuffer: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray {
        const grayscaleBuffer = new Uint8ClampedArray(width * height);
        for (let i = 0, j = 0, length = imageBuffer.length; i < length; i += 4, j++) {
            let gray;
            const alpha = imageBuffer[i + 3];
            // The color of fully-transparent pixels is irrelevant. They are often, technically, fully-transparent
            // black (0 alpha, and then 0 RGB). They are often used, of course as the "white" area in a
            // barcode image. Force any such pixel to be white:
            if (alpha === 0) {
                gray = 0xFF;
            } else {
                const pixelR = imageBuffer[i];
                const pixelG = imageBuffer[i + 1];
                const pixelB = imageBuffer[i + 2];
                // .299R + 0.587G + 0.114B (YUV/YIQ for PAL and NTSC),
                // (306*R) >> 10 is approximately equal to R*0.299, and so on.
                // 0x200 >> 10 is 0.5, it implements rounding.
                gray = (306 * pixelR +
                    601 * pixelG +
                    117 * pixelB +
                    0x200) >> 10;
            }
            grayscaleBuffer[j] = gray;
        }
        return grayscaleBuffer;
    }

    public getRow(y: number /*int*/, row: Uint8ClampedArray): Uint8ClampedArray {
        if (y < 0 || y >= this.getHeight()) {
            throw new IllegalArgumentException('Requested row is outside the image: ' + y);
        }
        const width: number /*int*/ = this.getWidth();
        const start = y * width;
        if (row === null) {
            row = this.buffer.slice(start, start + width);
        } else {
            if (row.length < width) {
                row = new Uint8ClampedArray(width);
            }
            // The underlying raster of image consists of bytes with the luminance values
            // TODO: can avoid set/slice?
            row.set(this.buffer.slice(start, start + width));
        }

        return row;
    }

    public getMatrix(): Uint8ClampedArray {
        return this.buffer;
    }

    public isCropSupported(): boolean {
        return false;
    }

    public crop(): LuminanceSource {
        return this;
    }

    /**
     * This is always true, since the image is a gray-scale image.
     *
     * @return true
     */
    public isRotateSupported(): boolean {
        return false;
    }

    public rotateCounterClockwise(): LuminanceSource {
        return this;
    }

    public rotateCounterClockwise45(): LuminanceSource {
        return this;
    }

    public invert(): LuminanceSource {
        return new InvertedLuminanceSource(this);
    }
}
