import { useState, useEffect } from "react";

export const useVideoMediaDevices = () => {
  const [mediaDevices, setMediaDevices] = useState<MediaDeviceInfo[]>([]);

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: true }).then(() => {
      navigator.mediaDevices.enumerateDevices().then((mds) => {
        setMediaDevices(mds.filter((md) => md.kind === "videoinput"));
      });
    });
  }, []);
  return mediaDevices;
};
