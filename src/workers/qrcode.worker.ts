import * as Comlink from 'comlink'
import QRCodeReader from '@zxing/library/esm/core/qrcode/QRCodeReader'
import BinaryBitmap from '@zxing/library/esm/core/BinaryBitmap'
import HybridBinarizer from '@zxing/library/esm/core/common/HybridBinarizer'
import { ImageDataLuminanceSource } from './ImageDataLuminanceSource'

const reader = new QRCodeReader()

export const parseQrcode = (data: ImageData) => {
  try {
    return reader.decode(
        new BinaryBitmap(
          new HybridBinarizer(
            new ImageDataLuminanceSource(data)
          )
        )
      )
      .getText()
  } catch (e) {
  }

  return null
}

Comlink.expose(parseQrcode)