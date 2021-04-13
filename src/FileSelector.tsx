import { FunctionComponent } from "react";

interface FileSelectorProps {
  onFileSelect: (file: File) => void;
}

export const FileSelector: FunctionComponent<FileSelectorProps> = ({
  onFileSelect,
}) => {
  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const file = e.target.files[0];
      onFileSelect(file);
    }
  };

  return <input type="file" onChange={handleFileInput} />;
};
