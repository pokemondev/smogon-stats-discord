import { PokemonType, TypeEffectiveness, Pokemon, EffectivenessItem, EffectivenessType } from "./models";
import { FileHelper } from "../common/fileHelper";
import { getMapValues } from "../common/mapHelper";

export class TypeService {

	private static typesMap: { [id: string] : TypeEffectiveness; } = {};
	
	public static getFullEffectiveness(pokemon: Pokemon): EffectivenessItem[] {
		const result = [] as EffectivenessItem[];
		
		getMapValues<PokemonType>(PokemonType).forEach(t => {
			const effectiveness = this.getEffectiveness(t, pokemon);
			result.push({ type: t, effect: effectiveness })
		})

		return result;
	} 

	private static getEffectiveness(attackerType: PokemonType, defender: Pokemon): EffectivenessType {
		const resultType1 = this.typesMap[attackerType].atk_effectives.find(a => a[0] == defender.type1)[1];
		if (!defender.type2)
			return resultType1;
		
		const resultType2 = this.typesMap[attackerType].atk_effectives.find(a => a[0] == defender.type2)[1];
		const noneEffectiveness = resultType1 == EffectivenessType.None || resultType2 == EffectivenessType.None;
		if (noneEffectiveness)
				return EffectivenessType.None;

		const sameEffectiveness = resultType1 === resultType2;
		if (sameEffectiveness)
		{
				if (resultType1 == EffectivenessType.NotVeryEffective)
						return EffectivenessType.NotVeryEffective2x;

				if (resultType1 == EffectivenessType.SuperEffective)
						return EffectivenessType.SuperEffective2x;

				return resultType1;
		}

		var hasNormal = resultType1 == EffectivenessType.Normal || resultType2 == EffectivenessType.Normal;
		if (hasNormal)
				return resultType1 == EffectivenessType.Normal ? resultType2 : resultType1;

		return EffectivenessType.Normal;
	}
	
	static initialize(): void {
		const typesData = FileHelper.loadFileData<TypeEffectiveness[]>("type-table.json");
		typesData.forEach(t => {
			this.typesMap[t.name] = t;
		});
	}
}
TypeService.initialize();