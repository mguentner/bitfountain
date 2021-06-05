import React, {
  FunctionComponent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useVideoMediaDevices } from "./devices";
import "./App.css";
import "./Receiver.css";
import { useDecoder } from "./useDecoder";
import useQrCode from "./useQrCode";
import { Descriptor } from "./FileUtils";

type FacingMode = "user" | "environment" | "left" | "right";

const ReceiverIndication = ({
  rawDataRateInBitsPerSeconds,
  netDataRateInBitsPerSeconds,
  totalSlice,
  lastSliceReceivedOn,
  availableSlicesCount,
  totalSlices,
  descriptor,
}: {
  rawDataRateInBitsPerSeconds: number;
  netDataRateInBitsPerSeconds: number;
  totalSlice: number;
  lastSliceReceivedOn?: number;
  availableSlicesCount: number;
  totalSlices: number;
  descriptor?: Descriptor;
}) => {
  const receivedAgo = lastSliceReceivedOn
    ? (Date.now() - lastSliceReceivedOn) / 1000
    : undefined;
  return (
    <div className="receiver-indication">
      <span>
        {rawDataRateInBitsPerSeconds / 8} B/s (raw){" "}
        {netDataRateInBitsPerSeconds / 8} B/s (net)
      </span>
      {descriptor && (
        <React.Fragment>
          <span>Name: {descriptor.name}</span>
          <span>Size: {descriptor.totalByteSize} Bytes</span>
          <span>
            Slices: {availableSlicesCount}/{descriptor.totalSlices}{" "}
            {totalSlices}
          </span>
          <span>Hash: {descriptor.sha256.slice(0, 10)}...</span>
        </React.Fragment>
      )}
      <span>
        {receivedAgo && receivedAgo < 600
          ? `last frame received ${receivedAgo}s ago`
          : null}
      </span>
    </div>
  );
};

export const Receiver: FunctionComponent = () => {
  const [facingMode, setFacingMode] = useState<FacingMode>("environment");
  const [selectedMediaDeviceId, setSelectedMediaDeviceId] =
    useState<undefined | string>(undefined);
  const videoMediaDevices = useVideoMediaDevices();
  const [downloadDone, setDownloadDone] = useState(false);

  useEffect(() => {
    if (videoMediaDevices.length > 0 && selectedMediaDeviceId === undefined) {
      setSelectedMediaDeviceId(videoMediaDevices[0].deviceId);
    }
  }, [videoMediaDevices, selectedMediaDeviceId]);

  const constraints = {
    facingMode: facingMode,
    deviceId: selectedMediaDeviceId,
  };

  const {
    ready,
    descriptor,
    availableSlices,
    callbackFunction,
    getPayload,
    netDataRateInBitsPerSeconds,
    rawDataRateInBitsPerSeconds,
    totalSlices,
    lastSliceReceivedOn,
  } = useDecoder();

  const progressBar = (() => {
    if (descriptor === undefined) {
      return null;
    }
    const totalSlicesArray = Array.from(Array(descriptor.totalSlices).keys());

    return (
      <div className="progressbar">
        {totalSlicesArray.map((slice) => {
          if (availableSlices.includes(slice)) {
            return <div key={slice} className="slice available"></div>;
          } else {
            return <div key={slice} className="slice missing"></div>;
          }
        })}
      </div>
    );
  })();

  const downloadPayload = useCallback(() => {
    const blob = getPayload();
    if (blob === null) {
      console.error("Blob is null");
      return;
    }
    if (!descriptor) {
      console.error("Descriptor is null");
      return;
    }

    const a = window.document.createElement("a");

    a.href = window.URL.createObjectURL(blob);
    a.download = descriptor.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [getPayload, descriptor]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const { stop } = useQrCode(constraints, videoRef, (data: string) => {
    if (data) {
      callbackFunction(data);
    }
  });

  useEffect(() => {
    if (ready && !downloadDone) {
      stop();
      downloadPayload();
      setDownloadDone(true);
    }
  }, [ready, downloadDone, setDownloadDone, stop, downloadPayload]);

  return (
    <div className="app">
      {ready ? (
        <div>
          <h1>Transmission Done</h1>
          <button onClick={() => downloadPayload()}>Save again.</button>
        </div>
      ) : (
        <div>
          {selectedMediaDeviceId && (
            <div className="qr-reader">
              <div className="qr-box">
                <ReceiverIndication
                  descriptor={descriptor}
                  rawDataRateInBitsPerSeconds={rawDataRateInBitsPerSeconds}
                  netDataRateInBitsPerSeconds={netDataRateInBitsPerSeconds}
                  totalSlice={totalSlices}
                  lastSliceReceivedOn={lastSliceReceivedOn}
                  availableSlicesCount={availableSlices.length}
                  totalSlices={totalSlices}
                />
                <video ref={videoRef} autoPlay></video>
              </div>
            </div>
          )}
          <div className="info-box">
            {descriptor ? <div>{progressBar}</div> : null}
            {ready ? (
              <button onClick={() => downloadPayload()}>Download</button>
            ) : null}
            <div>
              <h1>Devices</h1>
              <select
                value={selectedMediaDeviceId}
                onChange={(d) => {
                  setSelectedMediaDeviceId(d.target.value);
                }}
              >
                {videoMediaDevices.map((mediaDevice) => {
                  return (
                    <option
                      key={mediaDevice.deviceId + mediaDevice.label}
                      value={mediaDevice.deviceId}
                    >
                      {mediaDevice.label}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
