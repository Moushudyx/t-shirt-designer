import { SRGBColorSpace, TextureLoader, type Texture } from 'three';

const loader = new TextureLoader();

export async function loadTextureFromSource(source: string): Promise<Texture> {
  const texture = await loader.loadAsync(source);
  texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

export function toDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}
