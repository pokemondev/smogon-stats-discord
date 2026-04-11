import { Pokemon } from "./models";

const gifUrlExceptions: Readonly<Record<string, string>> = {
  miraidon: 'https://play.pokemonshowdown.com/sprites/gen5ani/miraidon.gif',
};

export class ImageService {

	public static getPngUrl(pokemon: Pokemon): string 	{
    const spriteName = ImageService.getSpriteName(pokemon);
    return `https://play.pokemonshowdown.com/sprites/gen5/${spriteName}.png`;
  }
  
	public static getGifUrl(pokemon: Pokemon): string 	{
    const spriteName = ImageService.getSpriteName(pokemon);
    const exceptionUrl = gifUrlExceptions[spriteName];

    return exceptionUrl
     ? exceptionUrl
     : `https://play.pokemonshowdown.com/sprites/xyani/${spriteName}.gif`;
	}

	private static getSpriteName(pokemon: Pokemon): string {
    const compactName = pokemon.name.replace(/\s/g, '');

    if (!pokemon.isAltForm) {
      return compactName.replace(/-/g, '').toLowerCase();
    }

    const firstDashIndex = compactName.indexOf('-');
    if (firstDashIndex < 0) {
      return compactName.toLowerCase();
    }

    const baseName = compactName.slice(0, firstDashIndex + 1);
    const altFormName = compactName.slice(firstDashIndex + 1).replace(/-/g, '');

    return `${baseName}${altFormName}`.toLowerCase();
	}
	
}