import { co2 } from '@tgwf/co2';

export class CarbonIntensity {
	private co2Instance: any;

	constructor() {
		// Initialize co2.js with the Sustainable Web Design (SWD) model
		this.co2Instance = new co2({ model: 'swd' });
	}

	/**
	 * Calculates estimated carbon emissions (gCO2e) based on a smell severity.
	 * Heuristic: intensity 1.0 (e.g. 1ms interval) ~ 1MB energy equivalent per minute.
	 * @param intensity 0-1 value representing the severity of the energy smell.
	 * @returns Estimated gCO2e equivalent per hour of execution.
	 */
	calculateIntensity(intensity: number): string {
		// Convert intensity to an hourly byte-equivalent heuristic
		// intensity 1.0 -> 60MB per hour
		const megabytesPerHour = intensity * 60;
		const bytes = megabytesPerHour * 1024 * 1024;
		
		const emissions = this.co2Instance.perByte(bytes);
		return typeof emissions === 'number' ? emissions.toFixed(4) : "0.0000";
	}

	/**
	 * Heuristic: One mature tree absorbs ~21kg CO2 per year = ~2.4g per hour.
	 */
	calculateTreesSaved(gramsCO2: number): number {
		return gramsCO2 / 2.4;
	}
}
