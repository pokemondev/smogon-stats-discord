import { Pokemon } from "./models";

export class ImageService {

	public static getPngUrl(pokemon: Pokemon): string 	{
    return `https://play.pokemonshowdown.com/sprites/bw/${pokemon.name.replace(/\s/g, '').toLowerCase()}.png`;
  }
  
  public static getGifUrl(pokemon: Pokemon): string 	{;
    return `https://play.pokemonshowdown.com/sprites/xyani/${pokemon.name.replace(/ /g, '').toLowerCase()}.gif`;
	}
	
}