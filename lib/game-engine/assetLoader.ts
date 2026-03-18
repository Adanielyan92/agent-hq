import { FURNITURE_META } from './agentHqLayout';

export interface GameAssets {
  characters: HTMLImageElement[]; // char_0..5
  furniture: Map<string, HTMLImageElement>;
  floorTiles: HTMLImageElement[]; // floor_0..8
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load: ${src}`));
    img.src = src;
  });
}

export async function loadGameAssets(): Promise<GameAssets> {
  // Load character sprite sheets (char_0.png - char_5.png)
  const charPromises = Array.from({ length: 6 }, (_, i) =>
    loadImage(`/assets/characters/char_${i}.png`)
  );

  // Load floor tiles (floor_0.png - floor_8.png)
  const floorPromises = Array.from({ length: 9 }, (_, i) =>
    loadImage(`/assets/floors/floor_${i}.png`)
  );

  // Load all furniture PNGs referenced in FURNITURE_META
  const furnitureEntries = Object.entries(FURNITURE_META);
  const furniturePromises = furnitureEntries.map(([id, meta]) =>
    loadImage(meta.png).then((img) => [id, img] as [string, HTMLImageElement])
  );

  const [chars, floors, furniturePairs] = await Promise.all([
    Promise.all(charPromises),
    Promise.allSettled(floorPromises).then((results) =>
      results.map((r) => (r.status === 'fulfilled' ? r.value : null))
    ) as Promise<(HTMLImageElement | null)[]>,
    Promise.allSettled(furniturePromises).then((results) =>
      results
        .filter((r): r is PromiseFulfilledResult<[string, HTMLImageElement]> =>
          r.status === 'fulfilled'
        )
        .map((r) => r.value)
    ),
  ]);

  const furniture = new Map<string, HTMLImageElement>(furniturePairs);

  return {
    characters: chars,
    furniture,
    floorTiles: floors.filter(Boolean) as HTMLImageElement[],
  };
}
