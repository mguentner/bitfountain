import { FunctionComponent } from "react";

export const FileInfo: FunctionComponent<{ file: File }> = ({ file }) => {
  return (
    <div>
      <span>{file.name}</span> - <span>{file.size} Bytes</span>
    </div>
  );
};
