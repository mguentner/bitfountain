import { BrowserQRCodeSvgWriter } from "@zxing/browser";
import React, { FunctionComponent, useEffect, useRef, useState } from "react";
import { FileInfo } from "./FileInfo";
import { FileSelector } from "./FileSelector";
import {
  getDescriptor,
  getMaxSliceCount,
  getNextPermutation,
  getNextSliceCount,
  hashFileSHA256B64,
  marshalDescriptor,
  marshalSlice,
} from "./FileUtils";
import useInterval from "./useInterval";
import { EncodeHintType } from "@zxing/library";
import "./Transmitter.css";
import ErrorCorrectionLevel from "@zxing/library/esm/core/qrcode/decoder/ErrorCorrectionLevel";

const writeSVGToRef = (data: string, ref: React.RefObject<HTMLDivElement>) => {
  const encodingHints = new Map([
    [EncodeHintType.ERROR_CORRECTION, ErrorCorrectionLevel.M],
  ]);
  if (ref && ref.current && data) {
    const codeWriter = new BrowserQRCodeSvgWriter();
    const qr = codeWriter.write(data, 1024, 1024, encodingHints);
    qr.setAttribute("viewBox", "0 70 1024 1024");
    qr.removeAttribute("height");
    qr.removeAttribute("width");
    while (ref.current.firstChild) {
      ref.current.removeChild(ref.current.firstChild);
    }
    ref.current.appendChild(qr);
  } else if (ref && ref.current && !data) {
    while (ref.current.firstChild) {
      ref.current.removeChild(ref.current.firstChild);
    }
  }
};

export const TransmitterLocation = ({
  onNextClick,
}: {
  onNextClick: () => void;
}) => {
  const svgRef = useRef<HTMLDivElement>(null);
  const url = window.location.origin + "?p=receiver";

  useEffect(() => {
    writeSVGToRef(url, svgRef);
  }, [url, svgRef]);

  return (
    <div>
      <h1>Navigate to {url} on the receiver device or scan the code.</h1>
      Press <button onClick={() => onNextClick()}>Next</button> when done.
      <div className="svg-fountain-container" onClick={() => onNextClick()}>
        <div className="svg-fountain" ref={svgRef} />
      </div>
    </div>
  );
};

export const Transmitter: FunctionComponent = () => {
  const svgRef = useRef<HTMLDivElement>(null);
  const [file, setFile] = useState<File | undefined>(undefined);
  const [sha256, setSha256] = useState<string>("");
  const [currentlyHashing, setCurrentlyHashing] = useState(false);
  const [data, setData] = useState<string | undefined>(undefined);
  const fps = 10;
  const sliceSize = 200;
  const [count, setCount] = useState(0);
  const [sliceCount, setSliceCount] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [navigated, setNavigated] = useState(false);

  useEffect(() => {
    data && writeSVGToRef(data, svgRef);
  }, [data]);

  useInterval(async () => {
    if (file && processing === false) {
      if (count % Math.round(getMaxSliceCount(file, sliceCount) * 0.05) === 0) {
        const descriptor = getDescriptor(file, sha256, sliceSize);
        const marshaled = marshalDescriptor(descriptor, sliceSize);
        setData(marshaled);
      } else {
        setProcessing(true);
        const permutation = getNextPermutation(file, sliceSize);
        const marshaled = await marshalSlice(file, sliceSize, permutation);
        setProcessing(false);
        setData(marshaled);
        setSliceCount(getNextSliceCount(file, sliceSize, sliceCount));
      }
      setCount(count + 1);
    }
  }, 1000 / fps);

  if (currentlyHashing) {
    return <div>Processing the file.</div>;
  }

  return (
    <React.Fragment>
      {file ? (
        navigated ? (
          <div>
            <div className="file-info">
              <FileInfo file={file} />
              <button
                onClick={() => {
                  setFile(undefined);
                }}
              >
                Select different File
              </button>
            </div>
            <div className="svg-fountain-container">
              <div className="svg-fountain" ref={svgRef} />
            </div>
          </div>
        ) : (
          <TransmitterLocation onNextClick={() => setNavigated(true)} />
        )
      ) : (
        <div className="file-selector">
          <FileSelector
            onFileSelect={async (file: File) => {
              setCurrentlyHashing(true);
              const hash = await hashFileSHA256B64(file);
              setCurrentlyHashing(false);
              setSha256(hash);
              setFile(file);
            }}
          />
        </div>
      )}
    </React.Fragment>
  );
};
