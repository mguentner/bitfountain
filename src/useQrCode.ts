import React, { useMemo, useEffect, useCallback, useState } from 'react'
import { wrap, transfer, releaseProxy } from 'comlink'
import { parseQrcode } from './workers/qrcode.worker'
import { useUserMedia } from 'use-user-media'
// eslint-disable-next-line import/no-webpack-loader-syntax
import QrCodeWorker from "worker-loader!./workers/qrcode.worker";

const createQrWorker = () => {
  const worker = new QrCodeWorker();
  const proxy = wrap<typeof parseQrcode>(worker);

  const cleanup = () => {
    proxy[releaseProxy]();
    worker.terminate();
  };

  return { proxy, cleanup };
}

type QRWorkerType = ReturnType<typeof createQrWorker>

const useWorkerPool = (size: number) => {
  const [pool, setPool] = useState<{ id: number, worker: QRWorkerType; available: boolean }[]>([]);

  useEffect(() => {
    const l = [];
    for (let i = 0; i < size; i++) {
      const worker = createQrWorker()
      l.push({ id: i, worker: worker, available: true })
    }
    setPool(l)
    return () => {
      for (const e of pool) {
        e.worker.cleanup()
      }
      setPool([])
    }
  }, [size])

  const requestProxy = () => {
    for (const e of pool) {
      if (e.available) {
        e.available = false;
        return { id: e.id, proxy: e.worker.proxy };
      }
    }
    return { id: undefined, proxy: undefined };
  }

  const returnProxy = (id: number) => {
    for (const e of pool) {
      if (e.id === id) {
        e.available = true;
      }
    }
  }

  return {
    requestProxy,
    returnProxy
  }
}

function useQrCode(options: MediaTrackConstraints, videoRef: React.RefObject<HTMLVideoElement>, onResult: (data: string) => void) {
  const constraints = {
    audio: false, video: {
      ...options,
    }
  }
  const [error, stream] = useUserMedia(constraints)

  const dimensions = (() => {
    if (stream) {
      const width = stream.getVideoTracks()[0].getSettings().width;
      const height = stream.getVideoTracks()[0].getSettings().height;
      if (width && height) {
        return { width, height };
      } else {
        return null;
      }
    }
  })();

  const { requestProxy, returnProxy } = useWorkerPool(10)

  const stop = useCallback(() => {
    if (stream) {
      stream.getVideoTracks().forEach((track) => track.stop())
    }
  }, [stream])

  useEffect(() => {
    const captureStream = stream
    const video = videoRef.current
    let objectUrl: string | null = null

    if (video && captureStream) {
      video.playsInline = true
      if ('srcObject' in video) {
        video.srcObject = captureStream
      } else if ('src' in video) {
        objectUrl = URL.createObjectURL(captureStream)
        video!.src = objectUrl
      }
    }

    return () => {
      if (captureStream) {
        captureStream.getVideoTracks().forEach((s) => s.stop())
      }

      if (objectUrl) {
        URL.revokeObjectURL(objectUrl)
      }
    }
  }, [videoRef, stream])

  useEffect(() => {
    const video = videoRef.current
    const height = dimensions?.height || 300
    const width = dimensions?.width || 300
    let assignedCanvas: HTMLCanvasElement | OffscreenCanvas | null = null

    const notify = () => {
      if (assignedCanvas && video) {
        let context = assignedCanvas.getContext('2d', {
          alpha: false // should never have alpha from camera, boosts performance a bit
        })

        if (context) {
          context.drawImage(video, 0, 0)

          let imageData: ImageData | null = context.getImageData(0, 0, width, height)

          if (imageData && imageData.data) {
            const { proxy, id } = requestProxy();
            if (proxy && id) {
              const started = Date.now();
              (proxy(transfer(imageData, [imageData.data.buffer])) as PromiseLike<string | null>).then((res) => {
                imageData = null
                context = null
                returnProxy(id);
                if (res) {
                  const duration = Date.now() - started;
                  if (duration > 200) {
                    console.warn(`Decode took ${duration} ms using worker ${id}`)
                  }
                  onResult(res)
                }
              }, () => {
                returnProxy(id);
              })
            } else {
              console.log("no worker available")
            }
          }
        }
      }
      requestAnimationFrame(notify)
    }

    if (video && width && height) {
      let cv: HTMLCanvasElement | OffscreenCanvas = document.createElement('canvas')

      if ('OffscreenCanvas' in window && 'transferControlToOffscreen' in cv) {
        assignedCanvas = cv.transferControlToOffscreen()
      } else {
        assignedCanvas = cv
      }

      assignedCanvas.height = height
      assignedCanvas.width = width

      //console.log(video, height, width, assignedCanvas)

      //video.addEventListener('timeupdate', notify)
      requestAnimationFrame(notify)
    } else if (Number.isNaN(width) || Number.isNaN(height)) {
      throw new TypeError("height and width must be numbers")
    }

    return () => {
      //if (video) {
      //  video.removeEventListener('timeupdate', notify)
      //}
      assignedCanvas = null
    }
  }, [
    videoRef,
    onResult,
    dimensions?.width,
    dimensions?.height,
    requestProxy,
    returnProxy
  ])

  return useMemo(() => {
    return {
      error,
      stop
    }
  }, [
    error,
    stop
  ])
}

export default useQrCode