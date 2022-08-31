import { getLogger } from "./utils/logging";
import { Key } from "react";
const LOGGER = getLogger("RomLibrary");

const pFileReader = function(file: File): Promise<ProgressEvent<FileReader>> {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = resolve;
    reader.readAsBinaryString(file);
  });
};

const hashFile = function(byteString: string) {
  const asHex = (buffer: ArrayBuffer) => {
    return Array.from(new Uint8Array(buffer))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");
  };

  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);

  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }

  return crypto.subtle.digest("SHA-1", ab).then(asHex);
};

export interface RomInfo {
  name: string;
  hash: Key;
  added: number;
}

const RomLibrary = {
  getRomInfoByHash: function(hash: Key): RomInfo | undefined {
    LOGGER.info(`Getting rom info for: ${hash}`);
    const loadedRomInfo = this.load().find(rom => rom.hash === hash);
    LOGGER.debug({ loadedRomInfo });
    return loadedRomInfo;
  },
  save: function(file: File): Promise<RomInfo> {
    return pFileReader(file)
      .then(function(readFile) {
        const byteString = readFile.target?.result;
        if (!byteString) {
          throw new Error("Failed reading file target");
        }
        return hashFile(byteString.toString()).then((hash: string) => {
          return { hash, byteString };
        });
      })
      .then(({ hash, byteString }) => {
        const savedRomInfo = localStorage.getItem("savedRomInfo");
        const existingLibrary = savedRomInfo ? JSON.parse(savedRomInfo) : [];

        const rom: RomInfo = {
          name: file.name,
          hash: hash,
          added: Date.now()
        };

        const newRomInfo = JSON.stringify(existingLibrary.concat([rom]));

        localStorage.setItem("savedRomInfo", newRomInfo);
        localStorage.setItem("blob-" + hash, byteString as string);

        return rom;
      });
  },
  load: function(): RomInfo[] {
    const localData = localStorage.getItem("savedRomInfo");
    if (!localData) {
      LOGGER.info("No 'savedRomInfo' found in localStorage");
      return [];
    }
    LOGGER.info({ localData });
    const savedRomInfo = JSON.parse(localData);
    if (!savedRomInfo) {
      LOGGER.info("'savedRomInfo' found but was empty");
      return [];
    }

    LOGGER.debug({ savedRomInfo });
    return savedRomInfo;
  },
  delete: function(hash: Key) {
    const existingLibrary = this.load();
    localStorage.removeItem("blob-" + hash);
    localStorage.setItem(
      "savedRomInfo",
      JSON.stringify(existingLibrary.filter(rom => rom.hash !== hash))
    );
  }
};

export default RomLibrary;
