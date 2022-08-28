import { getLogger } from "./utils/logging";
import { Hash } from "crypto";
import { Runtime } from "inspector";
import { Key } from "react";
const LOGGER = getLogger("RomLibrary");

const pFileReader = function(file: File): Promise<ProgressEvent<FileReader>> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = resolve;
    reader.readAsBinaryString(file);
  });
};

const hashFile = function(byteString) {
  const asHex = buffer => {
    return Array.from(new Uint8Array(buffer))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");
  };

  const ab = new ArrayBuffer(byteString.length);
  var ia = new Uint8Array(ab);

  for (var i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }

  return crypto.subtle.digest("SHA-1", ab).then(asHex);
};

//[{"name":"starfighter.nes","hash":"24631fec984c4e07bed44b77e35e40a6bdf29a90","added":1661704448241}]'
export interface RomInfo {
  name: string;
  hash: Key;
  added: number;
}

const RomLibrary = {
  getRomInfoByHash: function(hash: Key) {
    return this.load().find(rom => rom.hash === hash);
  },
  save: function(file: File): Promise<RomInfo> {
    return pFileReader(file)
      .then(function(readFile) {
        const byteString = readFile.target?.result;
        return hashFile(byteString).then((hash: string) => {
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
    if (!localData) return [];
    LOGGER.warn(localData);
    const savedRomInfo = JSON.parse(localStorage.getItem("savedRomInfo"));

    return savedRomInfo || [];
  },
  delete: function(hash) {
    const existingLibrary = this.load();
    localStorage.removeItem("blob-" + hash);
    localStorage.setItem(
      "savedRomInfo",
      JSON.stringify(existingLibrary.filter(rom => rom.hash !== hash))
    );
  }
};

export default RomLibrary;
